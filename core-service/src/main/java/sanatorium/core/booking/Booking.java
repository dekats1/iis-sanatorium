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

/**
 * Бронь: один номер на период [checkIn; checkOut). Конкретные койко-места (booking_places, daterange и
 * ограничение EXCLUDE) в модель JPA не отображаются: их вставка и поиск свободных мест выполняются нативными
 * запросами BookingRepository, потому что Hibernate не знает тип daterange и оператор пересечения.
 * Статус брони синхронизирует признак активности мест триггером БД.
 */
@Entity
@Table(name = "bookings")
public class Booking {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "voucher_id", nullable = false)
    private Long voucherId;

    @Column(name = "room_id", nullable = false)
    private Integer roomId;

    @Column(name = "check_in", nullable = false)
    private LocalDate checkIn;

    @Column(name = "check_out", nullable = false)
    private LocalDate checkOut;

    @Column(name = "places_count", nullable = false)
    private Integer placesCount;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false)
    private BookingStatus status = BookingStatus.ACTIVE;

    protected Booking() { }

    public Booking(Long voucherId, Integer roomId, LocalDate checkIn, LocalDate checkOut, Integer placesCount) {
        this.voucherId = voucherId;
        this.roomId = roomId;
        this.checkIn = checkIn;
        this.checkOut = checkOut;
        this.placesCount = placesCount;
    }

    public Long getId() { return id; }
    public Long getVoucherId() { return voucherId; }
    public Integer getRoomId() { return roomId; }
    public LocalDate getCheckIn() { return checkIn; }
    public LocalDate getCheckOut() { return checkOut; }
    public Integer getPlacesCount() { return placesCount; }
    public BookingStatus getStatus() { return status; }
    public void setStatus(BookingStatus status) { this.status = status; }
}
