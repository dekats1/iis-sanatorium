"""ORM-модели sanatorium_pricing — зеркало /kursach/ch2/sql/schema_pricing.sql (глава 2, раздел 2.3)."""
from __future__ import annotations

import datetime as dt
import uuid

from sqlalchemy import (CheckConstraint, Date, DateTime, ForeignKey, Numeric,
                         SmallInteger, String, UniqueConstraint)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from pricing_forecast.db.session import Base


class SeasonPeriod(Base):
    __tablename__ = "season_periods"
    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    date_from: Mapped[dt.date] = mapped_column(Date, nullable=False)
    date_to: Mapped[dt.date] = mapped_column(Date, nullable=False)
    k_season: Mapped[float] = mapped_column(Numeric(4, 2), nullable=False)
    __table_args__ = (CheckConstraint("k_season > 0"),)

    tariffs: Mapped[list["Tariff"]] = relationship(back_populates="season")


class Tariff(Base):
    __tablename__ = "tariffs"
    id: Mapped[int] = mapped_column(primary_key=True)
    season_id: Mapped[int] = mapped_column(ForeignKey("season_periods.id"), nullable=False)
    category_id: Mapped[int] = mapped_column(nullable=False)  # логическая ссылка на core.room_categories
    price_base: Mapped[float] = mapped_column(Numeric(10, 2), nullable=False)
    __table_args__ = (
        UniqueConstraint("category_id", "season_id"),
        CheckConstraint("price_base > 0"),
    )

    season: Mapped[SeasonPeriod] = relationship(back_populates="tariffs")


class PriceRule(Base):
    __tablename__ = "price_rules"
    id: Mapped[int] = mapped_column(primary_key=True)
    category_id: Mapped[int] = mapped_column(nullable=False)
    date_from: Mapped[dt.date] = mapped_column(Date, nullable=False)
    date_to: Mapped[dt.date] = mapped_column(Date, nullable=False)
    p_min: Mapped[float] = mapped_column(Numeric(10, 2), nullable=False)
    p_max: Mapped[float] = mapped_column(Numeric(10, 2), nullable=False)
    min_los: Mapped[int] = mapped_column(SmallInteger, nullable=False, default=1)
    closed: Mapped[bool] = mapped_column(default=False)
    __table_args__ = (CheckConstraint("p_min <= p_max"), CheckConstraint("p_min > 0"))


class DemandHistory(Base):
    __tablename__ = "demand_history"
    id: Mapped[int] = mapped_column(primary_key=True)
    category_id: Mapped[int] = mapped_column(nullable=False)
    stay_date: Mapped[dt.date] = mapped_column(Date, nullable=False)
    sold: Mapped[int] = mapped_column(nullable=False)
    available: Mapped[int] = mapped_column(nullable=False)
    __table_args__ = (
        UniqueConstraint("category_id", "stay_date"),
        CheckConstraint("sold >= 0 AND available > 0 AND sold <= available"),
    )


class ForecastRun(Base):
    __tablename__ = "forecast_runs"
    id: Mapped[int] = mapped_column(primary_key=True)
    model: Mapped[str] = mapped_column(String(50), nullable=False)
    mape: Mapped[float | None] = mapped_column(Numeric(6, 2))
    baseline_mape: Mapped[float | None] = mapped_column(Numeric(6, 2))
    created_at: Mapped[dt.datetime] = mapped_column(DateTime(timezone=True), default=dt.datetime.utcnow)

    forecasts: Mapped[list["Forecast"]] = relationship(back_populates="run", cascade="all, delete-orphan")


class Forecast(Base):
    __tablename__ = "forecasts"
    id: Mapped[int] = mapped_column(primary_key=True)
    run_id: Mapped[int] = mapped_column(ForeignKey("forecast_runs.id", ondelete="CASCADE"), nullable=False)
    category_id: Mapped[int] = mapped_column(nullable=False)
    stay_date: Mapped[dt.date] = mapped_column(Date, nullable=False)
    predicted_occ: Mapped[float] = mapped_column(Numeric(5, 2), nullable=False)
    __table_args__ = (
        UniqueConstraint("run_id", "category_id", "stay_date"),
        CheckConstraint("predicted_occ BETWEEN 0 AND 100"),
    )

    run: Mapped[ForecastRun] = relationship(back_populates="forecasts")


class PriceReview(Base):
    """Рассмотрение рекомендации, вышедшей за коридор (ФТ-17, глава 2 раздел 2.1)."""

    __tablename__ = "price_reviews"
    id: Mapped[int] = mapped_column(primary_key=True)
    quote_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), unique=True, nullable=False)
    category_id: Mapped[int] = mapped_column(nullable=False)
    stay_date: Mapped[dt.date] = mapped_column(Date, nullable=False)
    price_recommended: Mapped[float] = mapped_column(Numeric(10, 2), nullable=False)
    price_applied: Mapped[float] = mapped_column(Numeric(10, 2), nullable=False)
    p_min: Mapped[float] = mapped_column(Numeric(10, 2), nullable=False)
    p_max: Mapped[float] = mapped_column(Numeric(10, 2), nullable=False)
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="PENDING_REVIEW")
    created_at: Mapped[dt.datetime] = mapped_column(DateTime(timezone=True), default=dt.datetime.utcnow)
    decided_by: Mapped[str | None] = mapped_column(String(50))
    decided_at: Mapped[dt.datetime | None] = mapped_column(DateTime(timezone=True))
    __table_args__ = (
        CheckConstraint(
            "status IN ('PENDING_REVIEW','ACKNOWLEDGED','RULE_ADJUSTED','AUTO_ACKNOWLEDGED')"
        ),
    )
