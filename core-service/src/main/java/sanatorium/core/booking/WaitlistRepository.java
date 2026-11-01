package sanatorium.core.booking;

import java.time.LocalDate;
import java.util.List;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.transaction.annotation.Transactional;

public interface WaitlistRepository extends JpaRepository<WaitlistItem, Long> {

    List<WaitlistItem> findByClientIdOrderByIdDesc(Long clientId);

    List<WaitlistItem> findByStatusOrderByIdDesc(WaitlistStatus status, Pageable pageable);

    @Query("select w from WaitlistItem w order by w.id desc")
    List<WaitlistItem> findLatest(Pageable pageable);

    /** Открытые записи категории, срок которых ещё не истёк, в порядке постановки. */
    List<WaitlistItem> findByStatusAndCategoryIdAndDateToAfterOrderById(WaitlistStatus status, Integer categoryId, LocalDate today);

    /** Условный перевод OPEN → NOTIFIED одним UPDATE: повторный вызов не затронет уже уведомлённую запись. */
    @Modifying
    @Transactional
    @Query("update WaitlistItem w set w.status = :to where w.id = :id and w.status = :from")
    int changeStatus(@Param("id") Long id, @Param("from") WaitlistStatus from, @Param("to") WaitlistStatus to);
}
