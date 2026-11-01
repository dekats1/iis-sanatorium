package sanatorium.core.medical;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.OffsetDateTime;

/** Назначение лечения врачом по путёвке; состав (процедуры и число сеансов) — в AssignmentProcedure. */
@Entity
@Table(name = "treatment_assignments")
public class TreatmentAssignment {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "voucher_id", nullable = false)
    private Long voucherId;

    @Column(name = "doctor_id", nullable = false)
    private Long doctorId;

    @Column(name = "created_at", nullable = false)
    private OffsetDateTime createdAt = OffsetDateTime.now();

    protected TreatmentAssignment() { }

    public TreatmentAssignment(Long voucherId, Long doctorId) {
        this.voucherId = voucherId;
        this.doctorId = doctorId;
    }

    public Long getId() { return id; }
    public Long getVoucherId() { return voucherId; }
    public Long getDoctorId() { return doctorId; }
    public OffsetDateTime getCreatedAt() { return createdAt; }
}
