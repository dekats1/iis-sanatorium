# sanatorium-iis — прототип ИИС прогнозирования спроса и динамического ценообразования СКУ

Курсовая работа БГУИР, «Интегрированные информационные системы и компоненты». Текст записки (главы 1–2 и далее) — в проекте Claude;
здесь — код прототипа, который эти главы описывают.

## Быстрый показ без Docker (демо-режим)

```bash
cd frontend
npm install
npm run demo        # http://localhost:5173
```

Фронтенд поднимается со встроенным в браузер бэкендом (`frontend/src/mock/`): те же эндпоинты, права ролей и формат ошибок,
что у настоящих сервисов, плюс сгенерированные данные санатория «Беловежские дали» (172 клиента, ~1000 путёвок,
90 номеров, 37 процедур, расписание, отзывы, прогноз спроса, рекомендации цен, аудит). Изменения сохраняются в
localStorage; сбросить — `__resetMock()` в консоли браузера. На странице входа демо-роли выбираются одним кликом
(пароль `demo12345`).

## Состояние

| Каталог | Назначение | Состояние |
|---|---|---|
| `core-service/` | Java 21, Spring Boot, Spring Data JPA/Hibernate: бронирование, оплата, отмена, отчёты, лечебный блок, справочники, пользователи, аудит, JWT | почти полностью (нет переноса брони); **не собирался** |
| `pricing-forecast/` | Python 3.13, FastAPI: прогноз Holt-Winters, гибридное ценообразование, рассмотрение выхода за коридор, consumer RabbitMQ | почти полностью; **не запускался** |
| `payment-emulator/` | Java 21, Spring Boot: эмулятор платёжного сервиса с подписанным вебхуком | готов; **не собирался** |
| `docker/`, `docker-compose.yml`, `.env.example` | PostgreSQL (3 БД), RabbitMQ и все готовые сервисы | **не запускалось** |
| `docs/openapi/` | OpenAPI выгружается из запущенных сервисов (см. README внутри) | описание процедуры |
| `gateway/` | Spring Cloud Gateway (WebFlux): проверка JWT, маршрутизация, лимит попыток входа, CORS, таймауты | готов; **не собирался** (чистые классы проверены javac) |
| `frontend/` | React 19 + TypeScript 7 + Vite 8: страницы по ролям | **собирается** (`npm run build`), 11 модульных тестов vitest проходят |
| `e2e/` | Playwright: 3 сценария (клиент, врач, менеджер) | типы проверены; сценарий клиента и менеджера прогонялись в Chromium только против **заглушки** бэкенда, на настоящей системе — нет |

«Не собирался / не запускался» — в среде разработки этой записки не было доступа к Maven Central и PyPI. Проверены только
классы без зависимостей (подбор номера, подпись вебхука, расчёт ночей и денег) и статически — разрешение собственных импортов.
Первый шаг на своей машине: `mvn verify` в обоих Java-сервисах и `pytest` в `pricing-forecast`.

## Структура

```
sanatorium-iis/
├── core-service/src/main/java/sanatorium/core/
│   ├── CoreApplication, GlobalExceptionHandler, RabbitMQConfig
│   ├── common/         CoreProperties, ApiException, Dtos, Money
│   ├── identity/       JwtTokenProvider, SecurityConfig, LoginController, AuthService, UserService/Controller, Access
│   ├── booking/        BookingService, BookingController, AvailabilityService/Controller,
│   │                   VoucherLifecycleService, VoucherRepository, RoomPlacement, StayDates, FreePlace, Placement
│   ├── payment/        PaymentService, PaymentCallbackController, PaymentEmulatorClient, CallbackSignatureVerifier
│   ├── pricingclient/  PricingClient, QuotedLine, PriceSnapshotRepository, DemandEventPublisher, BookingStatusChanged
│   ├── report/         ReportService, ReportController
│   ├── medical/        AssignmentService, ScheduleService, SlotPlanner, MedicalRepository, AssignmentController
│   ├── client/         ClientRepository, ClientController
│   ├── directory/      DirectoryService (белый список таблиц), DirectoryController
│   ├── audit/          AuditInterceptor, AuditConfig, AuditController
│   └── demo/           DemoDataLoader (профиль demo)
├── pricing-forecast/src/pricing_forecast/
│   ├── main.py, cli.py, config.py, security.py
│   ├── api/            price, reviews, forecast, history, admin, health
│   ├── pricing/        engine.py (цена и коридор), forecaster.py (Holt-Winters)
│   ├── events/         processor.py (идемпотентное применение события), rabbitmq.py (consumer)
│   ├── models/, schemas/, db/
│   └── alembic/ (в корне сервиса), tests/
├── payment-emulator/src/main/java/sanatorium/payment/   PaymentController, PaymentEmulatorService, ApiKeyFilter, PaymentProperties
├── gateway/src/main/java/sanatorium/gateway/   JwtAuthFilter, LoginRateLimitFilter, GatewayRoutes, SlidingWindowLimiter, PublicPaths
├── frontend/src/       api/, hooks/useAuth, components/, pages/ (8 страниц), utils/jwt, types/
└── e2e/                Playwright (tests/, fixtures/)
```

