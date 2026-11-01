package sanatorium.core.medical;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.OffsetDateTime;

/** Сеанс процедуры в расписании (таблица procedure_schedule). */
@Entity
@Table(name = "procedure_schedule")
public class ScheduleSlot {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "assignment_id", nullable = false)
    private Long assignmentId;

    @Column(name = "procedure_id", nullable = false)
    private Integer procedureId;

    @Column(name = "slot_dt", nullable = false)
    private OffsetDateTime slotDt;

    @Column(name = "done", nullable = false)
    private boolean done;

    protected ScheduleSlot() { }

    public ScheduleSlot(Long assignmentId, Integer procedureId, OffsetDateTime slotDt) {
        this.assignmentId = assignmentId;
        this.procedureId = procedureId;
        this.slotDt = slotDt;
    }

    public Long getId() { return id; }
    public Long getAssignmentId() { return assignmentId; }
    public Integer getProcedureId() { return procedureId; }
    public OffsetDateTime getSlotDt() { return slotDt; }
    public boolean isDone() { return done; }
    public void setDone(boolean done) { this.done = done; }
}
