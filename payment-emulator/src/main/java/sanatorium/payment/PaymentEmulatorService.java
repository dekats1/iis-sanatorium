package sanatorium.payment;

import sanatorium.payment.PaymentController.InvoiceRequest;
import sanatorium.payment.PaymentController.InvoiceResponse;
import java.math.BigDecimal;
import java.net.http.HttpClient;
import java.time.Duration;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.client.JdkClientHttpRequestFactory;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;
import org.springframework.web.server.ResponseStatusException;

/**
 * Эмулятор платёжного провайдера (внешняя система, раздел 1.1 главы 1; поток 6–7 раздела 2.5 главы 2).
 * Хранит счета (таблица invoices), по действию плательщика отправляет подписанный вебхук в core-service,
 * после чего возвращает плательщика в интерфейс санатория. Реальных платежей и данных карт не обрабатывает.
 */
@Service
public class PaymentEmulatorService {

    private static final Logger log = LoggerFactory.getLogger(PaymentEmulatorService.class);

    /** Счёт платёжного сервиса. */
    private record InvoiceRow(long id, long voucherId, BigDecimal amount, String currency,
                              String callbackUrl, String status) { }

    private record CallbackBody(long externalId, long invoiceId, String status, BigDecimal amount) { }

    /** Единый стиль страниц «банка» — та же палитра, что и у интерфейса санатория. */
    private static final String PAGE_CSS = """
            :root{--accent:#1f6f5c;--accent-dark:#185a4a;--text:#1c2724;--muted:#5f6f6a;
                  --line:#dbe3e0;--danger:#b3342b;--ok:#1d6b3a;--warn:#8a5a00;--bg:#f4f6f5}
            *{box-sizing:border-box}
            body{margin:0;font-family:system-ui,-apple-system,"Segoe UI",Roboto,Arial,sans-serif;color:var(--text);
                 background:linear-gradient(180deg,#dcece6 0%,#f4f6f5 340px);min-height:100vh;
                 display:flex;align-items:center;justify-content:center;padding:24px}
            .card{background:#fff;border:1px solid #dbe3e0;border-radius:14px;max-width:440px;width:100%;
                  padding:28px;box-shadow:0 14px 36px rgba(31,111,92,.16)}
            .brand{display:flex;align-items:center;gap:10px;font-weight:700;color:var(--accent);margin-bottom:16px;font-size:1.02rem}
            .brand::before{content:"";width:26px;height:26px;border-radius:50%;flex:none;
              background:var(--accent) url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Cpath d='M12 2C9 7 6 9.5 6 13a6 6 0 0 0 12 0c0-3.5-3-6-6-11z' fill='%23e4f1ed'/%3E%3Cpath d='M12 9c-1.5 2.5-3 4-3 6a3 3 0 0 0 6 0c0-2.5-1.5-3.5-3-6z' fill='%231f6f5c'/%3E%3C/svg%3E") center/14px no-repeat}
            h1{font-size:1.2rem;margin:0 0 4px}
            .amount{font-size:2.1rem;font-weight:700;font-variant-numeric:tabular-nums;margin:10px 0 2px;letter-spacing:.5px}
            .amount small{font-size:1rem;font-weight:500;color:#5f6f6a;letter-spacing:0}
            dl{display:grid;grid-template-columns:max-content 1fr;gap:6px 18px;margin:14px 0 0;font-size:.95rem}
            dt{color:var(--muted)} dd{margin:0;font-weight:600}
            .btns{display:flex;gap:10px;margin-top:22px}
            .btns form{flex:1}
            button{width:100%;font:inherit;font-weight:600;cursor:pointer;padding:12px 16px;min-height:44px;
                   border-radius:9px;border:1px solid transparent;transition:transform .12s ease}
            .pay{background:linear-gradient(180deg,#23806a,#1f6f5c);color:#fff;border-color:#1f6f5c;box-shadow:0 2px 8px rgba(24,90,74,.35)}
            .pay:hover{background:#185a4a;transform:translateY(-1px)}
            .decline{background:#fff;color:#b3342b;border-color:#e3b9b5}
            .decline:hover{background:#fbeae8}
            .banner{padding:14px 16px;border-radius:9px;border:1px solid;margin:4px 0 14px;font-weight:600}
            .ok{background:#e6f4ea;border-color:#b9dcc4;color:#1d6b3a}
            .bad{background:#fbeae8;border-color:#e3b9b5;color:#7d241d}
            .warn{background:#fff4dc;border-color:#ecd49b;color:#8a5a00}
            .note{font-size:.83rem;color:var(--muted);margin-top:14px;line-height:1.45}
            .back{display:block;text-align:center;margin-top:12px;color:#1f6f5c;font-size:.9rem}
            """;

