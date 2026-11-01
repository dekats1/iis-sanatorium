package sanatorium.payment;

import static org.junit.jupiter.api.Assertions.assertEquals;

import java.math.BigDecimal;
import org.junit.jupiter.api.Test;

class PaymentSignatureTest {

    // Тот же контрольный вектор, что в core-service/CallbackSignatureVerifierTest (подпись должна совпадать у обоих сервисов).
    @Test
    void matchesCoreServiceVector() {
        assertEquals("38d4c97233fd82113449e8e0382d4cc4c6de39599cdf9382f5cd9f4f06710f46",
                PaymentSignature.sign("k", 1, 2, "SUCCESS", new BigDecimal("300")));
    }
}
