# gateway

Единая точка входа для браузера. Spring Boot 4.0.8 + Spring Cloud Gateway (WebFlux, BOM 2025.1.3), Java 21.

| Что делает | Где |
|---|---|
| Проверяет подпись и срок JWT (HS256), отвечает 401 до обращения к сервисам; служебные токены (`SERVICE_CORE`) снаружи отклоняет (403) | `JwtAuthFilter` |
| Ограничивает попытки входа/регистрации с одного адреса (по умолчанию 10 за 60 с — **проектное допущение автора**) | `LoginRateLimitFilter`, `SlidingWindowLimiter` |
| Маршруты: `/api/**` → core-service; `/pricing/{forecast,history,pricing-rules,price/reviews}/**` → pricing-forecast (префикс `/pricing` срезается) | `GatewayRoutes` |
| Закрывает `/api/payments/**` (вебхук платёжного сервиса идёт в core-service напрямую из внутренней сети) | `PublicPaths.isBlocked` |
| Таймауты соединения/ответа, CORS для разработки, ошибки в формате RFC 9457 | `GatewayRoutes`, `GlobalExceptionHandler`, `JsonErrors` |

Роли шлюз **не** проверяет: Authorization пробрасывается как есть, core-service и pricing-forecast сами проверяют подпись и роль
(двойная защита). Маршруты заданы в Java, а не в YAML: ключи свойств Spring Cloud Gateway менялись между версиями, и опечатка в YAML
молча давала бы шлюз без маршрутов.

Лимитер хранит счётчики в памяти одного экземпляра (не общие между экземплярами, сбрасываются при перезапуске) — для промышленной
версии нужен общий счётчик (например, Redis).

Состояние проверки: **не собирался** (Maven Central недоступен в среде разработки). `SlidingWindowLimiter` и `PublicPaths` прогнаны
javac-проверкой; `JwtAuthFilterTest` (подпись, срок, служебный токен, закрытый путь) написан, но не запускался.
Запуск: `mvn verify`.
