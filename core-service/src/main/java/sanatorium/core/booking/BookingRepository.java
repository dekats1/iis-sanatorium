package sanatorium.core.booking;

import java.time.LocalDate;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.transaction.annotation.Transactional;

/**
 * Брони и койко-места. Запросы JPQL — для обычных выборок; нативный SQL — только там, где нужны возможности
 * PostgreSQL вне JPA: generate_series, тип daterange и оператор пересечения (&&).
 */
public interface BookingRepository extends JpaRepository<Booking, Long> {

    @Query("select b.id from Booking b where b.voucherId = :voucherId order by b.id")
    List<Long> findIdsByVoucherId(@Param("voucherId") Long voucherId);

    /** Меняет статус броней путёвки; триггер bookings_sync_active освобождает места при CANCELLED. */
    @Modifying(flushAutomatically = true)
    @Transactional
    @Query("update Booking b set b.status = :status where b.voucherId = :voucherId")
    int updateStatusByVoucher(@Param("voucherId") Long voucherId, @Param("status") BookingStatus status);

    /** Дата заезда путёвки — самая ранняя из её броней; пусто, если броней нет. */
    @Query("select min(b.checkIn) from Booking b where b.voucherId = :voucherId")
    Optional<LocalDate> findCheckInDate(@Param("voucherId") Long voucherId);

    @Query("select max(b.checkOut) from Booking b where b.voucherId = :voucherId")
    Optional<LocalDate> findCheckOutDate(@Param("voucherId") Long voucherId);

    @Query("""
            select distinct r.categoryId from Booking b join Room r on r.id = b.roomId
             where b.voucherId = :voucherId
            """)
    List<Integer> findCategoryIdsByVoucher(@Param("voucherId") Long voucherId);

    @Query("""
            select distinct r.categoryId from Booking b join Room r on r.id = b.roomId
             where b.voucherId in :voucherIds
            """)
    List<Integer> findCategoryIdsByVouchers(@Param("voucherIds") Collection<Long> voucherIds);

    @Query("""
            select new sanatorium.core.booking.BookingStay(r.categoryId, b.checkIn, b.checkOut, b.placesCount)
              from Booking b join Room r on r.id = b.roomId
             where b.id = :id
            """)
    Optional<BookingStay> findStay(@Param("id") Long id);

    // ---------- койко-места (нативный SQL) ----------

    /** Свободные места категории на [checkIn; checkOut) — запрос Q1 главы 2 с разбивкой по номерам: (room_id, place_no). */
    @Query(value = """
            SELECT r.id AS room_id, p.place_no AS place_no
              FROM rooms r
              JOIN room_categories rc ON rc.id = r.category_id
             CROSS JOIN LATERAL generate_series(1, rc.capacity_total) AS p(place_no)
             WHERE r.category_id = :categoryId AND r.is_active
               AND NOT EXISTS (
                   SELECT 1 FROM booking_places bp
                    WHERE bp.room_id = r.id AND bp.place_no = p.place_no AND bp.is_active
                      AND bp.stay_range && daterange(CAST(:checkIn AS date), CAST(:checkOut AS date), '[)'))
             ORDER BY r.id, p.place_no
            """, nativeQuery = true)
    List<Object[]> findFreePlaceRows(@Param("categoryId") int categoryId, @Param("checkIn") LocalDate checkIn,
                                     @Param("checkOut") LocalDate checkOut);

    default List<FreePlace> freePlaces(int categoryId, LocalDate checkIn, LocalDate checkOut) {
        return findFreePlaceRows(categoryId, checkIn, checkOut).stream()
                .map(row -> new FreePlace(((Number) row[0]).intValue(), ((Number) row[1]).intValue()))
                .toList();
    }

    /**
     * Закрепляет одно место за бронью. Нарушение bp_no_overlap (SQLSTATE 23P01) означает гонку с другой бронью
     * и приходит как DataIntegrityViolationException.
     */
    @Modifying(flushAutomatically = true)
    @Transactional
    @Query(value = """
            INSERT INTO booking_places (booking_id, room_id, place_no, stay_range)
            VALUES (:bookingId, :roomId, :placeNo, daterange(CAST(:checkIn AS date), CAST(:checkOut AS date), '[)'))
            """, nativeQuery = true)
    int insertPlace(@Param("bookingId") Long bookingId, @Param("roomId") int roomId, @Param("placeNo") int placeNo,
                    @Param("checkIn") LocalDate checkIn, @Param("checkOut") LocalDate checkOut);
}
