package sanatorium.core.medical;

import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface TreatmentAssignmentRepository extends JpaRepository<TreatmentAssignment, Long> {

    List<TreatmentAssignment> findByVoucherIdOrderById(Long voucherId);
}
