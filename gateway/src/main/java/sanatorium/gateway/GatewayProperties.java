package sanatorium.gateway;

import java.util.List;
import org.springframework.boot.context.properties.ConfigurationProperties;

/** Настройки шлюза (префикс gateway.*, см. application.yml). */
@ConfigurationProperties(prefix = "gateway")
public record GatewayProperties(String jwtSecret, String coreUrl, String pricingUrl, List<String> corsAllowedOrigins,
                                boolean trustForwardedFor, int connectTimeoutMs, int responseTimeoutMs,
                                LoginLimit loginLimit) {

    public record LoginLimit(int maxAttempts, int windowSeconds) { }
}
