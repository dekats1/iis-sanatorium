package sanatorium.core.client;

import jakarta.persistence.Column;
import jakarta.persistence.Embeddable;
import java.io.Serializable;
import java.util.Objects;

/** Составной ключ client_conditions (client_id, condition_id). */
@Embeddable
public class ClientConditionId implements Serializable {

    @Column(name = "client_id")
    private Long clientId;

    @Column(name = "condition_id")
    private Integer conditionId;

    protected ClientConditionId() { }

    public ClientConditionId(Long clientId, Integer conditionId) {
        this.clientId = clientId;
        this.conditionId = conditionId;
    }

    public Long getClientId() { return clientId; }
    public Integer getConditionId() { return conditionId; }

    @Override
    public boolean equals(Object o) {
        return o instanceof ClientConditionId other
                && Objects.equals(clientId, other.clientId) && Objects.equals(conditionId, other.conditionId);
    }

    @Override
    public int hashCode() {
        return Objects.hash(clientId, conditionId);
    }
}
