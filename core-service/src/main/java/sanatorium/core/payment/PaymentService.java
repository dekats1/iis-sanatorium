package sanatorium.core.payment;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionTemplate;
import sanatorium.core.booking.BookingRepository;
import sanatorium.core.booking.BookingStatus;
import sanatorium.core.booking.Voucher;
import sanatorium.core.booking.VoucherRepository;
import sanatorium.core.booking.VoucherStatus;
import sanatorium.core.common.ApiException;
import sanatorium.core.common.CoreProperties;
import sanatorium.core.common.Dtos.CallbackRequest;
import sanatorium.core.common.Dtos.PayResponse;
import sanatorium.core.common.Money;
import sanatorium.core.pricingclient.BookingStatusChanged;

/**
 * Оплата путёвки (поток 6–7, раздел 2.5 главы 2): выставление счёта в платёжном сервисе и
 * приём подписанного вебхука с подтверждением брони.
 */
@Service
public class PaymentService {

    private static final Logger log = LoggerFactory.getLogger(PaymentService.class);

    /** Платёж, подготовленный в транзакции, для вызова платёжного сервиса вне её. */
    private record Prepared(long paymentId, BigDecimal amount, String currency) { }

    private final VoucherRepository vouchers;
    private final BookingRepository bookings;
    private final PaymentRepository payments;
    private final PaymentEmulatorClient gateway;
    private final CoreProperties props;
    private final ApplicationEventPublisher events;
    private final TransactionTemplate tx;

    public PaymentService(VoucherRepository vouchers, BookingRepository bookings, PaymentRepository payments,
                          PaymentEmulatorClient gateway, CoreProperties props, ApplicationEventPublisher events,
                          PlatformTransactionManager txManager) {
        this.vouchers = vouchers;
        this.bookings = bookings;
        this.payments = payments;
        this.gateway = gateway;
        this.props = props;
        this.events = events;
        this.tx = new TransactionTemplate(txManager);
    }

    /** Выставляет счёт предоплаты. Повторный вызов при незавершённом платеже переиспользует запись payments. */
    public PayResponse startPrepayment(long voucherId) {
        Prepared prepared = tx.execute(st -> {
            Voucher v = vouchers.lockById(voucherId).orElseThrow(() -> ApiException.notFound("Путёвка не найдена"));
            if (v.getStatus() != VoucherStatus.AWAITING_PAYMENT) {
                throw ApiException.conflict("Путёвка в статусе " + v.getStatus() + " не требует оплаты");
            }
            if (v.getPaymentDeadline() != null && v.getPaymentDeadline().isBefore(OffsetDateTime.now())) {
                throw ApiException.conflict("Срок оплаты путёвки истёк");
            }
            Payment payment = payments
                    .findFirstByVoucherIdAndKindAndStatusOrderByIdDesc(voucherId, PaymentKind.PREPAY, PaymentStatus.PENDING)
                    .orElseGet(() -> payments.save(new Payment(voucherId, PaymentKind.PREPAY,
                            Money.percentOf(v.getTotalPrice(), props.booking().prepayPercent()))));
            return new Prepared(payment.getId(), payment.getAmount(), v.getCurrency());
        });

        // Вызов платёжного сервиса — вне транзакции. Если он упал, запись PENDING без invoice_id остаётся,
        // повторный вызов этого метода выставит счёт заново.
        var invoice = gateway.createInvoice(voucherId, prepared.amount(), prepared.currency(),
                props.payment().publicBaseUrl() + "/api/payments/callback");
        tx.executeWithoutResult(st -> payments.findById(prepared.paymentId()).orElseThrow()
                .setInvoiceId(invoice.invoiceId()));
        return new PayResponse(prepared.paymentId(), invoice.invoiceId(), prepared.amount(), prepared.currency(), invoice.payUrl());
    }

    /** Обработка вебхука. Идемпотентна: повторное уведомление по уже обработанному платежу игнорируется. */
    @Transactional
    public void handleCallback(CallbackRequest req, String signature) {
        if (!CallbackSignatureVerifier.verify(props.payment().webhookSecret(), signature, req.externalId(), req.invoiceId(),
                req.status(), req.amount())) {
            throw new ApiException(HttpStatus.UNAUTHORIZED, "Неверная подпись уведомления");
        }
        if (!"SUCCESS".equals(req.status()) && !"DECLINED".equals(req.status())) {
            throw ApiException.badRequest("Неизвестный статус платежа: " + req.status());
        }
        long voucherId = req.externalId();
        // Блокировка путёвки первой — тот же порядок блокировок, что у отмены и истечения срока.
        Voucher voucher = vouchers.lockById(voucherId).orElseThrow(() -> ApiException.notFound("Путёвка не найдена"));
        Payment payment = payments.findByVoucherIdAndInvoiceId(voucherId, req.invoiceId())
                .orElseThrow(() -> ApiException.notFound("Платёж не найден"));

        if (payment.getStatus() != PaymentStatus.PENDING) {
            log.info("Повторное уведомление по платежу {} (статус {}), игнорируем", payment.getId(), payment.getStatus());
            return;
        }
        if (payment.getAmount().compareTo(req.amount()) != 0) {
            throw ApiException.conflict("Сумма уведомления не совпадает с суммой платежа");
        }

        if ("DECLINED".equals(req.status())) {
            payment.setStatus(PaymentStatus.DECLINED);
            return;
        }

        payment.setStatus(PaymentStatus.SUCCESS);
        if (voucher.getStatus() == VoucherStatus.AWAITING_PAYMENT) {
            voucher.setStatus(VoucherStatus.CONFIRMED);
            bookings.updateStatusByVoucher(voucherId, BookingStatus.CONFIRMED);
            bookings.findIdsByVoucherId(voucherId).forEach(id ->
                    events.publishEvent(new BookingStatusChanged(id, BookingStatusChanged.Type.CONFIRMED)));
        } else {
            // Деньги поступили за уже отменённую/просроченную путёвку — ставим возврат в очередь.
            log.warn("Оплата по путёвке {} в статусе {}: создан возврат", voucherId, voucher.getStatus());
            payments.save(new Payment(voucherId, PaymentKind.REFUND, payment.getAmount()));
        }
    }
}
