package sanatorium.core.directory;

import java.util.Collection;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface MedicalProcedureRepository extends JpaRepository<MedicalProcedure, Integer> {

    List<MedicalProcedure> findAllByIdInOrderById(Collection<Integer> ids);
}
