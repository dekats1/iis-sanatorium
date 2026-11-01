package sanatorium.core.notification;

import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface NotificationRepository extends JpaRepository<AppNotification, Long> {

    List<AppNotification> findByUserIdOrderByCreatedAtDesc(Long userId);

    List<AppNotification> findByUserIdOrUserIdIsNullOrderByCreatedAtDesc(Long userId);
}
