package sanatorium.gateway;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.nimbusds.jose.JWSAlgorithm;
import com.nimbusds.jose.JWSHeader;
import com.nimbusds.jose.crypto.MACSigner;
import com.nimbusds.jwt.JWTClaimsSet;
import com.nimbusds.jwt.SignedJWT;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.Date;
import java.util.List;
import java.util.concurrent.atomic.AtomicBoolean;
import org.junit.jupiter.api.Test;
import org.springframework.cloud.gateway.filter.GatewayFilterChain;
import org.springframework.http.HttpStatus;
import org.springframework.mock.http.server.reactive.MockServerHttpRequest;
import org.springframework.mock.web.server.MockServerWebExchange;
import reactor.core.publisher.Mono;

/** Модульный тест фильтра без подъёма контекста Spring: токены подписываются тем же ключом, что и в core-service. */
class JwtAuthFilterTest {

    private static final String SECRET = "test-secret-test-secret-test-secret-0123";

    private final JwtAuthFilter filter = new JwtAuthFilter(new GatewayProperties(SECRET, "http://core", "http://pricing",
            List.of(), false, 1000, 1000, new GatewayProperties.LoginLimit(10, 60)));

    private static String token(String secret, List<String> roles, Instant expires) throws Exception {
        var claims = new JWTClaimsSet.Builder().subject("u1").issuer("sanatorium-core")
                .claim("roles", roles).expirationTime(Date.from(expires)).build();
        var jwt = new SignedJWT(new JWSHeader(JWSAlgorithm.HS256), claims);
        jwt.sign(new MACSigner(secret.getBytes(StandardCharsets.UTF_8)));
        return jwt.serialize();
    }

    private HttpStatus run(MockServerHttpRequest.BaseBuilder<?> req, AtomicBoolean passed) {
        var exchange = MockServerWebExchange.from(req);
        GatewayFilterChain chain = e -> {
            passed.set(true);
            return Mono.empty();
        };
        filter.filter(exchange, chain).block();
        return exchange.getResponse().getStatusCode() == null ? HttpStatus.OK
                : HttpStatus.valueOf(exchange.getResponse().getStatusCode().value());
    }

    @Test
    void publicPathPassesWithoutToken() {
        var passed = new AtomicBoolean();
        assertEquals(HttpStatus.OK, run(MockServerHttpRequest.post("/api/auth/login"), passed));
        assertTrue(passed.get());
    }

    @Test
    void missingTokenIs401() {
        var passed = new AtomicBoolean();
        assertEquals(HttpStatus.UNAUTHORIZED, run(MockServerHttpRequest.get("/api/vouchers/my"), passed));
        assertFalse(passed.get());
    }

    @Test
    void validTokenPasses() throws Exception {
        var passed = new AtomicBoolean();
        String t = token(SECRET, List.of("CLIENT"), Instant.now().plusSeconds(600));
        assertEquals(HttpStatus.OK, run(MockServerHttpRequest.get("/api/vouchers/my")
                .header("Authorization", "Bearer " + t), passed));
        assertTrue(passed.get());
    }

    @Test
    void expiredTokenIs401() throws Exception {
        var passed = new AtomicBoolean();
        String t = token(SECRET, List.of("CLIENT"), Instant.now().minusSeconds(600));
        assertEquals(HttpStatus.UNAUTHORIZED, run(MockServerHttpRequest.get("/api/vouchers/my")
                .header("Authorization", "Bearer " + t), passed));
        assertFalse(passed.get());
    }

    @Test
    void wrongSignatureIs401() throws Exception {
        var passed = new AtomicBoolean();
        String t = token("another-secret-another-secret-0123456789", List.of("CLIENT"), Instant.now().plusSeconds(600));
        assertEquals(HttpStatus.UNAUTHORIZED, run(MockServerHttpRequest.get("/api/vouchers/my")
                .header("Authorization", "Bearer " + t), passed));
        assertFalse(passed.get());
    }

    @Test
    void garbageTokenIs401() {
        var passed = new AtomicBoolean();
        assertEquals(HttpStatus.UNAUTHORIZED, run(MockServerHttpRequest.get("/api/vouchers/my")
                .header("Authorization", "Bearer not-a-jwt"), passed));
        assertFalse(passed.get());
    }

    @Test
    void serviceTokenRejectedFromOutside() throws Exception {
        var passed = new AtomicBoolean();
        String t = token(SECRET, List.of("SERVICE_CORE"), Instant.now().plusSeconds(600));
        assertEquals(HttpStatus.FORBIDDEN, run(MockServerHttpRequest.get("/pricing/forecast/1")
                .header("Authorization", "Bearer " + t), passed));
        assertFalse(passed.get());
    }

    @Test
    void paymentCallbackIs404EvenWithValidToken() throws Exception {
        var passed = new AtomicBoolean();
        String t = token(SECRET, List.of("SYSADMIN"), Instant.now().plusSeconds(600));
        assertEquals(HttpStatus.NOT_FOUND, run(MockServerHttpRequest.post("/api/payments/callback")
                .header("Authorization", "Bearer " + t), passed));
        assertFalse(passed.get());
    }

    @Test
    void preflightPassesWithoutToken() {
        var passed = new AtomicBoolean();
        run(MockServerHttpRequest.options("/api/vouchers").header("Origin", "http://localhost:5173")
                .header("Access-Control-Request-Method", "POST"), passed);
        assertTrue(passed.get());
    }
}
