"""Тесты генератора демо-данных (demo_data.py): сезоны, коридоры, история спроса, рекомендации. БД не нужна."""
from __future__ import annotations

import datetime as dt
from collections import defaultdict

from pricing_forecast import demo_data as dd

TODAY = dt.date(2026, 11, 1)
NOW = dt.datetime(2026, 11, 1, 9, 0, tzinfo=dt.timezone.utc)


def _no_overlap(ranges: list[tuple[dt.date, dt.date]]) -> bool:
    ordered = sorted(ranges)
    return all(prev[1] < nxt[0] for prev, nxt in zip(ordered, ordered[1:]))


def test_seasons_cover_every_day_without_overlap():
    rows = dd.season_rows(TODAY)
    assert len(rows) == 4 * len(dd.SEASON_TEMPLATE)
    assert _no_overlap([(r["date_from"], r["date_to"]) for r in rows])
    day = dt.date(TODAY.year - 2, 1, 1)
    while day <= dt.date(TODAY.year + 1, 12, 31):
        assert dd.season_k(day) > 0  # у каждой даты есть сезон
        day += dt.timedelta(days=1)
    # коэффициент строки сезона совпадает с функцией season_k на всех датах интервала
    for r in rows:
        assert dd.season_k(r["date_from"]) == r["k_season"] == dd.season_k(r["date_to"])


def test_corridors_do_not_overlap_per_category():
    by_cat = defaultdict(list)
    for r in dd.corridor_rows(TODAY):
        assert 0 < r["p_min"] <= r["p_max"]
        by_cat[r["category_id"]].append((r["date_from"], r["date_to"]))
    assert set(by_cat) == set(dd.CATEGORY_IDS) and len(dd.CATEGORY_IDS) == 6
    assert all(_no_overlap(v) for v in by_cat.values())


def test_history_is_valid_deterministic_and_seasonal():
    a = dd.history_rows(TODAY)
    assert a == dd.history_rows(TODAY)
    assert len(a) == 6 * dd.HISTORY_DAYS
    assert max(r["stay_date"] for r in a) == TODAY - dt.timedelta(days=1)
    assert all(0 <= r["sold"] <= r["available"] and r["available"] > 0 for r in a)
    keys = {(r["category_id"], r["stay_date"]) for r in a}
    assert len(keys) == len(a)  # уникальность (category_id, stay_date)

    cat1 = [r for r in a if r["category_id"] == 1]
    occ = {r["stay_date"]: r["sold"] / r["available"] for r in cat1}

    def mean(days):
        vals = [occ[d] for d in days if d in occ]
        return sum(vals) / len(vals)

    prev_year = TODAY.year - 1
    july = [dt.date(prev_year, 7, d) for d in range(1, 32)]
    november = [dt.date(prev_year, 11, d) for d in range(1, 31)]
    assert mean(july) > mean(november) * 1.5  # летний пик против низкого сезона
    saturdays = [d for d in occ if d.weekday() == 5]
    tuesdays = [d for d in occ if d.weekday() == 1]
    assert mean(saturdays) > mean(tuesdays)  # недельный цикл
    assert mean([dt.date(prev_year + 1, 1, d) for d in range(2, 8)]) > mean([dt.date(prev_year + 1, 2, d) for d in range(1, 28)])  # Новый год


def test_price_reviews_are_outside_corridor_and_pending_exist():
    rows = dd.review_rows(TODAY, NOW)
    assert len({r["quote_id"] for r in rows}) == len(rows)
    assert sum(1 for r in rows if r["status"] == "PENDING_REVIEW") >= 10
    for r in rows:
        assert r["price_recommended"] > r["p_max"] or r["price_recommended"] < r["p_min"]
        assert r["price_applied"] in (r["p_min"], r["p_max"])
        if r["status"] == "PENDING_REVIEW":
            assert r["decided_at"] is None and r["stay_date"] > TODAY
