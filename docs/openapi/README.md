# OpenAPI-описания сервисов

Файлы не пишутся вручную — они выгружаются из запущенных сервисов, чтобы описание не расходилось с кодом:

```bash
curl -s http://localhost:8081/v3/api-docs.yaml -o docs/openapi/core-api.yaml        # core-service (springdoc)
curl -s http://localhost:8082/openapi.json     -o docs/openapi/pricing-api.json     # pricing-forecast (FastAPI; формат JSON)
```

`payment-api.yaml` для эмулятора пока не формируется: у `payment-emulator` нет springdoc (его API — внешний контракт
из трёх операций, описан в разделе 3.4 записки и в `payment-emulator/README.md`).
Интерактивная документация: `http://localhost:8081/swagger-ui.html` и `http://localhost:8082/docs`.

`pricing-api.json` выгружен из приложения FastAPI (`app.openapi()`, 10 путей) и актуален на дату выгрузки 19.10.2026; `core-api.yaml` — только из запущенного
core-service (springdoc не запускался). Через gateway доступны лишь маршруты `/pricing/{forecast,history,pricing-rules,price/reviews}`.
