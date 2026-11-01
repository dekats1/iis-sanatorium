"""Модульные тесты движка ценообразования (pricing/engine.py).

Проверяют принципы 2-3 раздела 2.1 главы 2: корридорное ограничение цены,
поправку на спрос, и то, что движок синхронно возвращает цену без "ожидания"
решения менеджера (НФТ-07 — покрытие бизнес-логики тестами).
"""
from __future__ import annotations

import datetime as dt
from decimal import Decimal

import pytest

from pricing_forecast.pricing.engine import (
    build_review,
    calculate_price,
    demand_adjustment,
    round_price,
)
from pricing_forecast.models.pricing import PriceRule, Tariff


def _tariff(price_base: str) -> Tariff:
    t = Tariff(id=1, season_id=1, category_id=1, price_base=Decimal(price_base))
    return t


def _rule(p_min: str, p_max: str, closed: bool = False) -> PriceRule:
    return PriceRule(
        id=1, category_id=1,
        date_from=dt.date(2026, 1, 1), date_to=dt.date(2026, 12, 31),
        p_min=Decimal(p_min), p_max=Decimal(p_max), min_los=1, closed=closed,
    )


class TestRoundPrice:
    def test_rounds_half_up(self):
        assert round_price(Decimal("100.005")) == Decimal("100.01")
        assert round_price(Decimal("100.004")) == Decimal("100.00")

    def test_keeps_two_decimals(self):
        assert round_price(Decimal("99")) == Decimal("99.00")


class TestDemandAdjustment:
    def test_no_forecast_is_neutral(self):
        assert demand_adjustment(None) == Decimal("1.00")

    def test_zero_occupancy_gives_discount(self):
        assert demand_adjustment(Decimal("0")) == Decimal("0.90")

    def test_full_occupancy_gives_max_markup(self):
        assert demand_adjustment(Decimal("100")) == Decimal("1.20")

    def test_half_occupancy_is_neutral(self):
        assert demand_adjustment(Decimal("50")) == Decimal("1.05")

    def test_clamps_out_of_range_values(self):
        # Входные данные извне не должны ломать расчёт даже при некорректном прогнозе
        assert demand_adjustment(Decimal("150")) == demand_adjustment(Decimal("100"))
        assert demand_adjustment(Decimal("-10")) == demand_adjustment(Decimal("0"))


class TestCalculatePrice:
    def test_recommended_inside_corridor_is_applied_as_is(self):
        quote = calculate_price(
            category_id=1, stay_date=dt.date(2026, 7, 1),
            tariff=_tariff("100"), season_k=Decimal("1.0"),
            rule=_rule("80", "150"), predicted_occ=Decimal("50"),
            fix_quote=False,
        )
        # base(100) * season(1.0) * adj(1.05) = 105.00, внутри [80;150]
        assert quote.price_recommended == Decimal("105.00")
        assert quote.price_applied == Decimal("105.00")
        assert quote.out_of_corridor is False
        assert quote.quote_id is None  # fix_quote=False — предварительный расчёт

    def test_below_corridor_clamped_to_p_min_and_flagged(self):
        quote = calculate_price(
            category_id=1, stay_date=dt.date(2026, 1, 15),
            tariff=_tariff("100"), season_k=Decimal("0.85"),
            rule=_rule("90", "150"), predicted_occ=Decimal("0"),
            fix_quote=True,
        )
        # recommended = 100 * 0.85 * 0.90 = 76.50 < p_min(90)
        assert quote.price_recommended == Decimal("76.50")
        assert quote.price_applied == Decimal("90.00")
        assert quote.out_of_corridor is True
        assert quote.quote_id is not None  # клиент получает цену сразу, без ожидания менеджера

    def test_above_corridor_clamped_to_p_max_and_flagged(self):
        quote = calculate_price(
            category_id=1, stay_date=dt.date(2026, 8, 1),
            tariff=_tariff("100"), season_k=Decimal("1.35"),
            rule=_rule("80", "150"), predicted_occ=Decimal("100"),
            fix_quote=True,
        )
        # recommended = 100 * 1.35 * 1.20 = 162.00 > p_max(150)
        assert quote.price_recommended == Decimal("162.00")
        assert quote.price_applied == Decimal("150.00")
        assert quote.out_of_corridor is True

    def test_no_rule_means_unbounded_corridor(self):
        quote = calculate_price(
            category_id=1, stay_date=dt.date(2026, 7, 1),
            tariff=_tariff("100"), season_k=Decimal("1.0"),
            rule=None, predicted_occ=Decimal("50"),
            fix_quote=False,
        )
        assert quote.out_of_corridor is False
        assert quote.p_min == quote.p_max == quote.price_recommended

    def test_closed_rule_still_returns_a_price(self):
        # Решение "продавать ли" принимает core-service по флагу closed,
        # движок остаётся чистой функцией и не блокирует расчёт.
        quote = calculate_price(
            category_id=1, stay_date=dt.date(2026, 7, 1),
            tariff=_tariff("100"), season_k=Decimal("1.0"),
            rule=_rule("80", "150", closed=True), predicted_occ=Decimal("50"),
            fix_quote=True,
        )
        assert quote.price_applied == quote.price_recommended
        assert quote.out_of_corridor is False

    def test_fix_quote_always_generates_unique_quote_id(self):
        q1 = calculate_price(
            category_id=1, stay_date=dt.date(2026, 7, 1), tariff=_tariff("100"),
            season_k=Decimal("1.0"), rule=None, predicted_occ=None, fix_quote=True,
        )
        q2 = calculate_price(
            category_id=1, stay_date=dt.date(2026, 7, 1), tariff=_tariff("100"),
            season_k=Decimal("1.0"), rule=None, predicted_occ=None, fix_quote=True,
        )
        assert q1.quote_id != q2.quote_id


class TestBuildReview:
    def test_review_is_created_with_pending_status(self):
        quote = calculate_price(
            category_id=1, stay_date=dt.date(2026, 1, 15),
            tariff=_tariff("100"), season_k=Decimal("0.85"),
            rule=_rule("90", "150"), predicted_occ=Decimal("0"),
            fix_quote=True,
        )
        review = build_review(quote, quote.quote_id)
        assert review.status == "PENDING_REVIEW"
        assert review.quote_id == quote.quote_id
        assert review.price_recommended == quote.price_recommended
        assert review.price_applied == quote.price_applied
