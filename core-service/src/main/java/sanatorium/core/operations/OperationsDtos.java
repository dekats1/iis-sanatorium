package sanatorium.core.operations;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import java.math.BigDecimal;
import java.time.OffsetDateTime;

public final class OperationsDtos {

    private OperationsDtos() {
    }

    public record ConsumableItemView(
            long id,
            String sku,
            String name,
            String category,
            Integer cabinetId,
            String cabinetName,
            String unit,
            BigDecimal stockQuantity,
            BigDecimal minThreshold,
            OffsetDateTime lastRestockedAt
    ) {
    }

    public record CreateConsumableRequest(
            @NotBlank String sku,
            @NotBlank String name,
            @NotBlank String category,
            Integer cabinetId,
            String cabinetName,
            @NotBlank String unit,
            @NotNull BigDecimal stockQuantity,
            @NotNull BigDecimal minThreshold
    ) {
    }

    public record AmountRequest(
            @NotNull BigDecimal amount
    ) {
    }

    public record StaffMemberView(
            long id,
            String fullName,
            String role,
            String cabinetName,
            String shiftHours,
            String status,
            int assignedSlotsToday,
            int maxSlotsPerDay,
            BigDecimal rating
    ) {
    }

    public record CreateStaffRequest(
            @NotBlank String fullName,
            @NotBlank String role,
            String cabinetName,
            @NotBlank String shiftHours,
            String status,
            int assignedSlotsToday,
            int maxSlotsPerDay,
            BigDecimal rating
    ) {
    }

    public record StatusUpdateRequest(
            @NotBlank String status
    ) {
    }

    public record PackageView(
            long id,
            String name,
            String description,
            Integer categoryId,
            String categoryName,
            Integer profileId,
            String profileName,
            int durationNights,
            BigDecimal basePrice,
            BigDecimal packagePrice,
            String badge,
            boolean active
    ) {
    }

    public record CreatePackageRequest(
            @NotBlank String name,
            @NotBlank String description,
            @NotNull Integer categoryId,
            @NotNull Integer profileId,
            int durationNights,
            @NotNull BigDecimal basePrice,
            @NotNull BigDecimal packagePrice,
            String badge
    ) {
    }
}
