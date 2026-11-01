package sanatorium.core.medical;

import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface AssignmentProcedureRepository extends JpaRepository<AssignmentProcedure, AssignmentProcedureId> {

    @Query("""
            select new sanatorium.core.medical.AssignmentItemRow(ap.id.procedureId, p.name, ap.sessionsPlanned)
              from AssignmentProcedure ap join MedicalProcedure p on p.id = ap.id.procedureId
             where ap.id.assignmentId = :assignmentId
             order by ap.id.procedureId
            """)
    List<AssignmentItemRow> findItems(@Param("assignmentId") Long assignmentId);
}
