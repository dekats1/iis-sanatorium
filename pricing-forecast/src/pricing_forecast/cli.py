"""CLI для первичного наполнения и обслуживания сервиса pricing-forecast.

Команды:
    python -m pricing_forecast.cli seed      — создать базовые сезоны/тарифы/коридоры
                                                (синтетические данные, т.к. реальных данных
                                                санатория нет — см. ограничения главы 1, п. 1.2.1)
    python -m pricing_forecast.cli reseed    — удалить и заново создать синтетические данные
    python -m pricing_forecast.cli forecast CATEGORY_ID
                                              — запустить прогноз для категории вручную

Вынесено в CLI (а не в HTTP API) по замечанию о безопасности: наполнение тестовыми
данными через открытый HTTP-эндпоинт в проде недопустимо (НФТ-04 — защита данных).
"""
from __future__ import annotations

import argparse
import datetime as dt
import random
import sys

import pandas as pd

from pricing_forecast.pricing.forecaster import forecast_occupancy
from pricing_forecast.db.session import Base, SessionLocal, engine
from pricing_forecast.models.pricing import (
    DemandHistory,
    Forecast,
    ForecastRun,
    PriceRule,
    SeasonPeriod,
    Tariff,
)

# Синтетические параметры генерации (явно помечены как допущения автора — раздел 1.2.1 главы 1)
DEMO_CATEGORY_IDS = [1, 2, 3]
DEMO_HISTORY_DAYS = 400
DEMO_CAPACITY = 20


def _year_bounds(year: int) -> tuple[dt.date, dt.date]:
    return dt.date(year, 1, 1), dt.date(year, 12, 31)


def cmd_seed(args: argparse.Namespace) -> None:
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        if db.query(SeasonPeriod).count() > 0 and not args.force:
            print("Данные уже существуют. Используйте reseed для пересоздания.", file=sys.stderr)
            return

        year = dt.date.today().year
        low_from, _ = _year_bounds(year)
        seasons = [
            SeasonPeriod(name="Низкий сезон (зима)", date_from=dt.date(year, 1, 1), date_to=dt.date(year, 3, 31), k_season=0.85),
            SeasonPeriod(name="Межсезонье (весна)", date_from=dt.date(year, 4, 1), date_to=dt.date(year, 5, 31), k_season=1.0),
            SeasonPeriod(name="Высокий сезон (лето)", date_from=dt.date(year, 6, 1), date_to=dt.date(year, 8, 31), k_season=1.35),
            SeasonPeriod(name="Межсезонье (осень)", date_from=dt.date(year, 9, 1), date_to=dt.date(year, 10, 31), k_season=1.0),
            SeasonPeriod(name="Низкий сезон (зима, декабрь)", date_from=dt.date(year, 11, 1), date_to=dt.date(year, 12, 31), k_season=0.85),
        ]
        db.add_all(seasons)
        db.flush()

        base_prices = {1: 120.0, 2: 160.0, 3: 220.0}  # категории: стандарт / комфорт / люкс (у.е./место-сутки)
        tariffs = [
            Tariff(season_id=season.id, category_id=cat_id, price_base=base_prices[cat_id])
            for season in seasons
            for cat_id in DEMO_CATEGORY_IDS
        ]
        db.add_all(tariffs)

        rules = [
            PriceRule(
                category_id=cat_id,
                date_from=dt.date(year, 1, 1),
                date_to=dt.date(year, 12, 31),
                p_min=round(base_prices[cat_id] * 0.8, 2),
                p_max=round(base_prices[cat_id] * 1.6, 2),
                min_los=2,
                closed=False,
            )
            for cat_id in DEMO_CATEGORY_IDS
        ]
        db.add_all(rules)

        rng = random.Random(42)
        start = dt.date.today() - dt.timedelta(days=DEMO_HISTORY_DAYS)
        for cat_id in DEMO_CATEGORY_IDS:
            for i in range(DEMO_HISTORY_DAYS):
                day = start + dt.timedelta(days=i)
                month = day.month
                month_k = {1: 0.5, 2: 0.5, 3: 0.6, 4: 0.65, 5: 0.7, 6: 0.85, 7: 0.95, 8: 0.95, 9: 0.75, 10: 0.65, 11: 0.55, 12: 0.6}[month]
                noise = rng.uniform(-0.08, 0.08)
                occ = max(0.05, min(0.99, month_k + noise))
                sold = round(occ * DEMO_CAPACITY)
                db.add(DemandHistory(category_id=cat_id, stay_date=day, sold=sold, available=DEMO_CAPACITY))

        db.commit()
        print(f"Синтетические данные созданы: {len(seasons)} сезонов, {len(tariffs)} тарифов, "
              f"{len(rules)} коридоров, {len(DEMO_CATEGORY_IDS) * DEMO_HISTORY_DAYS} суток истории спроса.")
    finally:
        db.close()


def cmd_reseed(args: argparse.Namespace) -> None:
    db = SessionLocal()
    try:
        db.query(Forecast).delete()
        db.query(ForecastRun).delete()
        db.query(DemandHistory).delete()
        db.query(PriceRule).delete()
        db.query(Tariff).delete()
        db.query(SeasonPeriod).delete()
        db.commit()
    finally:
        db.close()
    args.force = True
    cmd_seed(args)


def cmd_forecast(args: argparse.Namespace) -> None:
    from pricing_forecast.config import get_settings

    settings = get_settings()
    db = SessionLocal()
    try:
        rows = (
            db.query(DemandHistory.stay_date, DemandHistory.sold, DemandHistory.available)
            .filter(DemandHistory.category_id == args.category_id)
            .order_by(DemandHistory.stay_date)
            .all()
        )
        if len(rows) < 28:
            print(f"Недостаточно истории спроса для категории {args.category_id}: {len(rows)} суток.", file=sys.stderr)
            sys.exit(1)
        history = pd.DataFrame(rows, columns=["stay_date", "sold", "available"])
        points, mape = forecast_occupancy(history, settings.forecast_horizon_days, settings.forecast_seasonal_periods)

        run = ForecastRun(model="holt_winters_additive_trend_mul_seasonal", mape=round(mape, 2) if mape == mape else None)
        db.add(run)
        db.flush()
        db.add_all(
            Forecast(run_id=run.id, category_id=args.category_id, stay_date=p.stay_date, predicted_occ=p.predicted_occ)
            for p in points
        )
        db.commit()
        print(f"Прогноз для категории {args.category_id}: run_id={run.id}, MAPE={run.mape}, точек={len(points)}")
    finally:
        db.close()


def main() -> None:
    parser = argparse.ArgumentParser(prog="python -m pricing_forecast.cli")
    sub = parser.add_subparsers(dest="command", required=True)

    p_seed = sub.add_parser("seed", help="Наполнить БД синтетическими данными (если она пустая)")
    p_seed.add_argument("--force", action="store_true", help="Наполнить, даже если данные уже есть")
    p_seed.set_defaults(func=cmd_seed)

    p_reseed = sub.add_parser("reseed", help="Удалить и заново создать синтетические данные")
    p_reseed.set_defaults(func=cmd_reseed)

    p_forecast = sub.add_parser("forecast", help="Запустить прогноз для категории вручную")
    p_forecast.add_argument("category_id", type=int)
    p_forecast.set_defaults(func=cmd_forecast)

    args = parser.parse_args()
    args.func(args)


if __name__ == "__main__":
    main()
