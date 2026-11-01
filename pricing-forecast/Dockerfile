# Образ используется и API (uvicorn), и consumer'ом RabbitMQ — команда задаётся в docker-compose.yml.
# Не собиралось в среде разработки записки (PyPI и Docker там недоступны) — проверить локально.
FROM python:3.13-slim
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY alembic.ini .
COPY alembic alembic
COPY src src
ENV PYTHONPATH=/app/src
RUN useradd --system --uid 1001 app
USER app
EXPOSE 8082
CMD ["uvicorn", "pricing_forecast.main:app", "--host", "0.0.0.0", "--port", "8082"]
