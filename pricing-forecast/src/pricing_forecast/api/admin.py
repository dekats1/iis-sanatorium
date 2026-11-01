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


@router.get("/seasons")
def list_seasons(db: Session = Depends(get_db), _u: CurrentUser = Depends(require_manager)):
    rows = db.query(SeasonPeriod).order_by(SeasonPeriod.date_from).all()
    return [
        {"id": s.id, "name": s.name, "date_from": s.date_from, "date_to": s.date_to, "k_season": float(s.k_season)}
        for s in rows
    ]


@router.get("/tariffs")
def list_tariffs(
    season_id: int | None = None,
    category_id: int | None = None,
    db: Session = Depends(get_db),
    _u: CurrentUser = Depends(require_manager),
):
    q = db.query(Tariff)
    if season_id is not None:
        q = q.filter(Tariff.season_id == season_id)
    if category_id is not None:
        q = q.filter(Tariff.category_id == category_id)
    return [
        {"id": t.id, "season_id": t.season_id, "category_id": t.category_id, "price_base": float(t.price_base)}
        for t in q.order_by(Tariff.season_id, Tariff.category_id).all()
    ]


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
