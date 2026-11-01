package sanatorium.core.review;

import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

@Repository
public interface ProcedureFeedbackRepository extends JpaRepository<ProcedureFeedback, Long> {

    interface ProcedureAvgRating {
        String getProcedureName();
        Double getAvgRating();
        Long getReviewCount();
    }

    @Query("SELECT p.procedureName as procedureName, AVG(p.rating) as avgRating, COUNT(p.id) as reviewCount " +
           "FROM ProcedureFeedback p " +
           "GROUP BY p.procedureName " +
           "ORDER BY AVG(p.rating) DESC, COUNT(p.id) DESC")
    List<ProcedureAvgRating> findTopProcedures();
}
