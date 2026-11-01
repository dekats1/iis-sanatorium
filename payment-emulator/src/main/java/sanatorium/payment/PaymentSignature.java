package sanatorium.payment;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.nio.charset.StandardCharsets;
import java.security.InvalidKeyException;
import java.security.NoSuchAlgorithmException;
import java.util.HexFormat;
import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;

/**
 * Подпись вебхука — тот же алгоритм, что в core-service (payment/CallbackSignatureVerifier):
 * HMAC-SHA256 от «externalId|invoiceId|status|amount», сумма с двумя знаками, hex в нижнем регистре.
 * Код намеренно продублирован: сервисы независимы, общей библиотеки в прототипе нет.
 */
final class PaymentSignature {

    private PaymentSignature() { }

    static String sign(String secret, long externalId, long invoiceId, String status, BigDecimal amount) {
        try {
            Mac mac = Mac.getInstance("HmacSHA256");
            mac.init(new SecretKeySpec(secret.getBytes(StandardCharsets.UTF_8), "HmacSHA256"));
            String canonical = externalId + "|" + invoiceId + "|" + status + "|"
                    + amount.setScale(2, RoundingMode.HALF_UP).toPlainString();
            return HexFormat.of().formatHex(mac.doFinal(canonical.getBytes(StandardCharsets.UTF_8)));
        } catch (NoSuchAlgorithmException | InvalidKeyException e) {
            throw new IllegalStateException("HMAC недоступен", e);
        }
    }
}
