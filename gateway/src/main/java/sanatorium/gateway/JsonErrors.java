package sanatorium.gateway;

import java.nio.charset.StandardCharsets;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.web.server.ServerWebExchange;
import reactor.core.publisher.Mono;

/**
 * Единый формат ошибок шлюза — тот же RFC 9457 (application/problem+json), что у core-service:
 * {"type":"about:blank","title":…,"status":…,"detail":…}. JSON собирается вручную: сообщения фиксированные,
 * зависимость от конкретной версии Jackson не нужна.
 */
final class     JsonErrors {

    private JsonErrors() { }

    static Mono<Void> write(ServerWebExchange exchange, HttpStatus status, String detail) {
        var response = exchange.getResponse();
        if (response.isCommitted()) {
            return Mono.empty();
        }
        response.setStatusCode(status);
        response.getHeaders().setContentType(MediaType.APPLICATION_PROBLEM_JSON);
        String json = "{\"type\":\"about:blank\",\"title\":\"" + escape(status.getReasonPhrase()) + "\",\"status\":"
                + status.value() + ",\"detail\":\"" + escape(detail) + "\"}";
        return response.writeWith(Mono.just(response.bufferFactory().wrap(json.getBytes(StandardCharsets.UTF_8))));
    }

    static String escape(String s) {
        StringBuilder sb = new StringBuilder(s.length() + 8);
        for (char c : s.toCharArray()) {
            switch (c) {
                case '"' -> sb.append("\\\"");
                case '\\' -> sb.append("\\\\");
                case '\n' -> sb.append("\\n");
                case '\r' -> sb.append("\\r");
                case '\t' -> sb.append("\\t");
                default -> {
                    if (c < 0x20) {
                        sb.append(String.format("\\u%04x", (int) c));
                    } else {
                        sb.append(c);
                    }
                }
            }
        }
        return sb.toString();
    }
}
