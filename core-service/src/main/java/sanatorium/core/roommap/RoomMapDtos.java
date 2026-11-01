package sanatorium.core.roommap;

import jakarta.validation.constraints.NotBlank;
import java.math.BigDecimal;
import java.util.List;

public final class RoomMapDtos {

    private RoomMapDtos() {
    }

    public record InteractiveRoomView(
            int id,
            String roomNumber,
            int categoryId,
            String categoryName,
            int floor,
            String building,
            int capacity,
            String status,
            BigDecimal pricePerDay,
            String windowView,
            List<String> amenities,
            String currentGuestName,
            String voucherCode,
            String checkInDate,
            String checkOutDate,
            String notes
    ) {
    }

    public record RoomMapStats(
            int total,
            int vacant,
            int occupied,
            int cleaning,
            int reserved,
            double occupancyPercent
    ) {
    }

    public record UpdateRoomStatusRequest(
            @NotBlank String status,
            String notes,
            String guestName,
            String voucherCode,
            String checkInDate,
            String checkOutDate
    ) {
    }
}
