# core-service

Ядро ИИС санатория (Java 21, Spring Boot): поиск мест с динамической ценой, оформление путёвки,
оплата через платёжный сервис, отмена и истечение срока оплаты, отчёты KPI, лечебный блок, справочники, пользователи и аудит. Реализует сценарий СЦ-1 и
часть СЦ-4 из главы 1; схема БД — глава 2 (`db/migration/V1__init_schema.sql` — без изменений из `ch2/sql/schema_core.sql`).

> Код написан в среде без доступа к Maven Central: **ни разу не собирался и не запускался**.
> Проверены только классы без зависимостей (подбор номера, подпись вебхука, расчёт ночей/денег — см. `src/test`)
> через `javac`; остальное — по документации и памяти автора. Первый шаг на локальной машине: `mvn verify`.

## Доступ к данным: Spring Data JPA / Hibernate

- Сущности (`@Entity`) лежат в пакетах по предметным областям; ссылки между агрегатами (клиент, канал, профиль, категория…)
  хранятся идентификаторами, без ленивых связей. Связи N:M — `@ManyToMany` (пользователь — роли) и `@ElementCollection`
  (процедура — профили и противопоказания); составные ключи — `@EmbeddedId`.
- Репозитории — `JpaRepository`; блокировки — `@Lock(PESSIMISTIC_WRITE)` (путёвка, платёж, кабинеты, пользователь при смене ролей),
  `SKIP LOCKED` при истечении срока оплаты.
- Нативный SQL оставлен только там, где JPA не умеет: `generate_series` и `daterange` (поиск свободных мест, вставка в
  `booking_places` с ограничением EXCLUDE), атомарный UPSERT `price_snapshot`, расчёт KPI с пересечением диапазонов.
- Схему ведёт Flyway (`ddl-auto: none`). **Проверка `ddl-auto: validate` не выполнялась** — после первой сборки включите её и
  поправьте возможные расхождения типов (SMALLINT отображён на `Integer`, `CHAR(3)` — на `String`).
- Пагинация списков — параметры `page` (с нуля) и `size` (1–200): `/api/clients`, `/api/users`, `/api/audit`.
- Справочники: по одному пути на справочник — `/api/directory/{room-categories|rooms|treatment-profiles|cabinets|procedures|diets|sales-channels|medical-conditions|customers}`,
  поля в camelCase (`capacityTotal`, `roomNumber`, `slotsPerDay`, …).

## Что реализовано

| Эндпоинт | Роль | Назначение |
|---|---|---|
| `POST /api/auth/login`, `/register` | все | JWT HS256; саморегистрация клиента |
| `GET /api/availability?from&to&places` | CLIENT, BOOKING_ADMIN, MANAGER | свободные места по категориям + цена из pricing-forecast (или резервный снимок) |
| `POST /api/vouchers` | CLIENT, BOOKING_ADMIN | оформление: проверка наличия → фиксация цены → размещение в одной транзакции |
| `GET /api/vouchers/my`, `/{id}` | CLIENT, BOOKING_ADMIN | путёвки (клиент видит только свои) |
| `POST /api/vouchers/{id}/pay` | CLIENT, BOOKING_ADMIN | счёт предоплаты в платёжном сервисе |
| `POST /api/payments/callback` | подпись HMAC | вебхук: подтверждение брони, событие `booking.confirmed` |
| `POST /api/vouchers/{id}/cancel` | CLIENT, BOOKING_ADMIN | отмена, возврат, событие `booking.cancelled` |
| `GET /api/reports/kpi`, `/channels` | MANAGER | Occ/ADR/RevPAR (Q3), выручка по каналам (Q4) |

OpenAPI: `/v3/api-docs`, Swagger UI: `/swagger-ui.html` (springdoc).

## Дополнительно реализовано

| Эндпоинт | Роль | Назначение |
|---|---|---|
| `POST /api/vouchers/{id}/check-in`, `/check-out` | BOOKING_ADMIN | заезд и выезд (ФТ-10) |
| `/api/waitlist` (POST, `GET /my`, `DELETE /{id}`) | CLIENT, BOOKING_ADMIN | лист ожидания |
| `/api/clients` (POST, GET, `/{id}`, PUT) | BOOKING_ADMIN; чтение и состояния здоровья — также DOCTOR | карточки клиентов, поиск с пагинацией |
| `/api/clients/{id}/conditions` (GET, POST, DELETE) | DOCTOR, BOOKING_ADMIN | состояния здоровья (основа проверки противопоказаний) |
| `POST /api/assignments`, `GET /by-voucher/{id}`, `POST /{id}/schedule`, `GET /schedule`, `POST /schedule/{id}/done` | DOCTOR (by-voucher — и BOOKING_ADMIN) | назначения, проверка противопоказаний (409 + `warnings`), построение расписания (`SlotPlanner`), отметка выполнения |
| `/api/directory/{resource}` (GET; POST, PUT, DELETE) | чтение — любой вошедший (заказчики — только сотрудники); запись — SYSADMIN | справочники: категории, номера, профили, кабинеты, процедуры, диеты, каналы, состояния, заказчики; связи процедур (профили, противопоказания) |
| `/api/users` (GET, POST, `PUT /{id}/roles`, `/active`, `/password`) | SYSADMIN | сотрудники и роли; нельзя деактивировать себя или снять с себя SYSADMIN |
| `GET /api/audit` | SYSADMIN | журнал изменяющих запросов (метод, путь, код, пользователь; тела не пишутся) |

Отмена считает штраф по ступеням `CancellationCalculator` (проценты — проектное допущение автора).

## Не реализовано (честный список)

- Перенос брони (ФТ-09 закрыт только отменой со штрафом).
- Transactional outbox для событий брокера (сейчас — публикация после коммита; при падении брокера событие теряется).
- Бронь размещается только в одном номере (без дробления по номерам); `vouchers.quote_id` хранит id первой ночи.
- Деактивация пользователя не отзывает уже выданный JWT (действует до `ttl-minutes`).
- Интеграционные тесты со Spring-контекстом и Testcontainers; ограничение числа попыток входа.
- Тесты на БД (репозитории JPA, транзакции, блокировки, гонка за места) — нужны Testcontainers; не писались. Тесты на БД для новых сервисов (справочники, пользователи, аудит, медицинский блок) — проверены только чистые классы (`SlotPlanner`, `CancellationCalculator`).

## Запуск

```bash
docker compose up -d                      # из каталога code/: PostgreSQL + RabbitMQ
cd core-service
mvn spring-boot:run -Dspring-boot.run.profiles=demo   # Flyway создаст схему; demo загрузит справочники и пользователей
```

Демо-пользователи (пароль `core.demo.password`, по умолчанию `demo12345`, только для разработки):
`admin` (BOOKING_ADMIN), `doctor`, `manager` (MANAGER), `sysadmin`, `client` (CLIENT).

Переменные окружения: `CORE_DB_URL`, `CORE_DB_USER`, `CORE_DB_PASSWORD`, `CORE_JWT_SECRET` (≥ 32 байт, тот же, что
`PRICING_JWT_SECRET`), `CORE_PRICING_URL`, `CORE_PAYMENT_URL`, `CORE_PAYMENT_API_KEY`, `CORE_PAYMENT_WEBHOOK_SECRET`,
`RABBITMQ_*`. Значения по умолчанию в `application.yml` — только для разработки.

## Тесты

```bash
mvn test
```
