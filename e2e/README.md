# e2e: сквозные тесты Playwright

Тесты идут против **запущенной** системы и используют демо-пользователей. Без них вход невозможен (в БД пользователей нет).

## Откуда берутся пользователи

Их создаёт `DemoDataLoader` в core-service, но только если одновременно выполнены два условия:
1. включён профиль `demo` (`SPRING_PROFILES_ACTIVE=demo`; в docker compose это `CORE_PROFILE=demo`, значение по умолчанию);
2. в таблице пользователей **пусто**. Если в БД уже есть хотя бы один пользователь (например, кто-то зарегистрировался в приложении,
   запущенном без профиля demo), загрузчик пропускает работу.

Загрузчик создаёт: `admin`, `doctor`, `manager`, `sysadmin`, `client` (пароль `demo12345`, меняется `CORE_DEMO_PASSWORD`), категории и номера,
лечебные профили, диеты, каналы продаж, кабинеты, 4 процедуры и 3 состояния здоровья.

## Запуск в docker compose

```bash
cp .env.example .env                       # CORE_PROFILE=demo уже указан
docker compose down -v                     # ЧИСТАЯ БД: иначе загрузчик увидит старых пользователей и пропустит загрузку
docker compose up -d --build
docker compose logs core-service | grep -i "демо-данные"      # ждём «Демо-данные загружены»
docker compose exec pricing-forecast python -m pricing_forecast.cli seed   # тарифы, коридоры, история спроса

cd e2e
npm install
npx playwright install chromium            # один раз
npx playwright test                        # по умолчанию http://localhost:3000 (nginx фронтенда)
```

## Запуск, если сервисы стартуют из IDE, а не в docker

1. PostgreSQL с тремя БД и RabbitMQ можно поднять из compose: `docker compose up -d postgres rabbitmq`.
2. core-service: переменная `SPRING_PROFILES_ACTIVE=demo` в конфигурации запуска IDE; в БД `sanatorium_core` не должно быть пользователей
   (иначе пересоздайте БД: `docker compose down -v && docker compose up -d postgres rabbitmq`).
3. pricing-forecast, payment-emulator, gateway — как в README каждого сервиса; затем команда `cli seed` для pricing-forecast.
4. Фронтенд: `cd frontend && npm run dev`, тесты: `E2E_BASE_URL=http://localhost:5173 npx playwright test`.

## Если «пользователей нет»

Проверка: `docker compose exec postgres psql -U core -d sanatorium_core -c "select username from users;"` (имя таблицы — по миграции V1).
- Пусто и в логах нет «Демо-данные загружены» — профиль `demo` не включён.
- Есть пользователи, но не демо — загрузчик пропустил запуск; пересоздайте БД (`down -v`).
- Демо-пользователи есть, но вход не проходит — проверьте пароль (`CORE_DEMO_PASSWORD`, для тестов `E2E_DEMO_PASSWORD`).

## Что проверяют тесты

| Файл | Сценарий |
|---|---|
| `client-booking-flow.spec.ts` | СЦ-1: поиск, бронь, счёт на оплату; неверный пароль; закрытый раздел |
| `doctor-assignment-flow.spec.ts` | СЦ-3: назначение, предупреждение о противопоказаниях, расписание |
| `manager-approval-flow.spec.ts` | СЦ-2, СЦ-4: KPI, прогноз, рекомендации вне коридора (пропускается, если их нет) |

Тесты меняют общее состояние (создают путёвки), поэтому идут последовательно (`workers: 1`).
