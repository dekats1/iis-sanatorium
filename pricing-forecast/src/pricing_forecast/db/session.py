"""Подключение к БД sanatorium_pricing (SQLAlchemy 2.x, стиль 2.0)."""
from collections.abc import Iterator

from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from pricing_forecast.config import get_settings

settings = get_settings()
engine = create_engine(settings.database_url, pool_pre_ping=True, future=True)
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False, future=True)


class Base(DeclarativeBase):
    pass


def get_db() -> Iterator[Session]:
    """Dependency FastAPI: одна сессия на запрос, закрывается после ответа."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
