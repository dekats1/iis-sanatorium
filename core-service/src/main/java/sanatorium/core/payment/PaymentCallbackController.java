package sanatorium.core.payment;

import jakarta.validation.Valid;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import sanatorium.core.common.Dtos.CallbackRequest;

/** Вебхук платёжного сервиса. Не требует JWT; подлинность подтверждается HMAC-подписью X-Signature. */
@RestController
@RequestMapping("/api/payments")
@Tag(name = "payments", description = "Уведомления платёжного сервиса")
public class PaymentCallbackController {

    private final PaymentService payments;

    public PaymentCallbackController(PaymentService payments) {
        this.payments = payments;
    }

    @PostMapping("/callback")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void callback(@Valid @RequestBody CallbackRequest req,
                         @RequestHeader(value = "X-Signature", required = false) String signature) {
        payments.handleCallback(req, signature);
    }
}
