"""Применение событий брокера booking.confirmed / booking.cancelled к demand_history (поток 9, раздел 2.5 главы 2).

Один обработчик используется consumer'ом RabbitMQ (events/rabbitmq.py) и тестами.

Идемпотентность и конкурентность: дубликат отсекается атомарно — INSERT в processed_events с ON CONFLICT DO NOTHING
(PRIMARY KEY message_id), а не «прочитал — вставил», поэтому два consumer'а не обработают одно сообщение дважды.
Счётчик sold меняется одним UPSERT-ом с арифметикой на стороне БД — параллельные события по одной дате не теряют
обновления (в отличие от «прочитал — прибавил — записал»).
"""
from __future__ import annotations

import datetime as dt

from pydantic import BaseModel, Field
from sqlalchemy import func
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.orm import Session

from pricing_forecast.models.pricing import DemandHistory
from pricing_forecast.models.processed_event import ProcessedEvent


class BookingEvent(BaseModel):
    """Формат сообщения; публикует core-service (pricingclient/DemandEventPublisher)."""

    message_id: str = Field(min_length=1, max_length=100)  # уникальный id для идемпотентности
    event_type: str = Field(pattern=r"^booking\.(confirmed|cancelled)$")
    category_id: int
    stay_date: dt.date
    places: int = Field(gt=0)      # число мест-суток на эту дату
    available: int = Field(gt=0)   # вместимость категории на дату (N_дост, формула 1.1 главы 1)


def apply_booking_event(db: Session, event: BookingEvent) -> bool:
    """Применяет событие. Возвращает False, если это повторная доставка (ничего не изменено). Коммит — на вызывающем."""
    inserted = db.execute(
        pg_insert(ProcessedEvent)
        .values(message_id=event.message_id, received_at=dt.datetime.now(dt.timezone.utc))
        .on_conflict_do_nothing(index_elements=["message_id"])
    )
    if inserted.rowcount == 0:
        return False

    delta = event.places if event.event_type == "booking.confirmed" else -event.places
    stmt = pg_insert(DemandHistory).values(
        category_id=event.category_id,
        stay_date=event.stay_date,
        sold=min(max(0, delta), event.available),
        available=event.available,
    )
    stmt = stmt.on_conflict_do_update(
        index_elements=["category_id", "stay_date"],
        set_={
            # sold = clamp(sold + delta, 0, available) — ограничение CHECK sold <= available не нарушается
            "sold": func.least(func.greatest(DemandHistory.sold + delta, 0), stmt.excluded.available),
            "available": stmt.excluded.available,
        },
    )
    db.execute(stmt)
    return True