    private final JdbcClient jdbc;
    private final PaymentProperties props;
    private final RestClient rest;

    public PaymentEmulatorService(JdbcClient jdbc, PaymentProperties props) {
        this.jdbc = jdbc;
        this.props = props;
        var factory = new JdkClientHttpRequestFactory(HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(2)).build());
        factory.setReadTimeout(Duration.ofSeconds(5));
        this.rest = RestClient.builder().requestFactory(factory).build();
    }

    @Transactional
    public InvoiceResponse create(InvoiceRequest req) {
        if (!req.callbackUrl().startsWith(props.allowedCallbackPrefix())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "callbackUrl не входит в список разрешённых");
        }
        long id = jdbc.sql("""
                INSERT INTO invoices (voucher_id, amount, currency, callback_url)
                VALUES (:v, :a, :c, :u) RETURNING id
                """)
                .param("v", req.externalId()).param("a", req.amount())
                .param("c", req.currency()).param("u", req.callbackUrl())
                .query(Long.class).single();
        return new InvoiceResponse(id, props.publicBaseUrl() + "/pay/" + id);
    }

        /** Страница «банка» для плательщика: брендированная карточка счёта и два действия (имитация). */
    public String payPage(long invoiceId, jakarta.servlet.http.HttpServletRequest request) {
        InvoiceRow inv = find(invoiceId);
        String appReturn = props.returnUrl();
        // Возврат должен идти на тот же origin, откуда пришёл плательщик (Referer),
        // чтобы токен в sessionStorage приложения был доступен.
        String referer = request.getHeader("Referer");
        if (referer != null && (referer.startsWith("http://") || referer.startsWith("https://"))) {
            try {
                java.net.URI u = java.net.URI.create(referer);
                String origin = u.getScheme() + "://" + u.getHost() + (u.getPort() > 0 ? ":" + u.getPort() : "");
                appReturn = origin + "/my";
            } catch (IllegalArgumentException ignored) { }
        }
        if (!"ISSUED".equals(inv.status())) {
            return page(resultBody("Счёт уже обработан",
                    "Счёт № " + inv.id() + " уже обработан, статус: " + inv.status() + ". Повторная оплата не требуется.",
                    "warn", props.returnUrl()), "Счёт обработан", props.returnUrl());
        }
        String body = "<div class=\"brand\">Санаторий ИИС &middot; платёжный сервис</div>"
                + "<h1>Оплата счёта &numero;&nbsp;" + inv.id() + "</h1>"
                + "<div class=\"amount\">" + inv.amount().toPlainString() + " <small>" + inv.currency() + "</small></div>"
                + "<dl>"
                + "<dt>Путёвка</dt><dd>№ " + inv.voucherId() + "</dd>"
                + "<dt>Счёт</dt><dd>№ " + inv.id() + "</dd>"
                + "<dt>Статус</dt><dd>выставлен, ожидает оплаты</dd>"
                + "</dl>"
                + "<div class=\"btns\">"
                + "<form method=\"post\" action=\"/pay/" + inv.id() + "/result?status=SUCCESS\">"
                + "<input type=\"hidden\" name=\"return\" value=\"" + appReturn + "\">"
                + "<button class=\"pay\" type=\"submit\">Оплатить</button></form>"
                + "<form method=\"post\" action=\"/pay/" + inv.id() + "/result?status=DECLINED\">"
                + "<input type=\"hidden\" name=\"return\" value=\"" + appReturn + "\">"
                + "<button class=\"decline\" type=\"submit\">Отклонить</button></form>"
                + "</div>"
                + "<p class=\"note\">Учебный эмулятор: реальные деньги не списываются, данные карт не запрашиваются. "
                + "После выбора действия результат передаётся санаторию, и вы автоматически вернётесь на сайт.</p>";
        return page(body, "Оплата счёта № " + inv.id(), null);
    }

    /** Фиксирует результат, уведомляет core-service и возвращает плательщика на сайт санатория. */
    public String complete(long invoiceId, String status, String clientReturnUrl) {
        if (!"SUCCESS".equals(status) && !"DECLINED".equals(status)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "status: SUCCESS или DECLINED");
        }
        InvoiceRow inv = find(invoiceId);
        int updated = jdbc.sql("UPDATE invoices SET status = :s WHERE id = :id AND status = 'ISSUED'")
                .param("s", status).param("id", invoiceId).update();
        if (updated == 0) {
            return page(resultBody("Счёт уже обработан",
                    "Счёт № " + inv.id() + " уже обработан, статус: " + inv.status() + ".",
                    "warn", props.returnUrl()), "Счёт обработан", props.returnUrl());
        }
        String base = (clientReturnUrl != null
                && (clientReturnUrl.startsWith("http://") || clientReturnUrl.startsWith("https://"))) ? clientReturnUrl : props.returnUrl();
        String redirectUrl = base + (base.contains("?") ? "&" : "?") + "pay=" + status;
        var body = new CallbackBody(inv.voucherId(), inv.id(), status, inv.amount());
        String signature = PaymentSignature.sign(props.webhookSecret(), inv.voucherId(), inv.id(), status, inv.amount());
        try {
            rest.post().uri(inv.callbackUrl())
                    .header("X-Signature", signature)
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(body)
                    .retrieve().toBodilessEntity();
        } catch (RestClientException ex) {
            // Прототип: повторной доставки вебхука нет. В реальном провайдере — ретраи с задержкой.
            log.error("Не удалось доставить вебхук по счёту {}: {}", inv.id(), ex.getMessage());
            return page(resultBody("Статус: " + status,
                    "Платёж зафиксирован, но уведомление санаторию пока не доставлено — статус обновится позже.",
                    "warn", props.returnUrl()), "Статус счёта", props.returnUrl());
        }
        boolean success = "SUCCESS".equals(status);
        String title = (success ? "Оплата прошла успешно" : "Платёж отклонён");
        String text = success
                ? "Счёт № " + inv.id() + " оплачен, средства зачислены. Статус путёвки № " + inv.voucherId() + " обновлён."
                : "Платёж по счёту № " + inv.id() + " отклонён. Бронь сохраняется до срока оплаты — оплатить можно позже из «Моих путёвок».";
        return page(resultBody((success ? "✓ " : "") + title, text, success ? "ok" : "bad", redirectUrl),
                title, redirectUrl);
    }

    private InvoiceRow find(long id) {
        return jdbc.sql("SELECT id, voucher_id, amount, currency, callback_url, status FROM invoices WHERE id = :id")
                .param("id", id)
                .query((rs, n) -> new InvoiceRow(rs.getLong("id"), rs.getLong("voucher_id"), rs.getBigDecimal("amount"),
                        rs.getString("currency"), rs.getString("callback_url"), rs.getString("status")))
                .optional()
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Счёт не найден"));
    }

