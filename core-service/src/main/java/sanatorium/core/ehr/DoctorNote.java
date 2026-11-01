package sanatorium.core.ehr;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.OffsetDateTime;

@Entity
@Table(name = "doctor_notes")
public class DoctorNote {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "client_id", nullable = false)
    private Long clientId;

    @Column(name = "doctor_id", nullable = false)
    private Long doctorId;

    @Column(name = "doctor_name", nullable = false, length = 120)
    private String doctorName;

    @Enumerated(EnumType.STRING)
    @Column(name = "visit_type", nullable = false, length = 32)
    private DoctorVisitType visitType = DoctorVisitType.CONTROL;

    @Column(name = "complaints", columnDefinition = "TEXT")
    private String complaints;

    @Column(name = "objective_status", columnDefinition = "TEXT")
    private String objectiveStatus;

    @Column(name = "recommendations", columnDefinition = "TEXT")
    private String recommendations;

    @Column(name = "created_at", nullable = false)
    private OffsetDateTime createdAt = OffsetDateTime.now();

    public DoctorNote() {
    }

    public DoctorNote(Long clientId, Long doctorId, String doctorName, DoctorVisitType visitType,
                      String complaints, String objectiveStatus, String recommendations) {
        this.clientId = clientId;
        this.doctorId = doctorId;
        this.doctorName = doctorName;
        this.visitType = visitType;
        this.complaints = complaints;
        this.objectiveStatus = objectiveStatus;
        this.recommendations = recommendations;
    }

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public Long getClientId() {
        return clientId;
    }

    public void setClientId(Long clientId) {
        this.clientId = clientId;
    }

    public Long getDoctorId() {
        return doctorId;
    }

    public void setDoctorId(Long doctorId) {
        this.doctorId = doctorId;
    }

    public String getDoctorName() {
        return doctorName;
    }

    public void setDoctorName(String doctorName) {
        this.doctorName = doctorName;
    }

    public DoctorVisitType getVisitType() {
        return visitType;
    }

    public void setVisitType(DoctorVisitType visitType) {
        this.visitType = visitType;
    }

    public String getComplaints() {
        return complaints;
    }

    public void setComplaints(String complaints) {
        this.complaints = complaints;
    }

    public String getObjectiveStatus() {
        return objectiveStatus;
    }

    public void setObjectiveStatus(String objectiveStatus) {
        this.objectiveStatus = objectiveStatus;
    }

    public String getRecommendations() {
        return recommendations;
    }

    public void setRecommendations(String recommendations) {
        this.recommendations = recommendations;
    }

    public OffsetDateTime getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(OffsetDateTime createdAt) {
        this.createdAt = createdAt;
    }
}
