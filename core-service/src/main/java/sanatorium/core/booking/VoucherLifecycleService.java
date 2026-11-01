package sanatorium.core.booking;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.List;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import sanatorium.core.common.ApiException;
import sanatorium.core.payment.Payment;
import sanatorium.core.payment.PaymentKind;
import sanatorium.core.payment.PaymentRepository;
import sanatorium.core.payment.PaymentStatus;
import sanatorium.core.pricingclient.BookingStatusChanged;

/**
 * Жизненный цикл путёвки после оформления: отмена с удержаниями (ФТ-09), заезд и выезд (ФТ-10),
 * истечение срока оплаты. Во всех операциях путёвка блокируется первой (PESSIMISTIC_WRITE → SELECT … FOR UPDATE) —
 * единый порядок блокировок с обработкой платёжного вебхука исключает взаимные блокировки.
 */
@Service
public class VoucherLifecycleService {

    private static final Logger log = LoggerFactory.getLogger(VoucherLifecycleService.class);

    private final VoucherRepository vouchers;
    private final BookingRepository bookings;
    private final PaymentRepository payments;
    private final ApplicationEventPublisher events;
    private final WaitlistService waitlist;
    private final CancellationCalculator calculator;

    public VoucherLifecycleService(VoucherRepository vouchers, BookingRepository bookings, PaymentRepository payments,
                                   ApplicationEventPublisher events, WaitlistService waitlist) {
        this.vouchers = vouchers;
        this.bookings = bookings;
        this.payments = payments;
        this.events = events;
        this.waitlist = waitlist;
        this.calculator = new CancellationCalculator();
    }

    /**
     * Отмена до заезда (из AWAITING_PAYMENT и CONFIRMED). Удержание считает CancellationCalculator по числу суток
     * до заезда; к возврату создаётся запись REFUND (PENDING) на оставшуюся часть уплаченной предоплаты.
     * Места освобождаются сразу, подходящие записи листа ожидания переводятся в NOTIFIED.
     */
    @Transactional
    public CancellationCalculator.Result cancel(long voucherId) {
        Voucher v = lock(voucherId);
        boolean wasConfirmed = v.getStatus() == VoucherStatus.CONFIRMED;
        if (!wasConfirmed && v.getStatus() != VoucherStatus.AWAITING_PAYMENT) {
            throw ApiException.conflict("Путёвку в статусе " + v.getStatus() + " отменить нельзя");
        }
        List<Long> bookingIds = bookings.findIdsByVoucherId(voucherId);
        List<Integer> categories = bookings.findCategoryIdsByVoucher(voucherId);
        LocalDate checkIn = bookings.findCheckInDate(voucherId).orElse(LocalDate.now());
        BigDecimal paid = nz(payments.sumAmount(voucherId, PaymentKind.PREPAY, PaymentStatus.SUCCESS));
        var result = calculator.calculate(checkIn, LocalDate.now(), v.getTotalPrice(), paid);

        v.setStatus(VoucherStatus.CANCELLED);
        bookings.updateStatusByVoucher(voucherId, BookingStatus.CANCELLED); // триггер БД освобождает места
        if (result.refund().signum() > 0) {
            payments.save(new Payment(voucherId, PaymentKind.REFUND, result.refund()));
        }
        if (wasConfirmed) { // в спрос pricing-forecast попадали только подтверждённые брони
            bookingIds.forEach(id -> events.publishEvent(new BookingStatusChanged(id, BookingStatusChanged.Type.CANCELLED)));
        }
        waitlist.notifyFreed(categories);
        return result;
    }

    /** Регистрация заезда (ФТ-10): только оплаченная путёвка и не раньше даты заезда. */
    @Transactional
    public void checkIn(long voucherId) {
        Voucher v = lock(voucherId);
        if (v.getStatus() != VoucherStatus.CONFIRMED) {
            throw ApiException.conflict("Заезд возможен только для оплаченной путёвки (статус CONFIRMED), сейчас " + v.getStatus());
        }
        LocalDate checkIn = bookings.findCheckInDate(voucherId).orElseThrow(() -> ApiException.conflict("У путёвки нет брони"));
        LocalDate checkOut = bookings.findCheckOutDate(voucherId).orElseThrow();
        LocalDate today = LocalDate.now();
        if (today.isBefore(checkIn)) {
            throw ApiException.conflict("Заезд возможен не раньше " + checkIn);
        }
        if (!today.isBefore(checkOut)) {
            throw ApiException.conflict("Срок проживания по путёвке уже истёк");
        }
        v.setStatus(VoucherStatus.CHECKED_IN);
        bookings.updateStatusByVoucher(voucherId, BookingStatus.CHECKED_IN);
    }

    /** Выписка (ФТ-10). Места остаются закреплёнными за прошедшим периодом — для KPI по факту проживания. */
    @Transactional
    public void checkOut(long voucherId) {
        Voucher v = lock(voucherId);
        if (v.getStatus() != VoucherStatus.CHECKED_IN) {
            throw ApiException.conflict("Выписка возможна только после заезда (статус CHECKED_IN), сейчас " + v.getStatus());
        }
        v.setStatus(VoucherStatus.COMPLETED);
        bookings.updateStatusByVoucher(voucherId, BookingStatus.COMPLETED);
    }

    /**
     * Раз в минуту: просроченные неоплаченные путёвки → EXPIRED, места освобождаются, лист ожидания уведомляется.
     * Строки берутся с блокировкой SKIP LOCKED: путёвку, которую в этот момент оплачивает вебхук, не трогаем.
     */
    @Scheduled(fixedDelayString = "PT1M")
    @Transactional
    public void expireOverdue() {
        List<Voucher> overdue = vouchers.lockOverdue(VoucherStatus.AWAITING_PAYMENT, OffsetDateTime.now());
        if (overdue.isEmpty()) {
            return;
        }
        List<Long> ids = overdue.stream().map(Voucher::getId).toList();
        overdue.forEach(v -> v.setStatus(VoucherStatus.EXPIRED));
        List<Integer> categories = bookings.findCategoryIdsByVouchers(ids);
        ids.forEach(id -> bookings.updateStatusByVoucher(id, BookingStatus.CANCELLED));
        waitlist.notifyFreed(categories);
        log.info("Истёк срок оплаты, освобождены путёвки: {}", ids);
    }

    private Voucher lock(long voucherId) {
        return vouchers.lockById(voucherId).orElseThrow(() -> ApiException.notFound("Путёвка не найдена"));
    }

    private static BigDecimal nz(BigDecimal v) {
        return v == null ? BigDecimal.ZERO : v;
    }
}
