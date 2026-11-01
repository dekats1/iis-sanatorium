package sanatorium.core.loyalty;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.List;

public final class LoyaltyDtos {

    private LoyaltyDtos() {
    }

    public record BonusTransactionView(
            long id,
            long clientId,
            int amount,
            String type,
            String description,
            Long voucherId,
            OffsetDateTime createdAt
    ) {
    }

    public record LoyaltyAccountView(
            long clientId,
            int balance,
            BigDecimal spentMoney,
            String tier,
            int cashbackPercent,
            BigDecimal nextTierThreshold,
            List<String> privileges,
            int totalEarned,
            int totalSpent
    ) {
    }

    public record AddBonusRequest(
            @NotNull Long clientId,
            int amount,
            @NotBlank String description
    ) {
    }

    public record ApplyBonusesRequest(
            @NotNull Long clientId,
            @NotNull Long voucherId,
            @Min(1) int bonusPoints
    ) {
    }

    public record ApplyBonusesResult(
            boolean success,
            int applied
    ) {
    }
}
