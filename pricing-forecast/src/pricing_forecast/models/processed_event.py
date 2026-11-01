"""Таблица идемпотентности для событий брокера (раздел 2.5 главы 2)."""
from __future__ import annotations

import datetime as dt

from sqlalchemy import DateTime, String
from sqlalchemy.orm import Mapped, mapped_column

from pricing_forecast.db.session import Base


class ProcessedEvent(Base):
    __tablename__ = "processed_events"
    message_id: Mapped[str] = mapped_column(String(100), primary_key=True)
    received_at: Mapped[dt.datetime] = mapped_column(DateTime(timezone=True))
