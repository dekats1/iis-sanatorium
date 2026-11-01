package sanatorium.core.client;

import jakarta.persistence.Column;
import jakarta.persistence.EmbeddedId;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import java.time.LocalDate;

/** Состояние здоровья клиента (связь N:M клиент — состояние с датой диагноза). */
@Entity
@Table(name = "client_conditions")
public class ClientCondition {

    @EmbeddedId
    private ClientConditionId id;

    @Column(name = "diagnosed_at")
    private LocalDate diagnosedAt;

    protected ClientCondition() { }

    public ClientCondition(long clientId, int conditionId, LocalDate diagnosedAt) {
        this.id = new ClientConditionId(clientId, conditionId);
        this.diagnosedAt = diagnosedAt;
    }

    public ClientConditionId getId() { return id; }
    public LocalDate getDiagnosedAt() { return diagnosedAt; }
    public void setDiagnosedAt(LocalDate diagnosedAt) { this.diagnosedAt = diagnosedAt; }
}
