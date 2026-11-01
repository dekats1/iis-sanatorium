package sanatorium.core.booking;

import jakarta.persistence.Column;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.LocalDate;
import java.time.OffsetDateTime;

/** Запись листа ожидания (таблица waitlist). */
@Entity
@Table(name = "waitlist")
public class WaitlistItem {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "client_id", nullable = false)
    private Long clientId;

    @Column(name = "category_id", nullable = false)
    private Integer categoryId;

    @Column(name = "date_from", nullable = false)
    private LocalDate dateFrom;

    @Column(name = "date_to", nullable = false)
    private LocalDate dateTo;

    @Column(name = "places", nullable = false)
    private Integer places;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false)
    private WaitlistStatus status = WaitlistStatus.OPEN;

    @Column(name = "created_at", nullable = false)
    private OffsetDateTime createdAt = OffsetDateTime.now();

    protected WaitlistItem() { }

    public WaitlistItem(Long clientId, Integer categoryId, LocalDate dateFrom, LocalDate dateTo, Integer places) {
        this.clientId = clientId;
        this.categoryId = categoryId;
        this.dateFrom = dateFrom;
        this.dateTo = dateTo;
        this.places = places;
    }

    public Long getId() { return id; }
    public Long getClientId() { return clientId; }
    public Integer getCategoryId() { return categoryId; }
    public LocalDate getDateFrom() { return dateFrom; }
    public LocalDate getDateTo() { return dateTo; }
    public Integer getPlaces() { return places; }
    public WaitlistStatus getStatus() { return status; }
    public void setStatus(WaitlistStatus status) { this.status = status; }
    public OffsetDateTime getCreatedAt() { return createdAt; }
}
