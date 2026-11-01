"""GET/POST рассмотрения рекомендаций вне коридора (СЦ-2, ФТ-17). Роль MANAGER."""
from __future__ import annotations

import datetime as dt

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from pricing_forecast.security import CurrentUser, require_manager
from pricing_forecast.db.session import get_db
from pricing_forecast.models.pricing import PriceReview
from pricing_forecast.schemas.review import PriceReviewOut, ReviewDecision

router = APIRouter(prefix="/price/reviews", tags=["price-reviews"])


@router.get("", response_model=list[PriceReviewOut])
def list_reviews(
    status_filter: str | None = None,
    db: Session = Depends(get_db),
    _user: CurrentUser = Depends(require_manager),
) -> list[PriceReview]:
    q = select(PriceReview).order_by(PriceReview.created_at.desc())
    if status_filter:
        q = q.where(PriceReview.status == status_filter)
    return list(db.execute(q).scalars())


@router.post("/{review_id}/decide", response_model=PriceReviewOut)
def decide_review(
    review_id: int,
    body: ReviewDecision,
    db: Session = Depends(get_db),
    user: CurrentUser = Depends(require_manager),
) -> PriceReview:
    review = db.get(PriceReview, review_id)
    if review is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Запись не найдена")
    if review.status != "PENDING_REVIEW":
        raise HTTPException(status.HTTP_409_CONFLICT, "Запись уже рассмотрена")
    if body.action not in ("ACKNOWLEDGE", "RULE_ADJUSTED"):
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "Недопустимое действие")

    review.status = "ACKNOWLEDGED" if body.action == "ACKNOWLEDGE" else "RULE_ADJUSTED"
    review.decided_by = user.sub
    review.decided_at = dt.datetime.utcnow()
    db.commit()
    db.refresh(review)
    return review
