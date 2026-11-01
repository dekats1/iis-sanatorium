package sanatorium.core.audit;

import java.time.OffsetDateTime;

/** Запись журнала с логином пользователя (null, если пользователь удалён или запрос служебный). */
public record AuditRow(Long id, OffsetDateTime createdAt, Long userId, String username, String action, String entity,
                       String details) { }
