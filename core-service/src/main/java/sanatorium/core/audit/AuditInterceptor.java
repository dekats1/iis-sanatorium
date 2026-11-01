package sanatorium.core.audit;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.stereotype.Component;
import org.springframework.web.servlet.HandlerInterceptor;

/**
 * Журнал действий (НФТ-04): фиксирует изменяющие запросы (POST/PUT/PATCH/DELETE) аутентифицированных пользователей:
 * метод, путь, код ответа, пользователь. Тела запросов не записываются — в них могут быть пароли и персональные данные.
 * Запись идёт в afterCompletion, т.е. вне транзакции бизнес-операции; сбой журнала не должен ломать ответ клиенту.
 */
@Component
public class AuditInterceptor implements HandlerInterceptor {

    private static final Logger log = LoggerFactory.getLogger(AuditInterceptor.class);

    private final AuditLogRepository repo;

    public AuditInterceptor(AuditLogRepository repo) {
        this.repo = repo;
    }

    @Override
    public void afterCompletion(HttpServletRequest req, HttpServletResponse resp, Object handler, Exception ex) {
        String method = req.getMethod();
        if (!isMutating(method)) {
            return;
        }
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        Long userId = null;
        if (auth != null && auth.getPrincipal() instanceof Jwt jwt && jwt.getSubject() != null
                && jwt.getSubject().chars().allMatch(Character::isDigit)) { // служебные токены (sub=core-service) не пишем как пользователя
            userId = Long.parseLong(jwt.getSubject());
        }
        String path = req.getRequestURI();
        try {
            repo.save(new AuditLog(userId, method, truncate(path, 50), "status=" + resp.getStatus()));
        } catch (RuntimeException e) {
            log.warn("Не удалось записать аудит {} {}: {}", method, path, e.toString());
        }
    }

    static boolean isMutating(String method) {
        return "POST".equals(method) || "PUT".equals(method) || "PATCH".equals(method) || "DELETE".equals(method);
    }

    static String truncate(String s, int max) {
        return s.length() <= max ? s : s.substring(0, max);
    }
}
