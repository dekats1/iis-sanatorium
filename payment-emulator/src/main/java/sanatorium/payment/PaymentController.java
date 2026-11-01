package sanatorium.payment;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.math.BigDecimal;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class PaymentController {

    public record InvoiceRequest(@NotNull Long externalId,
                                 @NotNull @DecimalMin("0.01") BigDecimal amount,
                                 @NotBlank @Size(min = 3, max = 3) String currency,
                                 @NotBlank @Size(max = 500) String callbackUrl) { }

    public record InvoiceResponse(long invoiceId, String payUrl) { }

    private final PaymentEmulatorService service;

    public PaymentController(PaymentEmulatorService service) {
        this.service = service;
    }

    /** Создание счёта (вызывает core-service, защищено X-Api-Key). */
    @PostMapping("/invoices")
    @ResponseStatus(HttpStatus.CREATED)
    public InvoiceResponse create(@Valid @RequestBody InvoiceRequest req) {
        return service.create(req);
    }

    /** Страница «банка» для плательщика: две кнопки — оплатить или отклонить (имитация). */
    @GetMapping(value = "/pay/{invoiceId}", produces = MediaType.TEXT_HTML_VALUE)
    public String payPage(@PathVariable long invoiceId, HttpServletRequest request) {
        return service.payPage(invoiceId, request);
    }

    @PostMapping(value = "/pay/{invoiceId}/result", produces = MediaType.TEXT_HTML_VALUE)
    public String result(@PathVariable long invoiceId, @RequestParam("status") String status,
                         @RequestParam(value = "return", required = false) String returnUrl) {
        return service.complete(invoiceId, status, returnUrl);
    }
}
