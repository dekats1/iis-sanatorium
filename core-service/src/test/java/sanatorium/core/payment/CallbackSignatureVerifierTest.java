package sanatorium.core.payment;

import java.math.BigDecimal;
import org.junit.jupiter.api.Test;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

class CallbackSignatureVerifierTest {

    // Контрольный вектор посчитан независимо (Python hmac.new(b"k", b"1|2|SUCCESS|300.00", sha256));
    // тот же вектор используется в тесте payment-emulator — так проверяется совместимость сервисов.
    private static final String VECTOR = "38d4c97233fd82113449e8e0382d4cc4c6de39599cdf9382f5cd9f4f06710f46";

    @Test
    void matchesIndependentlyComputedVector() {
        assertEquals(VECTOR, CallbackSignatureVerifier.sign("k", 1, 2, "SUCCESS", new BigDecimal("300")));
    }

    @Test
    void verifyIsScaleInsensitiveAndRejectsTampering() {
        assertTrue(CallbackSignatureVerifier.verify("k", VECTOR, 1, 2, "SUCCESS", new BigDecimal("300.00")));
        assertFalse(CallbackSignatureVerifier.verify("k", VECTOR, 1, 2, "DECLINED", new BigDecimal("300.00")));
        assertFalse(CallbackSignatureVerifier.verify("k", VECTOR, 1, 2, "SUCCESS", new BigDecimal("301.00")));
        assertFalse(CallbackSignatureVerifier.verify("k", VECTOR, 1, 3, "SUCCESS", new BigDecimal("300.00")));
        assertFalse(CallbackSignatureVerifier.verify("other", VECTOR, 1, 2, "SUCCESS", new BigDecimal("300.00")));
        assertFalse(CallbackSignatureVerifier.verify("k", null, 1, 2, "SUCCESS", new BigDecimal("300.00")));
    }
}
