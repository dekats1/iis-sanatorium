package sanatorium.gateway;

import java.net.ConnectException;
import java.util.concurrent.TimeoutException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.webflux.error.ErrorWebExceptionHandler;
import org.springframework.core.annotation.Order;
import org.springframework.http.HttpStatus;
import org.springframework.http.HttpStatusCode;
import org.springframework.stereotype.Component;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.web.server.ServerWebExchange;
import reactor.core.publisher.Mono;

/**
 * Преобразует сбои шлюза в JSON (RFC 9457): маршрут не найден → 404, сервис недоступен → 503, не ответил вовремя → 504,
 * остальное → 500 без внутренних деталей. Порядок -2 — раньше стандартного обработчика Spring Boot (-1).
 */
@Component
@Order(-2)
public class GlobalExceptionHandler implements ErrorWebExceptionHandler {

    private static final Logger log = LoggerFactory.getLogger(GlobalExceptionHandler.class);

    @Override
    public Mono<Void> handle(ServerWebExchange exchange, Throwable ex) {
        if (exchange.getResponse().isCommitted()) {
            return Mono.error(ex);
        }
        if (ex instanceof ResponseStatusException rse) {
            HttpStatusCode code = rse.getStatusCode();
            HttpStatus status = HttpStatus.resolve(code.value());
            if (status == HttpStatus.NOT_FOUND) {
                return JsonErrors.write(exchange, HttpStatus.NOT_FOUND, "Маршрут не найден");
            }
            if (status != null && status.is4xxClientError()) {
                return JsonErrors.write(exchange, status, "Некорректный запрос");
            }
            if (status == HttpStatus.SERVICE_UNAVAILABLE) {
                return JsonErrors.write(exchange, status, "Сервис временно недоступен");
            }
        }
        for (Throwable t = ex; t != null; t = t.getCause() == t ? null : t.getCause()) {
            if (t instanceof ConnectException || t.getClass().getSimpleName().contains("ConnectTimeout")) {
                return JsonErrors.write(exchange, HttpStatus.SERVICE_UNAVAILABLE, "Сервис временно недоступен");
            }
            if (t instanceof TimeoutException || t.getClass().getSimpleName().contains("ReadTimeout")
                    || t.getClass().getSimpleName().contains("ResponseTimeout")) {
                return JsonErrors.write(exchange, HttpStatus.GATEWAY_TIMEOUT, "Сервис не ответил вовремя");
            }
        }
        log.error("Необработанный сбой шлюза {} {}", exchange.getRequest().getMethod(), exchange.getRequest().getPath(), ex);
        return JsonErrors.write(exchange, HttpStatus.INTERNAL_SERVER_ERROR, "Внутренняя ошибка шлюза");
    }
}
