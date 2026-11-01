package sanatorium.core.payment;

import jakarta.persistence.LockModeType;
import java.math.BigDecimal;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface PaymentRepository extends JpaRepository<Payment, Long> {

    Optional<Payment> findFirstByVoucherIdAndKindAndStatusOrderByIdDesc(Long voucherId, PaymentKind kind, PaymentStatus status);

    /** Блокировка платежа по счёту (вызывается после блокировки путёвки). */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    Optional<Payment> findByVoucherIdAndInvoiceId(Long voucherId, Long invoiceId);

    /** Сумма платежей данного вида и статуса по путёвке; null, если платежей нет. */
    @Query("select sum(p.amount) from Payment p where p.voucherId = :voucherId and p.kind = :kind and p.status = :status")
    BigDecimal sumAmount(@Param("voucherId") Long voucherId, @Param("kind") PaymentKind kind, @Param("status") PaymentStatus status);

    /** Суммы по набору путёвок одним запросом: строки (voucherId, sum). */
    @Query("""
            select p.voucherId, sum(p.amount) from Payment p
             where p.voucherId in :voucherIds and p.kind = :kind and p.status = :status
             group by p.voucherId
            """)
    List<Object[]> sumAmountByVouchers(@Param("voucherIds") Collection<Long> voucherIds, @Param("kind") PaymentKind kind,
                                       @Param("status") PaymentStatus status);
}