/** Тело результата: цветной баннер, пояснение и автоматический возврат в интерфейс санатория. */
    private String resultBody(String banner, String text, String tone, String redirectUrl) {
        return "<div class=\"brand\">Санаторий ИИС &middot; платёжный сервис</div>"
                + "<div class=\"banner " + tone + "\">" + banner + "</div>"
                + "<p>" + text + "</p>"
                + "<p class=\"note\">Сейчас вы будете перенаправлены обратно на сайт санатория (3 секунды).</p>"
                + "<a class=\"back\" href=\"" + redirectUrl + "\">Вернуться сейчас</a>";
    }

    /** Полная HTML-страница «банка»; если redirectUrl задан — авто-возврат через 3 секунды. */
    private String page(String inner, String title, String redirectTo) {
        String refresh = redirectTo == null ? ""
                : "<meta http-equiv=\"refresh\" content=\"3;url=" + redirectTo + "\">";
        return "<!doctype html><html lang=\"ru\"><head><meta charset=\"utf-8\">"
                + "<meta name=\"viewport\" content=\"width=device-width, initial-scale=1\">" + refresh
                + "<title>" + title + " — платёжный сервис (эмулятор)</title>"
                + "<style>" + PAGE_CSS + "</style></head><body><div class=\"card\">" + inner + "</div></body></html>";
    }
}
