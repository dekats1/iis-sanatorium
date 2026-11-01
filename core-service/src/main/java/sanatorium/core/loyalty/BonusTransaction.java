package sanatorium.core.loyalty;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.OffsetDateTime;

@Entity
@Table(name = "bonus_transactions")
public class BonusTransaction {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "client_id", nullable = false)
    private Long clientId;

    @Column(name = "amount", nullable = false)
    private int amount;

    @Enumerated(EnumType.STRING)
    @Column(name = "type", nullable = false, length = 32)
    private BonusTransactionType type;

    @Column(name = "description", nullable = false)
    private String description;

    @Column(name = "voucher_id")
    private Long voucherId;

    @Column(name = "created_at", nullable = false)
    private OffsetDateTime createdAt = OffsetDateTime.now();

    public BonusTransaction() {
    }

    public BonusTransaction(Long clientId, int amount, BonusTransactionType type, String description, Long voucherId) {
        this.clientId = clientId;
        this.amount = amount;
        this.type = type;
        this.description = description;
        this.voucherId = voucherId;
    }

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public Long getClientId() {
        return clientId;
    }

    public void setClientId(Long clientId) {
        this.clientId = clientId;
    }

    public int getAmount() {
        return amount;
    }

    public void setAmount(int amount) {
        this.amount = amount;
    }

    public BonusTransactionType getType() {
        return type;
    }

    public void setType(BonusTransactionType type) {
        this.type = type;
    }

    public String getDescription() {
        return description;
    }

    public void setDescription(String description) {
        this.description = description;
    }

    public Long getVoucherId() {
        return voucherId;
    }

    public void setVoucherId(Long voucherId) {
        this.voucherId = voucherId;
    }

    public OffsetDateTime getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(OffsetDateTime createdAt) {
        this.createdAt = createdAt;
    }
}
