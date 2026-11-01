"""Точка входа FastAPI-приложения pricing-forecast.

Роутеры (поток 4–5, 9 раздела 2.5 главы 2; раздел 3.3 главы 3):
- /price/quote/batch  — расчёт рекомендованной/коридорной цены (СЦ-1)           api/price.py
- /price/reviews      — рассмотрение рекомендаций вне коридора (СЦ-2)            api/reviews.py
- /forecast           — запуск и чтение прогноза спроса (СЦ-4)                   api/forecast.py
- /history            — загрузка и чтение истории спроса                         api/history.py
- /pricing-rules      — тарифы, сезоны, коридоры (ФТ-16)                         api/admin.py
- /health             — проверка живости                                         api/health.py
События брокера принимает отдельный процесс events/rabbitmq.py.
"""
from __future__ import annotations

import logging

from fastapi import FastAPI, Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse

from pricing_forecast.api import admin, forecast, health, history, price, reviews

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
logger = logging.getLogger("pricing_forecast")

app = FastAPI(
    title="pricing-forecast",
    description=(
        "Сервис прогнозирования спроса и динамического ценообразования "
        "(гибридная модель, раздел 2.1 главы 2; алгоритмы — раздел 3.7 главы 3)."
    ),
    version="0.1.0",
)

for module in (price, reviews, forecast, history, admin, health):
    app.include_router(module.router)


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError) -> JSONResponse:
    # Единый формат ошибок валидации входных данных (НФТ-05)
    logger.warning("Ошибка валидации запроса %s %s: %s", request.method, request.url.path, exc.errors())
    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content={"detail": "Некорректные входные данные", "errors": exc.errors()},
    )
