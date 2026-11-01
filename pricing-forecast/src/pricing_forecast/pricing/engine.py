"""Движок гибридного ценообразования.

Реализует принципы 2-3 раздела 2.1 главы 2 пояснительной записки:
- рекомендованная цена = базовый тариф * сезонный коэффициент * поправка на спрос;
- если рекомендация внутри коридора [p_min; p_max] — возвращается как есть;
- если вне коридора — клиенту уходит ближайшая граница, а в price_reviews
  создаётся запись со статусом PENDING_REVIEW (решение менеджера её не блокирует:
  решение влияет только на БУДУЩИЕ расчёты через price_rules).

Важно: здесь НЕТ случая "ждать решения менеджера". Любой расчёт синхронно
возвращает цену клиенту за один вызов — это и есть гибридный режим, принятый
в главе 1 (раздел 1.3) и главе 2 (принцип 2).
"""
from __future__ import annotations

import datetime as dt
import uuid
from dataclasses import dataclass
from decimal import ROUND_HALF_UP, Decimal

from pricing_forecast.models.pricing import PriceRule, PriceReview, Tariff


@dataclass(frozen=True)
class PriceQuote:
    category_id: int
    stay_date: dt.date
    price_recommended: Decimal
    price_applied: Decimal
    p_min: Decimal
    p_max: Decimal
    out_of_corridor: bool
    quote_id: uuid.UUID | None  # None, если это предварительный расчёт без фиксации (поиск мест)


def round_price(value: Decimal) -> Decimal:
    return value.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)


def demand_adjustment(predicted_occ: Decimal | None) -> Decimal:
    """Поправка цены на прогнозируемую загрузку f(occ).

    Проектная модель (допущение автора, раздел 3.7 главы 3): линейная надбавка
    до +20% при занятости 100% и скидка до -10% при занятости 0%, нулевая
    поправка на занятости 50%. При отсутствии прогноза поправка не применяется.
    """
    if predicted_occ is None:
        return Decimal("1.00")
    occ = max(Decimal("0"), min(Decimal("100"), predicted_occ))
    return Decimal("0.90") + occ * Decimal("0.003")  # 0% -> 0.90, 50% -> 1.05, 100% -> 1.20


def calculate_price(
    *,
    category_id: int,
    stay_date: dt.date,
    tariff: Tariff,
    season_k: Decimal,
    rule: PriceRule | None,
    predicted_occ: Decimal | None,
    fix_quote: bool,
) -> PriceQuote:
    """Считает рекомендованную и применённую цену на одни сутки проживания.

    fix_quote=True — вызов из бронирования (core → POST /price/quote/batch),
    тогда генерируется quote_id и (при выходе за коридор) запись для рассмотрения
    создаёт вызывающий код (см. api/price.py), а не этот модуль — чтобы движок
    оставался чистой функцией без побочных эффектов на БД.
    """
    base = Decimal(tariff.price_base)
    recommended = round_price(base * season_k * demand_adjustment(predicted_occ))

    if rule is not None and rule.closed:
        # Продажа закрыта правилом; движок возвращает цену, решение "продавать ли"
        # принимает core-service по флагу closed, полученному вместе с ответом.
        p_min = p_max = recommended
    elif rule is not None:
        p_min, p_max = Decimal(rule.p_min), Decimal(rule.p_max)
    else:
        # Нет заданного коридора: проектное допущение — коридор не ограничивает цену
        p_min, p_max = recommended, recommended

    if recommended < p_min:
        applied, out = p_min, True
    elif recommended > p_max:
        applied, out = p_max, True
    else:
        applied, out = recommended, False

    return PriceQuote(
        category_id=category_id,
        stay_date=stay_date,
        price_recommended=recommended,
        price_applied=applied,
        p_min=p_min,
        p_max=p_max,
        out_of_corridor=out,
        quote_id=uuid.uuid4() if fix_quote else None,
    )


def build_review(quote: PriceQuote, quote_id: uuid.UUID) -> PriceReview:
    """Создаёт запись рассмотрения для рекомендации, вышедшей за коридор (ФТ-17)."""
    return PriceReview(
        quote_id=quote_id,
        category_id=quote.category_id,
        stay_date=quote.stay_date,
        price_recommended=quote.price_recommended,
        price_applied=quote.price_applied,
        p_min=quote.p_min,
        p_max=quote.p_max,
        status="PENDING_REVIEW",
    )
