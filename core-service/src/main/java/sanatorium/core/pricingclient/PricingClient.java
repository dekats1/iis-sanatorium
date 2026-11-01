package sanatorium.core.pricingclient;

import java.math.BigDecimal;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;
import com.fasterxml.jackson.databind.DeserializationFeature;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.SerializationFeature;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClientException;
import sanatorium.core.common.ApiException;
import sanatorium.core.common.CoreProperties;
import sanatorium.core.identity.JwtTokenProvider;

/**
 * Клиент pricing-forecast: POST /price/quote/batch (поток 4, раздел 2.5 главы 2).
 *
 * <p>Инициатор — core-service, получатель — pricing-forecast, данные — список (категория, дата),
 * результат — цена на каждые сутки (+ quote_id при fix=true). Если сервис недоступен или не имеет
 * тарифа на дату, используется свежий резервный снимок цены; при его отсутствии — 503 «цена недоступна».
 *
 * <p>Запрос собирается на чистом java.net.http.HttpClient с явно указанной версией HTTP/1.1:
 * связка RestClient + JdkClientHttpRequestFactory провоцировала uvicorn (h11) на
 * «Invalid HTTP request received» с пустым телом, из-за чего цена всегда считалась недоступной.
 */
@Component
public class PricingClient {

    private static final Logger log = LoggerFactory.getLogger(PricingClient.class);

    private final HttpClient http;
    private final ObjectMapper mapper;
    private final JwtTokenProvider jwt;
    private final PriceSnapshotRepository snapshots;
    private final CoreProperties props;

    public PricingClient(CoreProperties props, JwtTokenProvider jwt, PriceSnapshotRepository snapshots) {
        this.props = props;
        this.jwt = jwt;
        this.snapshots = snapshots;
        // Свой маппер: LocalDate уходит строкой ISO (2026-10-27), а не массивом компонентов.
        this.mapper = ObjectMapperHolder.create();
        this.http = java.net.http.HttpClient.newBuilder()
                .version(HttpClient.Version.HTTP_1_1) // uvicorn ожидает HTTP/1.1
                .connectTimeout(Duration.ofMillis(props.pricing().connectTimeoutMs()))
                .build();
    }

    /** Отдельный маппер: в этом приложении Spring не выставляет ObjectMapper как бин. */
    private static final class ObjectMapperHolder {
        static ObjectMapper create() {
            return new ObjectMapper()
                    .registerModule(new JavaTimeModule())
                    .disable(SerializationFeature.WRITE_DATES_AS_TIMESTAMPS)
                    .disable(DeserializationFeature.ADJUST_DATES_TO_CONTEXT_TIME_ZONE)
                    .disable(DeserializationFeature.FAIL_ON_UNKNOWN_PROPERTIES);
        }
    }

    /** @param fix true — оформление брони (создаёт quote_id), false — предпросмотр цены при поиске. */
    public List<QuotedLine> quote(int categoryId, List<LocalDate> dates, boolean fix) {
        List<QuotedLine> fromService = null;
        try {
            fromService = callService(categoryId, dates, fix);
        } catch (RestClientException ex) {
            log.warn("pricing-forecast недоступен ({}), пробуем резервный снимок цен", ex.getMessage());
        }

        List<QuotedLine> result = new ArrayList<>(dates.size());
        OffsetDateTime notOlderThan = OffsetDateTime.now().minusHours(props.pricing().snapshotMaxAgeHours());
        for (int i = 0; i < dates.size(); i++) {
            LocalDate date = dates.get(i);
            QuotedLine line = fromService != null && i < fromService.size() ? fromService.get(i) : null;
            if (line != null && !line.fallback()) {
                snapshots.upsert(categoryId, date, line.price());
                result.add(line);
                continue;
            }
            BigDecimal snap = snapshots.findFresh(categoryId, date, notOlderThan)
                    .orElseThrow(() -> ApiException.unavailable(
                            "Цена на " + date + " временно недоступна, попробуйте позже"));
            result.add(new QuotedLine(categoryId, date, snap, false, null, true));
        }
        return result;
    }

    private List<QuotedLine> callService(int categoryId, List<LocalDate> dates, boolean fix) {
        try {
            List<LineReq> lines = dates.stream().map(d -> new LineReq(categoryId, d)).toList();
            String json = mapper.writeValueAsString(new BatchReq(lines, fix));
            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create(props.pricing().baseUrl() + "/price/quote/batch"))
                    .timeout(Duration.ofMillis(props.pricing().readTimeoutMs()))
                    .header("Content-Type", "application/json")
                    .header("Authorization", "Bearer " + jwt.issueServiceToken())
                    .POST(HttpRequest.BodyPublishers.ofString(json, StandardCharsets.UTF_8))
                    .build();
            HttpResponse<String> response = http.send(request, HttpResponse.BodyHandlers.ofString());
            if (response.statusCode() != 200) {
                throw new RestClientException("pricing-forecast ответил " + response.statusCode()
                        + ": " + response.body());
            }
            BatchResp resp = mapper.readValue(response.body(), BatchResp.class);
            if (resp == null || resp.lines() == null || resp.lines().size() != dates.size()) {
                throw new RestClientException("Некорректный ответ pricing-forecast");
            }
            return resp.lines().stream()
                    .map(l -> new QuotedLine(l.categoryId(), l.stayDate(), l.price(), l.outOfCorridor(), l.quoteId(), l.fallback()))
                    .toList();
        } catch (java.io.IOException | InterruptedException ex) {
            if (ex instanceof java.io.InterruptedIOException) {
                Thread.currentThread().interrupt();
            }
            throw new RestClientException("pricing-forecast недоступен: " + ex.getMessage(), ex);
        }
    }

    // --- DTO контракта pricing-forecast (snake_case, см. schemas/quote.py) ---
    record LineReq(@JsonProperty("category_id") int categoryId, @JsonProperty("stay_date") LocalDate stayDate) { }

    record BatchReq(List<LineReq> lines, @JsonProperty("fix_quote") boolean fixQuote) { }

    @JsonIgnoreProperties(ignoreUnknown = true)
    record LineResp(@JsonProperty("category_id") int categoryId, @JsonProperty("stay_date") LocalDate stayDate,
                    BigDecimal price, @JsonProperty("out_of_corridor") boolean outOfCorridor,
                    @JsonProperty("quote_id") UUID quoteId, boolean fallback) { }

    @JsonIgnoreProperties(ignoreUnknown = true)
    record BatchResp(List<LineResp> lines) { }
}
