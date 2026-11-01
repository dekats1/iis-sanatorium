package sanatorium.gateway;

import java.time.Duration;
import org.springframework.cloud.gateway.config.HttpClientCustomizer;
import org.springframework.cloud.gateway.route.RouteLocator;
import org.springframework.cloud.gateway.route.builder.RouteLocatorBuilder;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.reactive.CorsWebFilter;
import org.springframework.web.cors.reactive.UrlBasedCorsConfigurationSource;

/**
 * Маршруты шлюза и сетевые настройки.
 * <ul>
 *   <li>/api/** → core-service;</li>
 *   <li>/pricing/{forecast|history|pricing-rules|price/reviews}/** → pricing-forecast (префикс /pricing срезается);
 *       расчёт цены (/price/quote) и сидирование — внутренние, снаружи недоступны;</li>
 *   <li>вебхук платёжного сервиса (/api/payments/callback) идёт в core-service напрямую из внутренней сети,
 *       через шлюз — 404 (закрывает JwtAuthFilter по PublicPaths.isBlocked).</li>
 * </ul>
 */
@Configuration
public class GatewayRoutes {

    @Bean
    RouteLocator routes(RouteLocatorBuilder builder, GatewayProperties props) {
        return builder.routes()
                .route("core", r -> r.path("/api/**").uri(props.coreUrl()))
                .route("pricing", r -> r.path("/pricing/forecast/**", "/pricing/history/**",
                                "/pricing/pricing-rules/**", "/pricing/price/reviews/**")
                        .filters(f -> f.stripPrefix(1))
                        .uri(props.pricingUrl()))
                .build();
    }

    /** Таймауты соединения и ответа: шлюз не должен держать запрос бесконечно, если сервис завис. */
    @Bean
    HttpClientCustomizer httpTimeouts(GatewayProperties props) {
        return httpClient -> httpClient
                .option(io.netty.channel.ChannelOption.CONNECT_TIMEOUT_MILLIS, props.connectTimeoutMs())
                .responseTimeout(Duration.ofMillis(props.responseTimeoutMs()));
    }

    /**
     * CORS для разработки (фронтенд на другом порту). Токен передаётся заголовком Authorization, cookie не используются,
     * поэтому allowCredentials выключен. В продуктивной схеме фронтенд и API на одном origin.
     */
    @Bean
    CorsWebFilter corsWebFilter(GatewayProperties props) {
        CorsConfiguration cors = new CorsConfiguration();
        cors.setAllowedOrigins(props.corsAllowedOrigins());
        cors.setAllowedMethods(java.util.List.of(HttpMethod.GET.name(), HttpMethod.POST.name(), HttpMethod.PUT.name(),
                HttpMethod.DELETE.name(), HttpMethod.OPTIONS.name()));
        cors.setAllowedHeaders(java.util.List.of(HttpHeaders.AUTHORIZATION, HttpHeaders.CONTENT_TYPE));
        cors.setAllowCredentials(false);
        cors.setMaxAge(3600L);
        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/**", cors);
        return new CorsWebFilter(source);
    }
}
