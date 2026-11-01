package sanatorium.core.medical;

import jakarta.persistence.Column;
import jakarta.persistence.EmbeddedId;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;

/** Строка назначения: процедура и плановое число сеансов. */
@Entity
@Table(name = "assignment_procedures")
public class AssignmentProcedure {

    @EmbeddedId
    private AssignmentProcedureId id;

    @Column(name = "sessions_planned", nullable = false)
    private Integer sessionsPlanned;

    protected AssignmentProcedure() { }

    public AssignmentProcedure(Long assignmentId, Integer procedureId, Integer sessionsPlanned) {
        this.id = new AssignmentProcedureId(assignmentId, procedureId);
        this.sessionsPlanned = sessionsPlanned;
    }

    public AssignmentProcedureId getId() { return id; }
    public Integer getSessionsPlanned() { return sessionsPlanned; }
}
