package sanatorium.core.ehr;

import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface EhrRecordRepository extends JpaRepository<EhrRecord, Long> {
    Optional<EhrRecord> findByClientId(Long clientId);
}
