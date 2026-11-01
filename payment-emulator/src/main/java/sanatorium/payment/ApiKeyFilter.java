package sanatorium.payment;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

/** Защита создания счетов ключом X-Api-Key (межсервисная аутентификация). Страницы оплаты плательщика открыты. */
@Component
public class ApiKeyFilter extends OncePerRequestFilter {

    private final byte[] expected;

    public ApiKeyFilter(PaymentProperties props) {
        this.expected = props.apiKey().getBytes(StandardCharsets.UTF_8);
    }

    @Override
    protected boolean shouldNotFilter(HttpServletRequest request) {
        return !request.getRequestURI().startsWith("/invoices");
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
            throws ServletException, IOException {
        String key = request.getHeader("X-Api-Key");
        boolean ok = key != null && MessageDigest.isEqual(expected, key.getBytes(StandardCharsets.UTF_8));
        if (!ok) {
            response.sendError(HttpServletResponse.SC_UNAUTHORIZED, "Invalid API key");
            return;
        }
        chain.doFilter(request, response);
    }
}
