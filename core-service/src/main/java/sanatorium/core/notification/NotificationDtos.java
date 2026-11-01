package sanatorium.core.notification;

import jakarta.validation.constraints.NotBlank;
import java.time.OffsetDateTime;

public final class NotificationDtos {

    private NotificationDtos() {
    }

    public record NotificationView(
            String id,
            String type,
            String title,
            String message,
            String link,
            boolean read,
            OffsetDateTime createdAt
    ) {
    }

    public record CreateNotificationRequest(
            Long userId,
            String type,
            @NotBlank String title,
            @NotBlank String message,
            String link
    ) {
    }
}
