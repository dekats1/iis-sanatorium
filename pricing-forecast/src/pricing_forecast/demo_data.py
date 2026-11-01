"""Демо-данные pricing-forecast: сезоны, тарифы, коридоры цен, история спроса, рекомендации вне коридора.

Чистые функции без БД: их использует CLI (`python -m pricing_forecast.cli seed`) и тесты. Генерация детерминирована
(фиксированный seed), все даты считаются от «сегодня». Модель загрузки и сезонные коэффициенты зеркалируют
core-service (`DemoGenerator`): те же категории, тарифы BYN за место-сутки, те же сезоны, поэтому цены, которые считает
pricing-forecast, совпадают с ценами в демо-путёвках core-service.

Идентификаторы категорий — как у core-service на чистой БД (миграция V5 + DemoDataLoader):
1 Стандарт, 2 Комфорт, 3 Люкс, 4 Семейный двухкомнатный, 5 Президентский сюит, 6 Студия.
"""
from __future__ import annotations

import datetime as dt
import hashlib
import random
import uuid
from dataclasses import dataclass

SEED = 20261101
HISTORY_DAYS = 730  # 24 месяца до вчерашнего дня

CATEGORY_NAMES = {
    1: "Стандарт",
    2: "Комфорт",
    3: "Люкс",
    4: "Семейный двухкомнатный",
    5: "Президентский сюит",
    6: "Студия",
}
# тариф, BYN за место-сутки (базовая цена до сезонного коэффициента и поправки на спрос)
CATEGORY_BASE_PRICE = {1: 85.0, 2: 115.0, 3: 165.0, 4: 130.0, 5: 260.0, 6: 105.0}
# число койко-мест категории: количество номеров * вместимость (24*2, 32*2, 12*3, 10*4, 4*3, 8*2)
CATEGORY_PLACES = {1: 48, 2: 64, 3: 36, 4: 40, 5: 12, 6: 16}
CATEGORY_IDS = tuple(CATEGORY_NAMES)

# множители коридора относительно тарифа (как в прежнем seed)
CORRIDOR_MIN_K = 0.8
CORRIDOR_MAX_K = 1.6


@dataclass(frozen=True)
class SeasonSpec:
    name: str
    start: tuple[int, int]  # (месяц, день)
    end: tuple[int, int]
    k: float
    min_los: int


# Календарь сезонов года; границы совпадают с DemoGenerator.seasonK в core-service
SEASON_TEMPLATE: tuple[SeasonSpec, ...] = (
    SeasonSpec("Новый год (январские каникулы)", (1, 1), (1, 10), 1.30, 5),
    SeasonSpec("Низкий сезон (зима)", (1, 11), (3, 31), 0.85, 2),
    SeasonSpec("Межсезонье (апрель)", (4, 1), (4, 30), 1.00, 2),
    SeasonSpec("Майские праздники", (5, 1), (5, 11), 1.10, 3),
    SeasonSpec("Межсезонье (конец мая)", (5, 12), (5, 31), 1.00, 2),
    SeasonSpec("Высокий сезон (лето)", (6, 1), (8, 31), 1.35, 3),
    SeasonSpec("Бархатный сезон (сентябрь)", (9, 1), (9, 30), 1.05, 2),
    SeasonSpec("Осень (октябрь)", (10, 1), (10, 31), 0.95, 2),
    SeasonSpec("Низкий сезон (поздняя осень)", (11, 1), (12, 24), 0.85, 2),
    SeasonSpec("Новый год (предпраздничная неделя)", (12, 25), (12, 31), 1.30, 5),
)


def seasons_years(today: dt.date) -> list[int]:
    """Годы, для которых заводятся сезоны: два прошлых, текущий и следующий (история + горизонт бронирования)."""
    return [today.year - 2, today.year - 1, today.year, today.year + 1]


def season_rows(today: dt.date) -> list[dict]:
    rows = []
    for year in seasons_years(today):
        for s in SEASON_TEMPLATE:
            rows.append({
                "name": f"{s.name} {year}",
                "date_from": dt.date(year, *s.start),
                "date_to": dt.date(year, *s.end),
                "k_season": s.k,
                "min_los": s.min_los,
            })
    return rows


def season_k(d: dt.date) -> float:
    for s in SEASON_TEMPLATE:
        if (s.start[0], s.start[1]) <= (d.month, d.day) <= (s.end[0], s.end[1]):
            return s.k
    raise ValueError(f"нет сезона на {d}")


def corridor_rows(today: dt.date) -> list[dict]:
    """Коридоры цен по категориям: на каждый сезонный период года, без пересечений внутри категории."""
    rows = []
    for year in seasons_years(today):
        for cat, base in CATEGORY_BASE_PRICE.items():
            for s in SEASON_TEMPLATE:
                rows.append({
                    "category_id": cat,
                    "date_from": dt.date(year, *s.start),
                    "date_to": dt.date(year, *s.end),
                    "p_min": round(base * CORRIDOR_MIN_K, 2),
                    "p_max": round(base * CORRIDOR_MAX_K, 2),
                    "min_los": s.min_los,
                    "closed": False,
                })
    return rows


# ---- модель загрузки ----

