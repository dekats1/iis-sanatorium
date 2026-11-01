package sanatorium.core.payment;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.nio.charset.StandardCharsets;
import java.security.InvalidKeyException;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.HexFormat;
import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;

/**
 * HMAC-SHA256 подпись вебхука платёжного сервиса (поток 7, раздел 2.5 главы 2).
 * Подписывается каноническая строка externalId|invoiceId|status|amount, сумма — с двумя знаками.
 * Тот же алгоритм реализован в payment-emulator.
 */
public final class CallbackSignatureVerifier {

    private CallbackSignatureVerifier() { }

    public static String canonical(long externalId, long invoiceId, String status, BigDecimal amount) {
        return externalId + "|" + invoiceId + "|" + status + "|" + amount.setScale(2, RoundingMode.HALF_UP).toPlainString();
    }

    public static String sign(String secret, long externalId, long invoiceId, String status, BigDecimal amount) {
        try {
            Mac mac = Mac.getInstance("HmacSHA256");
            mac.init(new SecretKeySpec(secret.getBytes(StandardCharsets.UTF_8), "HmacSHA256"));
            byte[] raw = mac.doFinal(canonical(externalId, invoiceId, status, amount).getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(raw);
        } catch (NoSuchAlgorithmException | InvalidKeyException e) {
            throw new IllegalStateException("HMAC недоступен", e);
        }
    }

    /** Сравнение за постоянное время (защита от timing-атак). */
    public static boolean verify(String secret, String signature, long externalId, long invoiceId, String status, BigDecimal amount) {
        if (signature == null) {
            return false;
        }
        String expected = sign(secret, externalId, invoiceId, status, amount);
        return MessageDigest.isEqual(expected.getBytes(StandardCharsets.UTF_8), signature.getBytes(StandardCharsets.UTF_8));
    }
}
