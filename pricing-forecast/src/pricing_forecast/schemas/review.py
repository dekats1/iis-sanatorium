"""Схемы для СЦ-2 «Рассмотрение рекомендаций вне коридора» (ФТ-17)."""
from __future__ import annotations

import datetime as dt
import uuid

from pydantic import BaseModel


class PriceReviewOut(BaseModel):
    id: int
    quote_id: uuid.UUID
    category_id: int
    stay_date: dt.date
    price_recommended: float
    price_applied: float
    p_min: float
    p_max: float
    status: str
    created_at: dt.datetime
    decided_by: str | None
    decided_at: dt.datetime | None

    class Config:
        from_attributes = True


class ReviewDecision(BaseModel):
    action: str  # "ACKNOWLEDGE" | "RULE_ADJUSTED" — второе применяется, если менеджер
    # в этом же обращении изменил price_rules (см. api/rules.py); сам факт решения
    # всегда пишется в price_reviews с автором и временем (ФТ-20).
