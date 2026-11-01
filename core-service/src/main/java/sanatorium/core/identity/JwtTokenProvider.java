package sanatorium.core.identity;

import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.List;
import javax.crypto.SecretKey;
import javax.crypto.spec.SecretKeySpec;
import com.nimbusds.jose.jwk.source.ImmutableSecret;
import org.springframework.security.oauth2.jose.jws.MacAlgorithm;
import org.springframework.security.oauth2.jwt.JwsHeader;
import org.springframework.security.oauth2.jwt.JwtClaimsSet;
import org.springframework.security.oauth2.jwt.JwtEncoder;
import org.springframework.security.oauth2.jwt.JwtEncoderParameters;
import org.springframework.security.oauth2.jwt.NimbusJwtEncoder;
import org.springframework.stereotype.Service;
import sanatorium.core.common.CoreProperties;

/**
 * Выпуск JWT (HS256, RFC 7519/7518): пользовательские токены при входе и
 * служебный токен SERVICE_CORE для вызовов pricing-forecast (раздел 2.4 главы 2).
 * Проверка токенов — в SecurityConfig, тем же ключом.
 */
@Service
public class JwtTokenProvider {

    public static final String SERVICE_ROLE = "SERVICE_CORE";
    private static final int MIN_KEY_BYTES = 32; // 256 бит для HS256

    private final SecretKey key;
    private final JwtEncoder encoder;
    private final CoreProperties props;

    public JwtTokenProvider(CoreProperties props) {
        this.props = props;
        byte[] bytes = props.jwt().secret().getBytes(StandardCharsets.UTF_8);
        if (bytes.length < MIN_KEY_BYTES) {
            throw new IllegalStateException("core.jwt.secret должен быть не короче 32 байт для HS256");
        }
        this.key = new SecretKeySpec(bytes, "HmacSHA256");
        this.encoder = new NimbusJwtEncoder(new ImmutableSecret<>(key));
    }

    public SecretKey key() {
        return key;
    }

    public String issueUserToken(long userId, List<String> roles) {
        return issue(String.valueOf(userId), roles, props.jwt().ttlMinutes());
    }

    /** Короткоживущий токен для межсервисного вызова (не пользовательский). */
    public String issueServiceToken() {
        return issue("core-service", List.of(SERVICE_ROLE), 5);
    }

    private String issue(String subject, List<String> roles, int ttlMinutes) {
        Instant now = Instant.now();
        JwtClaimsSet claims = JwtClaimsSet.builder()
                .issuer(props.jwt().issuer())
                .subject(subject)
                .issuedAt(now)
                .expiresAt(now.plus(ttlMinutes, ChronoUnit.MINUTES))
                .claim("roles", roles)
                .build();
        JwsHeader header = JwsHeader.with(MacAlgorithm.HS256).build();
        return encoder.encode(JwtEncoderParameters.from(header, claims)).getTokenValue();
    }
}
