package sanatorium.gateway;

import org.springframework.cloud.gateway.filter.GatewayFilterChain;
import org.springframework.cloud.gateway.filter.GlobalFilter;
import org.springframework.core.Ordered;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import org.springframework.web.server.ServerWebExchange;
import reactor.core.publisher.Mono;

/**
 * Ограничение числа попыток входа и регистрации с одного адреса (замедление подбора пароля, НФТ-04).
 * Считаются все попытки, успешные и неуспешные. Адрес берётся из X-Forwarded-For только если шлюз стоит за
 * обратным прокси, который перезаписывает этот заголовок (gateway.trust-forwarded-for=true); иначе заголовок
 * подделывается клиентом и обходит лимит.
 */
@Component
public class LoginRateLimitFilter implements GlobalFilter, Ordered {

    private final SlidingWindowLimiter limiter;
    private final boolean trustForwardedFor;

    public LoginRateLimitFilter(GatewayProperties props) {
        this.limiter = new SlidingWindowLimiter(props.loginLimit().maxAttempts(), props.loginLimit().windowSeconds() * 1000L);
        this.trustForwardedFor = props.trustForwardedFor();
    }

    @Override
    public Mono<Void> filter(ServerWebExchange exchange, GatewayFilterChain chain) {
        var request = exchange.getRequest();
        String path = request.getPath().value();
        boolean limited = request.getMethod() == HttpMethod.POST
                && (path.equals("/api/auth/login") || path.equals("/api/auth/register"));
        if (!limited) {
            return chain.filter(exchange);
        }
        String key = clientAddress(exchange);
        if (limiter.tryAcquire(key)) {
            return chain.filter(exchange);
        }
        long seconds = Math.max(1, (limiter.retryAfterMillis(key) + 999) / 1000);
        exchange.getResponse().getHeaders().set("Retry-After", String.valueOf(seconds));
        return JsonErrors.write(exchange, HttpStatus.TOO_MANY_REQUESTS, "Слишком много попыток входа, повторите через " + seconds + " с");
    }

    private String clientAddress(ServerWebExchange exchange) {
        if (trustForwardedFor) {
            String forwarded = exchange.getRequest().getHeaders().getFirst("X-Forwarded-For");
            if (forwarded != null && !forwarded.isBlank()) {
                return forwarded.split(",")[0].trim();
            }
        }
        var remote = exchange.getRequest().getRemoteAddress();
        return remote == null || remote.getAddress() == null ? "unknown" : remote.getAddress().getHostAddress();
    }

    @Override
    public int getOrder() {
        return Ordered.HIGHEST_PRECEDENCE + 50; // раньше проверки JWT
    }
}
