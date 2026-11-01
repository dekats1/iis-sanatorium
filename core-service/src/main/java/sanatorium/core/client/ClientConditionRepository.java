package sanatorium.core.client;

import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface ClientConditionRepository extends JpaRepository<ClientCondition, ClientConditionId> {

    @Query("""
            select new sanatorium.core.client.ConditionRow(mc.id, mc.code, mc.name, cc.diagnosedAt)
              from ClientCondition cc join MedicalCondition mc on mc.id = cc.id.conditionId
             where cc.id.clientId = :clientId
             order by mc.name
            """)
    List<ConditionRow> findRows(@Param("clientId") Long clientId);
}
