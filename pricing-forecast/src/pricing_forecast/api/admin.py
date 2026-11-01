"""CRUD тарифов, сезонов и правил коридора цен (ФТ-16). Роль MANAGER."""
from __future__ import annotations

import datetime as dt

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from pricing_forecast.security import CurrentUser, require_manager
from pricing_forecast.db.session import get_db
from pricing_forecast.models.pricing import PriceRule, SeasonPeriod, Tariff

router = APIRouter(prefix="/pricing-rules", tags=["pricing-rules"])


class SeasonIn(BaseModel):
    name: str
    date_from: dt.date
    date_to: dt.date
    k_season: float


class TariffIn(BaseModel):
    season_id: int
    category_id: int
    price_base: float


class PriceRuleIn(BaseModel):
    category_id: int
    date_from: dt.date
    date_to: dt.date
    p_min: float
    p_max: float
    min_los: int = 1
    closed: bool = False


@router.post("/seasons", status_code=status.HTTP_201_CREATED)
def create_season(body: SeasonIn, db: Session = Depends(get_db), _u: CurrentUser = Depends(require_manager)):
    season = SeasonPeriod(**body.model_dump())
    db.add(season)
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        # EXCLUDE USING gist по пересечению дат (раздел 2.3 главы 2) — сезоны не пересекаются
        raise HTTPException(status.HTTP_409_CONFLICT, "Сезонный период пересекается с существующим") from exc
    db.refresh(season)
    return {"id": season.id}


@router.post("/tariffs", status_code=status.HTTP_201_CREATED)
def create_tariff(body: TariffIn, db: Session = Depends(get_db), _u: CurrentUser = Depends(require_manager)):
    tariff = Tariff(**body.model_dump())
    db.add(tariff)
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(status.HTTP_409_CONFLICT, "Тариф для этой категории и сезона уже существует") from exc
    db.refresh(tariff)
    return {"id": tariff.id}


@router.post("/corridors", status_code=status.HTTP_201_CREATED)
def create_price_rule(body: PriceRuleIn, db: Session = Depends(get_db), _u: CurrentUser = Depends(require_manager)):
    if body.p_min > body.p_max:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "p_min не может быть больше p_max")
    rule = PriceRule(**body.model_dump())
    db.add(rule)
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(status.HTTP_409_CONFLICT, "Интервал пересекается с существующим правилом для категории") from exc
    db.refresh(rule)
    return {"id": rule.id}
