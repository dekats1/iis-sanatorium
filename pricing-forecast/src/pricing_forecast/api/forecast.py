"""GET/POST прогноза спроса (ФТ-15). Роль MANAGER."""
from __future__ import annotations

import datetime as dt

import pandas as pd
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from pricing_forecast.config import Settings, get_settings
from pricing_forecast.pricing.forecaster import forecast_occupancy
from pricing_forecast.security import CurrentUser, require_manager
from pricing_forecast.db.session import get_db
from pricing_forecast.models.pricing import DemandHistory, Forecast, ForecastRun

router = APIRouter(prefix="/forecast", tags=["forecast"])

MIN_HISTORY_DAYS = 28  # 2 * seasonal_periods(7) + holdout(14), раздел 3.7 главы 3


@router.post("/{category_id}/run", status_code=status.HTTP_201_CREATED)
def run_forecast(
    category_id: int,
    db: Session = Depends(get_db),
    settings: Settings = Depends(get_settings),
    _user: CurrentUser = Depends(require_manager),
) -> dict:
    rows = db.execute(
        select(DemandHistory.stay_date, DemandHistory.sold, DemandHistory.available)
        .where(DemandHistory.category_id == category_id)
        .order_by(DemandHistory.stay_date)
    ).all()
    if len(rows) < MIN_HISTORY_DAYS:
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_ENTITY,
            f"Недостаточно истории спроса: {len(rows)} суток, нужно не менее {MIN_HISTORY_DAYS} "
            "(альтернативный поток 2а сценария СЦ-4)",
        )
    history = pd.DataFrame(rows, columns=["stay_date", "sold", "available"])
    points, mape = forecast_occupancy(history, settings.forecast_horizon_days, settings.forecast_seasonal_periods)

    run = ForecastRun(model="holt_winters_additive_trend_mul_seasonal", mape=round(mape, 2) if mape == mape else None)
    db.add(run)
    db.flush()
    db.add_all(
        Forecast(run_id=run.id, category_id=category_id, stay_date=p.stay_date, predicted_occ=p.predicted_occ)
        for p in points
    )
    db.commit()
    return {"run_id": run.id, "mape": run.mape, "points": len(points)}


@router.get("/{category_id}")
def get_forecast(
    category_id: int,
    date_from: dt.date,
    date_to: dt.date,
    db: Session = Depends(get_db),
    _user: CurrentUser = Depends(require_manager),
) -> list[dict]:
    rows = db.execute(
        select(Forecast.stay_date, Forecast.predicted_occ, ForecastRun.created_at)
        .join(ForecastRun, ForecastRun.id == Forecast.run_id)
        .where(Forecast.category_id == category_id, Forecast.stay_date.between(date_from, date_to))
        .order_by(Forecast.stay_date, ForecastRun.created_at.desc())
    ).all()
    seen: set[dt.date] = set()
    out = []
    for stay_date, predicted_occ, _created in rows:
        if stay_date in seen:
            continue  # берём самый свежий прогон на дату (сортировка по created_at desc)
        seen.add(stay_date)
        out.append({"stay_date": stay_date, "predicted_occ": float(predicted_occ)})
    return out
