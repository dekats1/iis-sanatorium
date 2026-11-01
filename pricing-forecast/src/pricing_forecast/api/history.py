"""История спроса (demand_history): загрузка и чтение менеджером (ФТ-15, вход прогноза).

Реальных данных санатория нет (ограничение, раздел 1.2 главы 1): историю загружают обезличенной выгрузкой
или генерируют командой CLI «seed». Событийное пополнение истории — events/processor.py.
"""
from __future__ import annotations

import datetime as dt

from typing import Annotated

from fastapi import APIRouter, Body, Depends, status
from pydantic import BaseModel, Field, model_validator
from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.orm import Session

from pricing_forecast.db.session import get_db
from pricing_forecast.models.pricing import DemandHistory
from pricing_forecast.security import CurrentUser, require_manager

router = APIRouter(prefix="/history", tags=["history"])


class HistoryPoint(BaseModel):
    stay_date: dt.date
    sold: int = Field(ge=0)
    available: int = Field(gt=0)

    @model_validator(mode="after")
    def _sold_not_above_available(self) -> "HistoryPoint":
        if self.sold > self.available:
            raise ValueError("sold не может быть больше available")
        return self


@router.post("/{category_id}", status_code=status.HTTP_200_OK)
def upload_history(
    category_id: int,
    points: Annotated[list[HistoryPoint], Body(min_length=1, max_length=1000)],
    db: Session = Depends(get_db),
    _user: CurrentUser = Depends(require_manager),
) -> dict:
    """Пакетная загрузка/обновление фактических продаж по суткам (UPSERT по category_id + stay_date)."""
    rows = [{"category_id": category_id, **p.model_dump()} for p in points]
    stmt = pg_insert(DemandHistory).values(rows)
    stmt = stmt.on_conflict_do_update(
        index_elements=["category_id", "stay_date"],
        set_={"sold": stmt.excluded.sold, "available": stmt.excluded.available},
    )
    db.execute(stmt)
    db.commit()
    return {"upserted": len(rows)}


@router.get("/{category_id}", response_model=list[HistoryPoint])
def get_history(
    category_id: int,
    date_from: dt.date,
    date_to: dt.date,
    db: Session = Depends(get_db),
    _user: CurrentUser = Depends(require_manager),
) -> list[HistoryPoint]:
    rows = db.execute(
        select(DemandHistory.stay_date, DemandHistory.sold, DemandHistory.available)
        .where(DemandHistory.category_id == category_id, DemandHistory.stay_date.between(date_from, date_to))
        .order_by(DemandHistory.stay_date)
    ).all()
    return [HistoryPoint(stay_date=r.stay_date, sold=r.sold, available=r.available) for r in rows]
