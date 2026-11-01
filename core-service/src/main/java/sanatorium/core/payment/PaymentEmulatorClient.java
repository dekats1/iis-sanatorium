package sanatorium.core.payment;

import java.math.BigDecimal;
import java.net.http.HttpClient;
import java.time.Duration;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import org.springframework.http.MediaType;
import org.springframework.http.client.JdkClientHttpRequestFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;
import sanatorium.core.common.ApiException;
import sanatorium.core.common.CoreProperties;

/**
 * Клиент платёжного сервиса (в прототипе — payment-emulator): POST /invoices (поток 6, раздел 2.5 главы 2).
 * Аутентификация вызова — ключ X-Api-Key; обратное уведомление подписывается HMAC (см. CallbackSignatureVerifier).
 */
@Component
public class PaymentEmulatorClient {

    public record Invoice(long invoiceId, String payUrl) { }

    @JsonIgnoreProperties(ignoreUnknown = true)
    record InvoiceResp(long invoiceId, String payUrl) { }

    record InvoiceReq(long externalId, BigDecimal amount, String currency, String callbackUrl) { }

    private final RestClient rest;
    private final String apiKey;

    public PaymentEmulatorClient(CoreProperties props) {
        var http = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(2)).build();
        var factory = new JdkClientHttpRequestFactory(http);
        factory.setReadTimeout(Duration.ofSeconds(5));
        this.rest = RestClient.builder().baseUrl(props.payment().baseUrl()).requestFactory(factory).build();
        this.apiKey = props.payment().apiKey();
    }

    public Invoice createInvoice(long voucherId, BigDecimal amount, String currency, String callbackUrl) {
        try {
            InvoiceResp resp = rest.post().uri("/invoices")
                    .header("X-Api-Key", apiKey)
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(new InvoiceReq(voucherId, amount, currency, callbackUrl))
                    .retrieve()
                    .body(InvoiceResp.class);
            if (resp == null) {
                throw ApiException.badGateway("Платёжный сервис вернул пустой ответ");
            }
            return new Invoice(resp.invoiceId(), resp.payUrl());
        } catch (RestClientException ex) {
            throw ApiException.badGateway("Платёжный сервис недоступен, повторите попытку позже");
        }
    }
}
