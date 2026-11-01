"""POST /price/quote/batch — поток 4 раздела 2.5 главы 2.

Core-service присылает список (category_id, stay_date) и получает цену на
каждую позицию за один вызов (пакетный запрос — НФТ-02: расчёт цены не более
3 секунд на 95-м перцентиле, батч дешевле N отдельных запросов).
"""
from __future__ import annotations

import datetime as dt
from decimal import Decimal

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from pricing_forecast.config import Settings, get_settings
from pricing_forecast.pricing.engine import build_review, calculate_price
from pricing_forecast.security import CurrentUser, require_service
from pricing_forecast.db.session import get_db
from pricing_forecast.models.pricing import PriceRule, SeasonPeriod, Tariff
from pricing_forecast.schemas.quote import QuoteBatchRequest, QuoteBatchResponse, QuoteLineResponse

router = APIRouter(prefix="/price", tags=["price"])


def _find_tariff_and_season(db: Session, category_id: int, stay_date: dt.date) -> tuple[Tariff, SeasonPeriod] | None:
    season = db.execute(
        select(SeasonPeriod).where(SeasonPeriod.date_from <= stay_date, SeasonPeriod.date_to >= stay_date)
    ).scalar_one_or_none()
    if season is None:
        return None
    tariff = db.execute(
        select(Tariff).where(Tariff.category_id == category_id, Tariff.season_id == season.id)
    ).scalar_one_or_none()
    if tariff is None:
        return None
    return tariff, season


def _find_rule(db: Session, category_id: int, stay_date: dt.date) -> PriceRule | None:
    return db.execute(
        select(PriceRule).where(
            PriceRule.category_id == category_id,
            PriceRule.date_from <= stay_date,
            PriceRule.date_to >= stay_date,
        )
    ).scalar_one_or_none()


def _latest_predicted_occ(db: Session, category_id: int, stay_date: dt.date) -> Decimal | None:
    from pricing_forecast.models.pricing import Forecast, ForecastRun

    row = db.execute(
        select(Forecast.predicted_occ)
        .join(ForecastRun, ForecastRun.id == Forecast.run_id)
        .where(Forecast.category_id == category_id, Forecast.stay_date == stay_date)
        .order_by(ForecastRun.created_at.desc())
        .limit(1)
    ).scalar_one_or_none()
    return Decimal(row) if row is not None else None


@router.post("/quote/batch", response_model=QuoteBatchResponse)
def quote_batch(
    body: QuoteBatchRequest,
    db: Session = Depends(get_db),
    settings: Settings = Depends(get_settings),
    _user: CurrentUser = Depends(require_service),
) -> QuoteBatchResponse:
    lines: list[QuoteLineResponse] = []
    for ln in body.lines:
        found = _find_tariff_and_season(db, ln.category_id, ln.stay_date)
        if found is None:
            # Нет тарифа/сезона на дату — цена недоступна; ядро обязано применить
            # резервный снимок или сообщить "цена недоступна" (принцип 4, раздел 2.1)
            lines.append(QuoteLineResponse(
                category_id=ln.category_id, stay_date=ln.stay_date,
                price=0, out_of_corridor=False, quote_id=None, fallback=True,
            ))
            continue
        tariff, season = found
        rule = _find_rule(db, ln.category_id, ln.stay_date)
        predicted_occ = _latest_predicted_occ(db, ln.category_id, ln.stay_date)

        quote = calculate_price(
            category_id=ln.category_id, stay_date=ln.stay_date, tariff=tariff,
            season_k=Decimal(season.k_season), rule=rule, predicted_occ=predicted_occ,
            fix_quote=body.fix_quote,
        )

        if quote.quote_id and quote.out_of_corridor:
            db.add(build_review(quote, quote.quote_id))

        lines.append(QuoteLineResponse(
            category_id=ln.category_id, stay_date=ln.stay_date, price=float(quote.price_applied),
            out_of_corridor=quote.out_of_corridor, quote_id=quote.quote_id, fallback=False,
        ))

    if body.fix_quote:
        db.commit()

    expires_at = (
        dt.datetime.utcnow() + dt.timedelta(minutes=settings.quote_ttl_minutes)
        if body.fix_quote else None
    )
    return QuoteBatchResponse(lines=lines, expires_at=expires_at)