_MONTH_OCC = {1: 0.40, 2: 0.38, 3: 0.46, 4: 0.50, 5: 0.60, 6: 0.72, 7: 0.85, 8: 0.88, 9: 0.66, 10: 0.48, 11: 0.36, 12: 0.43}
_WEEKDAY = {0: 0.92, 1: 0.90, 2: 0.90, 3: 0.95, 4: 1.08, 5: 1.15, 6: 1.05}  # пн..вс: пик заездов и проживания к выходным
_WEEKDAY_NORM = sum(_WEEKDAY.values()) / 7
# доля «реализованной» загрузки core-service относительно целевой (нельзя заполнить все места в номерах)
_REALIZATION = 0.6


def new_year(d: dt.date) -> bool:
    return (d.month == 12 and d.day >= 24) or (d.month == 1 and d.day <= 9)


def base_occupancy(d: dt.date) -> float:
    o = _MONTH_OCC[d.month]
    if new_year(d):
        return 0.93
    if d.month == 5 and d.day <= 11:
        return max(o, 0.74)
    if d.month == 3 and 5 <= d.day <= 9:
        return max(o, 0.62)
    return o


def category_affinity(cat: int, base: float) -> float:
    peak = base >= 0.7
    if cat == 4:
        return 1.15 if peak else 0.7
    if cat == 5:
        return 0.85 if peak else 0.45
    return {1: 1.0, 2: 1.0, 3: 0.85, 6: 0.9}[cat]


def trend(d: dt.date, today: dt.date) -> float:
    """Рост загрузки: от 0.35 в начале ряда core-service (18 месяцев назад) до 1.0 за месяц до сегодняшнего дня."""
    start = today - dt.timedelta(days=18 * 30 + 14)
    span = ((today - dt.timedelta(days=30)) - start).days
    t = min(1.0, max(0.0, (d - start).days / span))
    return 0.35 + 0.65 * t


def history_rows(today: dt.date, seed: int = SEED) -> list[dict]:
    """24 месяца фактических продаж по суткам и категориям: годовая сезонность, пики праздников, недельный цикл, шум."""
    rng = random.Random(seed)
    rows: list[dict] = []
    first = today - dt.timedelta(days=HISTORY_DAYS)
    for cat in CATEGORY_IDS:
        places = CATEGORY_PLACES[cat]
        ar = 0.0  # AR(1)-шум: соседние сутки коррелированы, как реальная загрузка
        for i in range(HISTORY_DAYS):
            day = first + dt.timedelta(days=i)
            base = base_occupancy(day)
            occ = (base * trend(day, today) * category_affinity(cat, base) * _REALIZATION
                   * _WEEKDAY[day.weekday()] / _WEEKDAY_NORM)
            ar = 0.7 * ar + rng.gauss(0, 0.04)
            occ = min(0.99, max(0.03, occ * (1 + ar)))
            rows.append({"category_id": cat, "stay_date": day, "sold": min(places, round(occ * places)), "available": places})
    return rows


# ---- рекомендации вне коридора (на рассмотрение менеджера) ----

def _quote_id(i: int) -> uuid.UUID:
    return uuid.UUID(bytes=hashlib.md5(f"demo-price-review-{i}".encode()).digest(), version=3)


def review_rows(today: dt.date, now: dt.datetime, seed: int = SEED) -> list[dict]:
    """Нерассмотренные (PENDING_REVIEW) и уже рассмотренные рекомендации; цены заведомо вне коридора категории."""
    rng = random.Random(seed + 1)
    rows: list[dict] = []
    pending_dates = [dt.date(today.year, 12, 28), dt.date(today.year, 12, 30), dt.date(today.year + 1, 1, 3),
                     today + dt.timedelta(days=9), today + dt.timedelta(days=16), today + dt.timedelta(days=23)]
    pending_dates = [d if d > today else d.replace(year=d.year + 1) for d in pending_dates]
    n = 0
    for status, count, decided_by in (("PENDING_REVIEW", 14, None), ("ACKNOWLEDGED", 7, "manager"),
                                       ("RULE_ADJUSTED", 4, "manager"), ("AUTO_ACKNOWLEDGED", 5, None)):
        for _ in range(count):
            n += 1
            cat = rng.choice(CATEGORY_IDS)
            base = CATEGORY_BASE_PRICE[cat]
            p_min, p_max = round(base * CORRIDOR_MIN_K, 2), round(base * CORRIDOR_MAX_K, 2)
            if status == "PENDING_REVIEW":
                stay = rng.choice(pending_dates) + dt.timedelta(days=rng.randint(0, 2))
                age_hours = rng.randint(1, 60)
            else:
                stay = today + dt.timedelta(days=rng.randint(-40, 40))
                age_hours = rng.randint(24 * 3, 24 * 30)
            above = season_k(stay) >= 1.1 or rng.random() < 0.3
            recommended = round(p_max * rng.uniform(1.03, 1.14), 2) if above else round(p_min * rng.uniform(0.90, 0.98), 2)
            applied = p_max if above else p_min
            created = now - dt.timedelta(hours=age_hours)
            decided_at = None
            if status == "AUTO_ACKNOWLEDGED":
                decided_at = created + dt.timedelta(hours=24)
            elif decided_by:
                decided_at = created + dt.timedelta(hours=rng.randint(2, 30))
            rows.append({
                "quote_id": _quote_id(n), "category_id": cat, "stay_date": stay, "price_recommended": recommended,
                "price_applied": applied, "p_min": p_min, "p_max": p_max, "status": status, "created_at": created,
                "decided_by": decided_by, "decided_at": decided_at,
            })
    return rows
