"""Consumer очереди RabbitMQ booking.confirmed / booking.cancelled (поток 9, раздел 2.5 главы 2).

Запуск отдельным процессом: python -m pricing_forecast.events.rabbitmq
Логика применения события — в events/processor.py (идемпотентна по message_id).
"""
from __future__ import annotations

import json
import logging

import pika
from pika.adapters.blocking_connection import BlockingChannel
from pydantic import ValidationError

from pricing_forecast.config import get_settings
from pricing_forecast.db.session import SessionLocal
from pricing_forecast.events.processor import BookingEvent, apply_booking_event

logger = logging.getLogger("pricing_forecast.consumer")

EXCHANGE = "sanatorium.events"
QUEUE = "pricing.booking_events"
ROUTING_KEYS = ("booking.confirmed", "booking.cancelled")


def _process(body: bytes) -> None:
    try:
        event = BookingEvent(**json.loads(body))
    except (ValidationError, ValueError, TypeError):
        # Сообщение никогда не станет корректным от повторной доставки — не возвращаем в очередь (см. _on_message).
        logger.exception("Некорректное сообщение, отбрасываем: %r", body[:500])
        return

    db = SessionLocal()
    try:
        applied = apply_booking_event(db, event)
        db.commit()
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()
    if applied:
        logger.info("Событие %s обработано: категория=%s, дата=%s", event.event_type, event.category_id, event.stay_date)
    else:
        logger.info("Повторная доставка message_id=%s — игнорируется (идемпотентность)", event.message_id)


def _on_message(channel: BlockingChannel, method, properties, body: bytes) -> None:
    try:
        _process(body)
    except Exception:
        # Временная ошибка (например, БД недоступна): сообщение не теряем. requeue=False отправит его в dead-letter,
        # если политика брокера её задаёт; иначе оно будет отброшено — ограничение прототипа.
        logger.exception("Ошибка обработки сообщения")
        channel.basic_nack(delivery_tag=method.delivery_tag, requeue=False)
        return
    channel.basic_ack(delivery_tag=method.delivery_tag)


def run_consumer() -> None:
    settings = get_settings()
    connection = pika.BlockingConnection(pika.URLParameters(settings.rabbitmq_url))
    channel = connection.channel()
    channel.exchange_declare(exchange=EXCHANGE, exchange_type="topic", durable=True)
    channel.queue_declare(queue=QUEUE, durable=True)
    for key in ROUTING_KEYS:
        channel.queue_bind(exchange=EXCHANGE, queue=QUEUE, routing_key=key)
    channel.basic_qos(prefetch_count=10)
    channel.basic_consume(queue=QUEUE, on_message_callback=_on_message)
    logger.info("Consumer запущен, очередь %s (%s)", QUEUE, ", ".join(ROUTING_KEYS))
    try:
        channel.start_consuming()
    except KeyboardInterrupt:
        channel.stop_consuming()
    finally:
        connection.close()


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
    run_consumer()
