package sanatorium.core.booking;

import jakarta.persistence.LockModeType;
import jakarta.persistence.QueryHint;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.jpa.repository.QueryHints;
import org.springframework.data.repository.query.Param;

public interface VoucherRepository extends JpaRepository<Voucher, Long> {

    /**
     * Блокировка путёвки (SELECT … FOR UPDATE). Во всех операциях жизненного цикла и в обработчике вебхука путёвка
     * блокируется первой — единый порядок исключает взаимные блокировки.
     */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select v from Voucher v where v.id = :id")
    Optional<Voucher> lockById(@Param("id") Long id);

    /**
     * Просроченные неоплаченные путёвки с блокировкой строк; SKIP LOCKED (-2) пропускает путёвки, которые прямо сейчас
     * обрабатывает платёжный вебхук или отмена: их проверит следующий запуск.
     */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @QueryHints(@QueryHint(name = "jakarta.persistence.lock.timeout", value = "-2"))
    @Query("""
            select v from Voucher v
             where v.status = :status and v.paymentDeadline < :now
             order by v.id
            """)
    List<Voucher> lockOverdue(@Param("status") VoucherStatus status, @Param("now") OffsetDateTime now);

    String SUMMARY = """
            select new sanatorium.core.booking.VoucherSummary(v.id, v.clientId, v.status, r.categoryId, r.roomNumber,
                   b.checkIn, b.checkOut, b.placesCount, v.pricePerPlaceDay, v.totalPrice, v.currency, v.paymentDeadline)
              from Voucher v
              left join Booking b on b.voucherId = v.id
              left join Room r on r.id = b.roomId
            """;

    @Query(SUMMARY + " where v.id = :id")
    Optional<VoucherSummary> findSummary(@Param("id") Long id);

    @Query(SUMMARY + " where v.clientId = :clientId order by v.id desc")
    List<VoucherSummary> findSummariesByClient(@Param("clientId") Long clientId);

    /** Рабочее место администратора (ФТ-07): все путёвки, новые сверху. */
    @Query(SUMMARY + " order by v.id desc")
    List<VoucherSummary> findSummariesAll();

    /** Те же путёвки, отфильтрованные по статусу. */
    @Query(SUMMARY + " where v.status = :status order by v.id desc")
    List<VoucherSummary> findSummariesByStatus(@Param("status") VoucherStatus status);
}
