package sanatorium.core.booking;

import java.math.BigDecimal;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import sanatorium.core.common.ApiException;
import sanatorium.core.common.Dtos.VoucherView;
import sanatorium.core.payment.PaymentKind;
import sanatorium.core.payment.PaymentRepository;
import sanatorium.core.payment.PaymentStatus;

/** Сборка представления путёвки: данные брони и номера (JPQL) плюс уплаченная сумма (агрегат по платежам). */
@Service
public class VoucherViewService {

    private final VoucherRepository vouchers;
    private final PaymentRepository payments;

    public VoucherViewService(VoucherRepository vouchers, PaymentRepository payments) {
        this.vouchers = vouchers;
        this.payments = payments;
    }

    @Transactional(readOnly = true)
    public Optional<VoucherView> view(long voucherId) {
        return vouchers.findSummary(voucherId).map(s -> toView(s, nz(payments.sumAmount(voucherId, PaymentKind.PREPAY, PaymentStatus.SUCCESS))));
    }

    @Transactional(readOnly = true)
    public List<VoucherView> viewsByClient(long clientId) {
        return attachPaid(vouchers.findSummariesByClient(clientId));
    }

    /** Список путёвок для администратора (ФТ-07): с фильтром по статусу, без фильтра — все. */
    @Transactional(readOnly = true)
    public List<VoucherView> viewsAll(String status) {
        if (status != null && !status.isBlank()) {
            return viewsByStatus(status);
        }
        return attachPaid(vouchers.findSummariesAll());
    }

    @Transactional(readOnly = true)
    public List<VoucherView> viewsByStatus(String status) {
        VoucherStatus parsed;
        try {
            parsed = VoucherStatus.valueOf(status.trim());
        } catch (IllegalArgumentException ex) {
            throw ApiException.badRequest("Неизвестный статус: " + status);
        }
        return attachPaid(vouchers.findSummariesByStatus(parsed));
    }

    /** Сопоставляет каждой путёвке уплаченную сумму одним агрегатным запросом. */
    private List<VoucherView> attachPaid(List<VoucherSummary> summaries) {
        if (summaries.isEmpty()) {
            return List.of();
        }
        Map<Long, BigDecimal> paid = new HashMap<>();
        for (Object[] row : payments.sumAmountByVouchers(summaries.stream().map(VoucherSummary::id).toList(),
                PaymentKind.PREPAY, PaymentStatus.SUCCESS)) {
            paid.put((Long) row[0], (BigDecimal) row[1]);
        }
        return summaries.stream().map(s -> toView(s, paid.getOrDefault(s.id(), BigDecimal.ZERO))).toList();
    }

    private static VoucherView toView(VoucherSummary s, BigDecimal paid) {
        return new VoucherView(s.id(), s.clientId(), s.status().name(), s.categoryId(), s.roomNumber(), s.checkIn(),
                s.checkOut(), s.places(), s.pricePerPlaceDay(), s.totalPrice(), s.currency(), s.paymentDeadline(), paid);
    }

    static BigDecimal nz(BigDecimal v) {
        return v == null ? BigDecimal.ZERO : v;
    }
}
