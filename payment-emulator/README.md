# payment-emulator

Эмулятор внешнего платёжного сервиса (Java 21, Spring Boot, БД `sanatorium_payment`). Не обрабатывает реальные платежи.

- `POST /invoices` (заголовок `X-Api-Key`) — выставить счёт, ответ `{invoiceId, payUrl}`.
- `GET /pay/{id}` — страница «банка» с кнопками «Оплатить» / «Отклонить».
- По нажатию отправляет в core-service подписанный вебхук `POST /api/payments/callback` (заголовок `X-Signature`,
  HMAC-SHA256 от `externalId|invoiceId|status|amount`). Повторной доставки вебхука нет (упрощение прототипа).
- Вебхук отправляется только на адреса с префиксом `payment.allowed-callback-prefix` (защита от SSRF).

Запуск: `mvn spring-boot:run` (порт 8083). Код не собирался в среде разработки — сначала `mvn verify`.
