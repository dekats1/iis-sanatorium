package sanatorium.core.medical;

import jakarta.persistence.Column;
import jakarta.persistence.Embeddable;
import java.io.Serializable;
import java.util.Objects;

/** Составной ключ assignment_procedures (assignment_id, procedure_id). */
@Embeddable
public class AssignmentProcedureId implements Serializable {

    @Column(name = "assignment_id")
    private Long assignmentId;

    @Column(name = "procedure_id")
    private Integer procedureId;

    protected AssignmentProcedureId() { }

    public AssignmentProcedureId(Long assignmentId, Integer procedureId) {
        this.assignmentId = assignmentId;
        this.procedureId = procedureId;
    }

    public Long getAssignmentId() { return assignmentId; }
    public Integer getProcedureId() { return procedureId; }

    @Override
    public boolean equals(Object o) {
        return o instanceof AssignmentProcedureId other
                && Objects.equals(assignmentId, other.assignmentId) && Objects.equals(procedureId, other.procedureId);
    }

    @Override
    public int hashCode() {
        return Objects.hash(assignmentId, procedureId);
    }
}
