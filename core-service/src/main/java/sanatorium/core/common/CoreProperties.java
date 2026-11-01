package sanatorium.core.common;

import org.springframework.boot.context.properties.ConfigurationProperties;

/** Типизированные настройки сервиса (префикс core.*, см. application.yml). */
@ConfigurationProperties(prefix = "core")
public record CoreProperties(Jwt jwt, Pricing pricing, Payment payment, Booking booking, Events events, Schedule schedule, Demo demo) {

    public record Jwt(String secret, int ttlMinutes, String issuer) { }

    public record Pricing(String baseUrl, int connectTimeoutMs, int readTimeoutMs, int snapshotMaxAgeHours) { }

    public record Payment(String baseUrl, String apiKey, String webhookSecret, String publicBaseUrl) { }

    public record Booking(int maxNights, int paymentDeadlineHours, int prepayPercent, int placementRetries) { }

    public record Events(String exchange) { }

    /** Расписание процедур: часовой пояс санатория, начало рабочего дня (ЧЧ:ММ) и его длительность в минутах. */
    public record Schedule(String zone, String dayStart, int dayMinutes) { }

    public record Demo(String password) { }
}
