package sanatorium.core.notification;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import sanatorium.core.identity.Access;
import sanatorium.core.notification.NotificationDtos.CreateNotificationRequest;
import sanatorium.core.notification.NotificationDtos.NotificationView;

@RestController
@RequestMapping("/api/notifications")
@Tag(name = "notifications", description = "Центр уведомлений пользователя")
public class NotificationController {

    private final NotificationService notificationService;

    public NotificationController(NotificationService notificationService) {
        this.notificationService = notificationService;
    }

    private Long getUserId(Jwt jwt) {
        return jwt != null ? Access.userId(jwt) : null;
    }

    @GetMapping
    @Operation(summary = "Список уведомлений текущего пользователя")
    public List<NotificationView> list(@AuthenticationPrincipal Jwt jwt) {
        return notificationService.listUserNotifications(getUserId(jwt));
    }

    @PutMapping("/{id}/read")
    @Operation(summary = "Отметить уведомление как прочитанное")
    public NotificationView markAsRead(@PathVariable long id, @AuthenticationPrincipal Jwt jwt) {
        return notificationService.markAsRead(id, getUserId(jwt));
    }

    @PutMapping("/read-all")
    @Operation(summary = "Отметить все уведомления как прочитанные")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void markAllAsRead(@AuthenticationPrincipal Jwt jwt) {
        notificationService.markAllAsRead(getUserId(jwt));
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    @Operation(summary = "Создать новое уведомление")
    public NotificationView create(@Valid @RequestBody CreateNotificationRequest req, @AuthenticationPrincipal Jwt jwt) {
        return notificationService.createNotification(req, getUserId(jwt));
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @Operation(summary = "Удалить уведомление")
    public void delete(@PathVariable long id) {
        notificationService.deleteNotification(id);
    }
}
