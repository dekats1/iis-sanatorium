package sanatorium.core.audit;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.OffsetDateTime;

/** Запись журнала действий (таблица audit_log). */
@Entity
@Table(name = "audit_log")
public class AuditLog {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "user_id")
    private Long userId;

    @Column(name = "action", nullable = false)
    private String action;

    @Column(name = "entity", nullable = false)
    private String entity;

    @Column(name = "entity_id")
    private String entityId;

    @Column(name = "details")
    private String details;

    @Column(name = "created_at", nullable = false)
    private OffsetDateTime createdAt = OffsetDateTime.now();

    protected AuditLog() { }

    public AuditLog(Long userId, String action, String entity, String details) {
        this.userId = userId;
        this.action = action;
        this.entity = entity;
        this.details = details;
    }

    public Long getId() { return id; }
    public Long getUserId() { return userId; }
    public String getAction() { return action; }
    public String getEntity() { return entity; }
    public String getEntityId() { return entityId; }
    public String getDetails() { return details; }
    public OffsetDateTime getCreatedAt() { return createdAt; }
}
