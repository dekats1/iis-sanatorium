package sanatorium.core.loyalty;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.math.BigDecimal;
import java.time.OffsetDateTime;

@Entity
@Table(name = "loyalty_accounts")
public class LoyaltyAccount {

    @Id
    @Column(name = "client_id")
    private Long clientId;

    @Column(name = "balance", nullable = false)
    private int balance = 100;

    @Column(name = "spent_money", nullable = false)
    private BigDecimal spentMoney = BigDecimal.ZERO;

    @Column(name = "created_at", nullable = false)
    private OffsetDateTime createdAt = OffsetDateTime.now();

    public LoyaltyAccount() {
    }

    public LoyaltyAccount(Long clientId, int balance, BigDecimal spentMoney) {
        this.clientId = clientId;
        this.balance = balance;
        this.spentMoney = spentMoney;
    }

    public Long getClientId() {
        return clientId;
    }

    public void setClientId(Long clientId) {
        this.clientId = clientId;
    }

    public int getBalance() {
        return balance;
    }

    public void setBalance(int balance) {
        this.balance = balance;
    }

    public BigDecimal getSpentMoney() {
        return spentMoney;
    }

    public void setSpentMoney(BigDecimal spentMoney) {
        this.spentMoney = spentMoney;
    }

    public OffsetDateTime getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(OffsetDateTime createdAt) {
        this.createdAt = createdAt;
    }
}