## Запуск

Нужны Docker с Compose v2. Первая сборка Java-образов качает зависимости Maven (несколько минут).

```bash
cp .env.example .env                    # при желании сменить секреты; CORE_PROFILE=demo оставить
docker compose down -v                  # только если запускали раньше: чистая БД, иначе демо-пользователи не создадутся
docker compose up -d --build
docker compose ps                       # все сервисы Up; core-service стартует дольше всех (миграции Flyway)
docker compose logs core-service | grep -i "демо-данные"      # «Демо-данные загружены»
docker compose logs pricing-forecast | grep -i "демо-данные"   # pricing-forecast наполняется сам при старте (PRICING_DEMO_SEED=1); вручную: python -m pricing_forecast.cli seed / reseed
```

Открыть **http://localhost:3000**. Логины: `client`, `admin`, `doctor`, `manager`, `sysadmin`, пароль `demo12345`
(`CORE_DEMO_PASSWORD`). Страница оплаты эмулятора открывается по ссылке из путёвки (порт 8083).

### Демо-данные

Профиль `demo` (`CORE_PROFILE=demo`) и CLI `seed` pricing-forecast создают «живой» санаторий. Генерация детерминированная (фиксированный seed),
все даты считаются от сегодняшнего дня, загрузка идёт пакетными вставками одной транзакцией (несколько секунд), повторный запуск ничего не дублирует
(core-service пропускает набор, если клиентов уже ≥ 100; `docker compose down -v` — чистая БД). Код: `core-service/.../demo/` (`DemoCatalog` — справочники,
`DemoGenerator` — чистый генератор, `DemoDataLoader` — загрузка), `pricing-forecast/src/pricing_forecast/demo_data.py` + `cli.py`.

| Что | Объём |
|---|---|
| Фонд | 6 категорий, 90 номеров в 3 корпусах (А, Б, «Сосновый бор»), статусы карты номеров (занят / бронь / уборка / свободен) выводятся из реальных броней |
| Справочники | 8 лечебных профилей, 16 кабинетов, 36 процедур, 16 заболеваний с противопоказаниями, 7 диет, 7 каналов продаж, 8 организаций |
| Клиенты | 170 (ФИО, телефоны +375, e-mail, даты рождения, заболевания, медкарты); `client` — Иванов Иван с историей из 6 путёвок |
| Путёвки | ≈1,4 тыс. за 18 месяцев назад и 3 месяца вперёд во всех статусах, сезонность (лето, Новый год, майские), без пересечений по местам |
| Деньги | предоплаты 30 %, доплаты, отклонённые и ожидающие платежи, возвраты с удержанием по шкале отмены; цены совпадают с pricing-forecast |
| Лечение | назначения, ≈5,8 тыс. сеансов (сегодня и неделя вперёд — без коллизий кабинетов и гостей), записи врача, лист ожидания |
| Прочее | отзывы с ответами и оценками процедур, лояльность (баланс = сумма операций), склад (часть позиций ниже порога), персонал, пакеты, уведомления, журнал аудита |
| pricing-forecast | 40 сезонов (4 года), 240 тарифов, 240 коридоров цен, 24 месяца истории спроса по 6 категориям (годовая и недельная сезонность), готовые прогнозы на 90 суток, 30 рекомендаций вне коридора (14 ждут решения менеджера) |

Число путёвок задаёт параметр `volume` в `DemoGenerator.Config.of` (по умолчанию 0,75). Проверки генератора без БД: `DemoGeneratorTest` (core-service), `tests/test_demo_data.py` (pricing-forecast).
Для pricing-forecast идентификаторы категорий 1…6 должны совпадать с core-service — это верно на чистой БД (миграция V5 создаёт категории 1…5, загрузчик добавляет «Студию» = 6).
Минимальный запасной набор без профиля demo: `docs/sql/demo-seed-core.sql`.

Порядок и порты: postgres 5432, rabbitmq 5672/15672, payment-emulator 8083, pricing-forecast 8082, core-service 8081,
gateway 8080, frontend 3000. Если что-то не стартует: `docker compose logs <сервис>`.

Разработка фронтенда: `cd frontend && npm install && npm run dev` (http://localhost:5173, нужен запущенный gateway на 8080).
Сквозные тесты: см. `e2e/README.md`. Проверка бэкенда без интерфейса: Postman-коллекция (в поставке отдельным файлом).

Сквозной сценарий СЦ-1: войти как `client` → «Поиск номеров» → «Найти» → «Выбрать» → «Забронировать» → «Перейти к оплате» →
открыть страницу оплаты и нажать «Оплатить» → путёвка `CONFIRMED`; в `pricing-forecast` приходит `booking.confirmed`.
