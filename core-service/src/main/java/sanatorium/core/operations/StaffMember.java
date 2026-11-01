package sanatorium.core.operations;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.math.BigDecimal;
import java.time.OffsetDateTime;

@Entity
@Table(name = "staff_members")
public class StaffMember {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "full_name", nullable = false, length = 120)
    private String fullName;

    @Column(name = "role", nullable = false, length = 120)
    private String role;

    @Column(name = "cabinet_name", length = 120)
    private String cabinetName;

    @Column(name = "shift_hours", nullable = false, length = 64)
    private String shiftHours = "08:30 – 16:30";

    @Column(name = "status", nullable = false, length = 32)
    private String status = "ON_SHIFT";

    @Column(name = "assigned_slots_today", nullable = false)
    private int assignedSlotsToday = 0;

    @Column(name = "max_slots_per_day", nullable = false)
    private int maxSlotsPerDay = 15;

    @Column(name = "rating", nullable = false, precision = 3, scale = 2)
    private BigDecimal rating = BigDecimal.valueOf(4.90);

    @Column(name = "created_at", nullable = false)
    private OffsetDateTime createdAt = OffsetDateTime.now();

    public StaffMember() {
    }

    public StaffMember(String fullName, String role, String cabinetName, String shiftHours,
                       String status, int assignedSlotsToday, int maxSlotsPerDay, BigDecimal rating) {
        this.fullName = fullName;
        this.role = role;
        this.cabinetName = cabinetName;
        this.shiftHours = shiftHours;
        this.status = status;
        this.assignedSlotsToday = assignedSlotsToday;
        this.maxSlotsPerDay = maxSlotsPerDay;
        this.rating = rating;
    }

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public String getFullName() {
        return fullName;
    }

    public void setFullName(String fullName) {
        this.fullName = fullName;
    }

    public String getRole() {
        return role;
    }

    public void setRole(String role) {
        this.role = role;
    }

    public String getCabinetName() {
        return cabinetName;
    }

    public void setCabinetName(String cabinetName) {
        this.cabinetName = cabinetName;
    }

    public String getShiftHours() {
        return shiftHours;
    }

    public void setShiftHours(String shiftHours) {
        this.shiftHours = shiftHours;
    }

    public String getStatus() {
        return status;
    }

    public void setStatus(String status) {
        this.status = status;
    }

    public int getAssignedSlotsToday() {
        return assignedSlotsToday;
    }

    public void setAssignedSlotsToday(int assignedSlotsToday) {
        this.assignedSlotsToday = assignedSlotsToday;
    }

    public int getMaxSlotsPerDay() {
        return maxSlotsPerDay;
    }

    public void setMaxSlotsPerDay(int maxSlotsPerDay) {
        this.maxSlotsPerDay = maxSlotsPerDay;
    }

    public BigDecimal getRating() {
        return rating;
    }

    public void setRating(BigDecimal rating) {
        this.rating = rating;
    }

    public OffsetDateTime getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(OffsetDateTime createdAt) {
        this.createdAt = createdAt;
    }
}
