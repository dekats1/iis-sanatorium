package sanatorium.core.ehr;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.math.BigDecimal;
import java.time.OffsetDateTime;

@Entity
@Table(name = "ehr_records")
public class EhrRecord {

    @Id
    @Column(name = "client_id")
    private Long clientId;

    @Column(name = "sanatorium_card_number", length = 64)
    private String sanatoriumCardNumber = "СКК-2026/001";

    @Column(name = "blood_type", length = 32)
    private String bloodType = "A (II) Rh+";

    @Column(name = "allergies")
    private String allergies = "Нет аллергических реакций";

    @Column(name = "chronic_diseases")
    private String chronicDiseases;

    @Column(name = "height_cm")
    private Integer heightCm = 176;

    @Column(name = "weight_kg", precision = 5, scale = 1)
    private BigDecimal weightKg = BigDecimal.valueOf(73.5);

    @Column(name = "blood_pressure_systolic")
    private Integer bloodPressureSystolic = 120;

    @Column(name = "blood_pressure_diastolic")
    private Integer bloodPressureDiastolic = 80;

    @Column(name = "pulse")
    private Integer pulse = 68;

    @Column(name = "updated_at", nullable = false)
    private OffsetDateTime updatedAt = OffsetDateTime.now();

    public EhrRecord() {
    }

    public EhrRecord(Long clientId) {
        this.clientId = clientId;
    }

    public Long getClientId() {
        return clientId;
    }

    public void setClientId(Long clientId) {
        this.clientId = clientId;
    }

    public String getSanatoriumCardNumber() {
        return sanatoriumCardNumber;
    }

    public void setSanatoriumCardNumber(String sanatoriumCardNumber) {
        this.sanatoriumCardNumber = sanatoriumCardNumber;
    }

    public String getBloodType() {
        return bloodType;
    }

    public void setBloodType(String bloodType) {
        this.bloodType = bloodType;
    }

    public String getAllergies() {
        return allergies;
    }

    public void setAllergies(String allergies) {
        this.allergies = allergies;
    }

    public String getChronicDiseases() {
        return chronicDiseases;
    }

    public void setChronicDiseases(String chronicDiseases) {
        this.chronicDiseases = chronicDiseases;
    }

    public Integer getHeightCm() {
        return heightCm;
    }

    public void setHeightCm(Integer heightCm) {
        this.heightCm = heightCm;
    }

    public BigDecimal getWeightKg() {
        return weightKg;
    }

    public void setWeightKg(BigDecimal weightKg) {
        this.weightKg = weightKg;
    }

    public Integer getBloodPressureSystolic() {
        return bloodPressureSystolic;
    }

    public void setBloodPressureSystolic(Integer bloodPressureSystolic) {
        this.bloodPressureSystolic = bloodPressureSystolic;
    }

    public Integer getBloodPressureDiastolic() {
        return bloodPressureDiastolic;
    }

    public void setBloodPressureDiastolic(Integer bloodPressureDiastolic) {
        this.bloodPressureDiastolic = bloodPressureDiastolic;
    }

    public Integer getPulse() {
        return pulse;
    }

    public void setPulse(Integer pulse) {
        this.pulse = pulse;
    }

    public OffsetDateTime getUpdatedAt() {
        return updatedAt;
    }

    public void setUpdatedAt(OffsetDateTime updatedAt) {
        this.updatedAt = updatedAt;
    }
}
