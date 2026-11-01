package sanatorium.gateway;

import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.Optional;
import javax.crypto.spec.SecretKeySpec;
import org.springframework.cloud.gateway.filter.GatewayFilterChain;
import org.springframework.cloud.gateway.filter.GlobalFilter;
import org.springframework.core.Ordered;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.security.oauth2.jose.jws.MacAlgorithm;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.jwt.JwtException;
import org.springframework.security.oauth2.jwt.NimbusReactiveJwtDecoder;
import org.springframework.security.oauth2.jwt.ReactiveJwtDecoder;
import org.springframework.stereotype.Component;
import org.springframework.web.server.ServerWebExchange;
import reactor.core.publisher.Mono;

/**
 * Проверка JWT на входе (аутентификация): подпись HS256, срок действия. Заголовок Authorization пробрасывается
 * дальше без изменений — каждый сервис проверяет токен и роль сам и шлюзу не доверяет (раздел 2.4 главы 2).
 * Права по ролям шлюз не проверяет: они зависят от бизнес-правил сервисов и задаются там.
 * Служебные токены (роль SERVICE_CORE) предназначены только для вызовов между сервисами, снаружи они отклоняются.
 */
@Component
public class JwtAuthFilter implements GlobalFilter, Ordered {

    private static final int MIN_KEY_BYTES = 32; // 256 бит для HS256
    private static final String BEARER = "Bearer ";
    static final String SERVICE_ROLE = "SERVICE_CORE";

    private final ReactiveJwtDecoder decoder;

    public JwtAuthFilter(GatewayProperties props) {
        byte[] bytes = props.jwtSecret().getBytes(StandardCharsets.UTF_8);
        if (bytes.length < MIN_KEY_BYTES) {
            throw new IllegalStateException("gateway.jwt-secret должен быть не короче 32 байт для HS256");
        }
        this.decoder = NimbusReactiveJwtDecoder.withSecretKey(new SecretKeySpec(bytes, "HmacSHA256"))
                .macAlgorithm(MacAlgorithm.HS256)
                .build();
    }

    @Override
    public Mono<Void> filter(ServerWebExchange exchange, GatewayFilterChain chain) {
        var request = exchange.getRequest();
        if (PublicPaths.isBlocked(request.getPath().value())) {
            return JsonErrors.write(exchange, HttpStatus.NOT_FOUND, "Маршрут не найден");
        }
        if (request.getMethod() == HttpMethod.OPTIONS || PublicPaths.isPublic(request.getPath().value())) {
            return chain.filter(exchange);
        }
        String header = request.getHeaders().getFirst(HttpHeaders.AUTHORIZATION);
        if (header == null || !header.regionMatches(true, 0, BEARER, 0, BEARER.length())) {
            return JsonErrors.write(exchange, HttpStatus.UNAUTHORIZED, "Требуется вход в систему");
        }
        String token = header.substring(BEARER.length()).trim();
        return decoder.decode(token)
                .map(Optional::of)
                // подпись неверна, токен просрочен или повреждён — одно и то же сообщение, причину клиенту не раскрываем
                .onErrorResume(JwtException.class, e -> Mono.just(Optional.<Jwt>empty()))
                .flatMap(decoded -> {
                    if (decoded.isEmpty()) {
                        return JsonErrors.write(exchange, HttpStatus.UNAUTHORIZED, "Недействительный или просроченный токен");
                    }
                    List<String> roles = decoded.get().getClaimAsStringList("roles");
                    if (roles != null && roles.contains(SERVICE_ROLE)) {
                        return JsonErrors.write(exchange, HttpStatus.FORBIDDEN, "Служебный токен не принимается снаружи");
                    }
                    return chain.filter(exchange);
                });
    }

    @Override
    public int getOrder() {
        return Ordered.HIGHEST_PRECEDENCE + 100;
    }
}
