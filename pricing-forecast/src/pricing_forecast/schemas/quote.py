"""Pydantic-схемы для POST /price/quote/batch (поток 4-5, раздел 2.5 главы 2)."""
from __future__ import annotations

import datetime as dt
import uuid

from pydantic import BaseModel, Field


class QuoteLineRequest(BaseModel):
    category_id: int
    stay_date: dt.date


class QuoteBatchRequest(BaseModel):
    lines: list[QuoteLineRequest] = Field(min_length=1, max_length=366)
    fix_quote: bool = Field(
        default=False,
        description="true при оформлении брони (создаёт quote_id и, если нужно, "
        "запись price_reviews); false при поиске мест — только предпросмотр цены",
    )


class QuoteLineResponse(BaseModel):
    category_id: int
    stay_date: dt.date
    price: float
    out_of_corridor: bool
    quote_id: uuid.UUID | None
    fallback: bool = False


class QuoteBatchResponse(BaseModel):
    lines: list[QuoteLineResponse]
    expires_at: dt.datetime | None = Field(
        default=None, description="Срок действия зафиксированных quote_id (30 мин, раздел 2.1)"
    )
