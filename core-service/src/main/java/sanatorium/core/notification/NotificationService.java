package sanatorium.core.notification;

import java.util.List;
import java.util.stream.Collectors;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import sanatorium.core.common.ApiException;
import sanatorium.core.notification.NotificationDtos.CreateNotificationRequest;
import sanatorium.core.notification.NotificationDtos.NotificationView;

@Service
public class NotificationService {

    private final NotificationRepository notificationRepository;

    public NotificationService(NotificationRepository notificationRepository) {
        this.notificationRepository = notificationRepository;
    }

    @Transactional(readOnly = true)
    public List<NotificationView> listUserNotifications(Long userId) {
        List<AppNotification> list;
        if (userId != null) {
            list = notificationRepository.findByUserIdOrUserIdIsNullOrderByCreatedAtDesc(userId);
        } else {
            list = notificationRepository.findAll();
        }
        return list.stream().map(this::toView).collect(Collectors.toList());
    }

    @Transactional
    public NotificationView markAsRead(long id, Long userId) {
        AppNotification n = notificationRepository.findById(id)
                .orElseThrow(() -> ApiException.notFound("Уведомление не найдено"));
        n.setRead(true);
        return toView(notificationRepository.save(n));
    }

    @Transactional
    public void markAllAsRead(Long userId) {
        List<AppNotification> list = userId != null
                ? notificationRepository.findByUserIdOrUserIdIsNullOrderByCreatedAtDesc(userId)
                : notificationRepository.findAll();
        for (AppNotification n : list) {
            n.setRead(true);
        }
        notificationRepository.saveAll(list);
    }

    @Transactional
    public NotificationView createNotification(CreateNotificationRequest req, Long fallbackUserId) {
        Long targetUserId = req.userId() != null ? req.userId() : fallbackUserId;
        AppNotification n = new AppNotification(
                targetUserId,
                req.type() != null ? req.type() : "INFO",
                req.title().trim(),
                req.message().trim(),
                req.link()
        );
        return toView(notificationRepository.save(n));
    }

    @Transactional
    public void deleteNotification(long id) {
        if (notificationRepository.existsById(id)) {
            notificationRepository.deleteById(id);
        }
    }

    private NotificationView toView(AppNotification n) {
        return new NotificationView(
                String.valueOf(n.getId()),
                n.getType(),
                n.getTitle(),
                n.getMessage(),
                n.getLink(),
                n.isRead(),
                n.getCreatedAt()
        );
    }
}
