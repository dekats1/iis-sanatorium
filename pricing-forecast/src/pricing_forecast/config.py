"""Конфигурация сервиса pricing-forecast из переменных окружения."""
from functools import lru_cache
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_prefix="PRICING_", env_file=".env", extra="ignore")

    database_url: str = "postgresql+psycopg2://pricing:pricing@localhost:5432/sanatorium_pricing"

    # Проверка JWT (HS256), ключ общий с core-service (см. главу 2, раздел 2.4)
    jwt_secret: str = "dev-only-shared-secret-change-me-0123456789"
    jwt_algorithm: str = "HS256"

    # Гибридное ценообразование (раздел 2.1 главы 2)
    quote_ttl_minutes: int = 30
    review_auto_ack_hours: int = 24

    # Параметры прогноза (Holt-Winters, раздел 3.7 главы 3)
    forecast_seasonal_periods: int = 7
    forecast_horizon_days: int = 90

    # Внешний URL core-service для доставки price_snapshot при недоступности брокера (резерв)
    core_service_base_url: str = "http://core-service:8081"

    # Брокер сообщений (раздел 2.5 главы 2 — только события booking.confirmed/cancelled)
    rabbitmq_url: str = "amqp://guest:guest@localhost:5672/%2F"


@lru_cache
def get_settings() -> Settings:
    return Settings()
