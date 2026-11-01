package sanatorium.core.audit;

import java.util.List;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

public interface AuditLogRepository extends JpaRepository<AuditLog, Long> {

    @Query("""
            select new sanatorium.core.audit.AuditRow(a.id, a.createdAt, a.userId, u.username, a.action, a.entity, a.details)
              from AuditLog a left join UserAccount u on u.id = a.userId
             order by a.createdAt desc, a.id desc
            """)
    List<AuditRow> findLatest(Pageable pageable);
}
