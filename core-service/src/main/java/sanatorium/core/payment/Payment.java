package sanatorium.core.payment;

import jakarta.persistence.Column;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.math.BigDecimal;
import java.time.OffsetDateTime;

/** Платёж по путёвке: предоплата (PREPAY) или возврат (REFUND). invoiceId выдаёт платёжный сервис. */
@Entity
@Table(name = "payments")
public class Payment {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "voucher_id", nullable = false)
    private Long voucherId;

    @Enumerated(EnumType.STRING)
    @Column(name = "kind", nullable = false)
    private PaymentKind kind;

    @Column(name = "amount", nullable = false)
    private BigDecimal amount;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false)
    private PaymentStatus status = PaymentStatus.PENDING;

    @Column(name = "invoice_id")
    private Long invoiceId;

    @Column(name = "created_at", nullable = false)
    private OffsetDateTime createdAt = OffsetDateTime.now();

    protected Payment() { }

    public Payment(Long voucherId, PaymentKind kind, BigDecimal amount) {
        this.voucherId = voucherId;
        this.kind = kind;
        this.amount = amount;
    }

    public Long getId() { return id; }
    public Long getVoucherId() { return voucherId; }
    public PaymentKind getKind() { return kind; }
    public BigDecimal getAmount() { return amount; }
    public PaymentStatus getStatus() { return status; }
    public void setStatus(PaymentStatus status) { this.status = status; }
    public Long getInvoiceId() { return invoiceId; }
    public void setInvoiceId(Long invoiceId) { this.invoiceId = invoiceId; }
    public OffsetDateTime getCreatedAt() { return createdAt; }
}
