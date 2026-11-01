package sanatorium.core.booking;

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
import java.util.UUID;

/**
 * Путёвка — центральный агрегат продажи. Связи с клиентом, каналом, профилем и диетой хранятся идентификаторами:
 * это границы агрегатов и отсутствие скрытых ленивых загрузок. Целостность ссылок обеспечивают внешние ключи БД.
 */
@Entity
@Table(name = "vouchers")
public class Voucher {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "client_id", nullable = false)
    private Long clientId;

    @Column(name = "customer_id")
    private Long customerId;

    @Column(name = "channel_id", nullable = false)
    private Integer channelId;

    @Column(name = "profile_id", nullable = false)
    private Integer profileId;

    @Column(name = "diet_id")
    private Integer dietId;

    @Column(name = "created_by", nullable = false)
    private Long createdBy;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false)
    private VoucherStatus status = VoucherStatus.AWAITING_PAYMENT;

    @Column(name = "quote_id")
    private UUID quoteId;

    @Column(name = "price_per_place_day", nullable = false)
    private BigDecimal pricePerPlaceDay;

    @Column(name = "total_price", nullable = false)
    private BigDecimal totalPrice;

    @Column(name = "currency", nullable = false)
    private String currency = "BYN";

    @Column(name = "payment_deadline")
    private OffsetDateTime paymentDeadline;

    @Column(name = "created_at", nullable = false)
    private OffsetDateTime createdAt = OffsetDateTime.now();

    protected Voucher() { }

    public Voucher(Long clientId, Long customerId, Integer channelId, Integer profileId, Integer dietId, Long createdBy,
                   UUID quoteId, BigDecimal pricePerPlaceDay, BigDecimal totalPrice, OffsetDateTime paymentDeadline) {
        this.clientId = clientId;
        this.customerId = customerId;
        this.channelId = channelId;
        this.profileId = profileId;
        this.dietId = dietId;
        this.createdBy = createdBy;
        this.quoteId = quoteId;
        this.pricePerPlaceDay = pricePerPlaceDay;
        this.totalPrice = totalPrice;
        this.paymentDeadline = paymentDeadline;
    }

    public Long getId() { return id; }
    public Long getClientId() { return clientId; }
    public Long getCustomerId() { return customerId; }
    public Integer getChannelId() { return channelId; }
    public Integer getProfileId() { return profileId; }
    public Integer getDietId() { return dietId; }
    public Long getCreatedBy() { return createdBy; }
    public VoucherStatus getStatus() { return status; }
    public void setStatus(VoucherStatus status) { this.status = status; }
    public UUID getQuoteId() { return quoteId; }
    public BigDecimal getPricePerPlaceDay() { return pricePerPlaceDay; }
    public BigDecimal getTotalPrice() { return totalPrice; }
    public String getCurrency() { return currency; }
    public OffsetDateTime getPaymentDeadline() { return paymentDeadline; }
    public OffsetDateTime getCreatedAt() { return createdAt; }
}
