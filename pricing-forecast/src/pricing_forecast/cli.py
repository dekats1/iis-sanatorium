"""CLI для первичного наполнения и обслуживания сервиса pricing-forecast.

Команды:
    python -m pricing_forecast.cli seed      — демо-данные: сезоны (4 года), тарифы и коридоры цен по 6 категориям,
                                                24 месяца истории спроса, готовые прогнозы на 90 суток и рекомендации
                                                цены вне коридора на рассмотрение менеджера (идемпотентно: повторный
                                                запуск при наличии данных ничего не меняет)
    python -m pricing_forecast.cli reseed    — удалить и заново создать демо-данные
    python -m pricing_forecast.cli forecast CATEGORY_ID
                                              — запустить прогноз для категории вручную

Данные синтетические (реальных данных санатория нет — ограничения главы 1, п. 1.2.1), детерминированные (seed) и считаются
от сегодняшней даты; модель описана в demo_data.py. Идентификаторы категорий 1..6 соответствуют core-service.

Вынесено в CLI (а не в HTTP API) по замечанию о безопасности: наполнение тестовыми
данными через открытый HTTP-эндпоинт в проде недопустимо (НФТ-04 — защита данных).
"""
from __future__ import annotations

import argparse
import datetime as dt
import sys
import warnings

import numpy as np
import pandas as pd
from sqlalchemy import insert

from pricing_forecast.demo_data import (
    CATEGORY_BASE_PRICE,
    CATEGORY_IDS,
    corridor_rows,
    history_rows,
    review_rows,
    season_rows,
)
from pricing_forecast.pricing.forecaster import forecast_occupancy
from pricing_forecast.db.session import Base, SessionLocal, engine
from pricing_forecast.models.pricing import (
    DemandHistory,
    Forecast,
    ForecastRun,
    PriceReview,
    PriceRule,
    SeasonPeriod,
    Tariff,
)

MODEL_NAME = "holt_winters_additive_trend_mul_seasonal"


def _baseline_mape(frame: pd.DataFrame) -> float | None:
    """MAPE сезонного наивного прогноза (значение недельной давности) на последних 14 сутках — для сравнения с моделью."""
    occ = (frame["sold"] / frame["available"] * 100.0).to_numpy()
    if len(occ) < 28:
        return None
    actual, naive = occ[-14:], occ[-21:-7]
    return float(np.mean(np.abs((actual - naive) / np.maximum(actual, 1e-3))) * 100)


def cmd_seed(args: argparse.Namespace) -> None:
    from pricing_forecast.config import get_settings

    settings = get_settings()
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        if db.query(SeasonPeriod).count() > 0 and not args.force:
            print("Данные уже существуют. Используйте reseed для пересоздания.", file=sys.stderr)
            return

        today = dt.date.today()
        now = dt.datetime.now(dt.timezone.utc)

        seasons = [SeasonPeriod(name=r["name"], date_from=r["date_from"], date_to=r["date_to"], k_season=r["k_season"])
                   for r in season_rows(today)]
        db.add_all(seasons)
        db.flush()

        tariffs = [{"season_id": season.id, "category_id": cat_id, "price_base": CATEGORY_BASE_PRICE[cat_id]}
                   for season in seasons for cat_id in CATEGORY_IDS]
        db.execute(insert(Tariff), tariffs)

        rules = [{k: v for k, v in r.items()} for r in corridor_rows(today)]
        db.execute(insert(PriceRule), rules)

        history = history_rows(today)
        db.execute(insert(DemandHistory), history)

        # готовые прогнозы на horizon суток для каждой категории (тот же алгоритм, что в POST /forecast/{id}/run)
        forecasts_total = 0
        for cat_id in CATEGORY_IDS:
            frame = pd.DataFrame([r for r in history if r["category_id"] == cat_id])[["stay_date", "sold", "available"]]
            try:
                with warnings.catch_warnings():
                    warnings.simplefilter("ignore")  # предупреждения сходимости statsmodels в логах контейнера не нужны
                    points, mape = forecast_occupancy(frame, settings.forecast_horizon_days, settings.forecast_seasonal_periods)
            except Exception as exc:  # статистическая модель не должна ломать наполнение справочников
                print(f"Прогноз для категории {cat_id} пропущен: {exc}", file=sys.stderr)
                continue
            baseline = _baseline_mape(frame)
            run = ForecastRun(
                model=MODEL_NAME,
                mape=round(mape, 2) if mape == mape else None,
                baseline_mape=round(baseline, 2) if baseline is not None else None,
                created_at=now,
            )
            db.add(run)
            db.flush()
            db.execute(insert(Forecast), [{"run_id": run.id, "category_id": cat_id, "stay_date": p.stay_date,
                                           "predicted_occ": p.predicted_occ} for p in points])
            forecasts_total += len(points)

        reviews = review_rows(today, now)
        db.execute(insert(PriceReview), reviews)

        db.commit()
        pending = sum(1 for r in reviews if r["status"] == "PENDING_REVIEW")
        print(f"Демо-данные pricing-forecast созданы: {len(seasons)} сезонов, {len(tariffs)} тарифов, {len(rules)} коридоров, "
              f"{len(history)} суток истории спроса, {forecasts_total} точек прогноза, "
              f"{len(reviews)} рекомендаций вне коридора (на рассмотрении: {pending}).")
    finally:
        db.close()


def cmd_reseed(args: argparse.Namespace) -> None:
    db = SessionLocal()
    try:
        db.query(PriceReview).delete()
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
