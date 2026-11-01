package sanatorium.core.directory;

import jakarta.persistence.LockModeType;
import java.util.Collection;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface CabinetRepository extends JpaRepository<Cabinet, Integer> {

    /**
     * Блокировка кабинетов (SELECT … FOR UPDATE) в порядке id: два одновременных планирования не займут один слот,
     * а единый порядок блокировок исключает взаимные блокировки.
     */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select c from Cabinet c where c.id in :ids order by c.id")
    List<Cabinet> lockAllByIdIn(@Param("ids") Collection<Integer> ids);
}
