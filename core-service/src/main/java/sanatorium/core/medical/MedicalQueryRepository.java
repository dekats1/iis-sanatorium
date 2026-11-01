package sanatorium.core.medical;

import java.util.Collection;
import java.util.List;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.Repository;
import org.springframework.data.repository.query.Param;
import sanatorium.core.directory.MedicalProcedure;

/** Запросы лечебного блока по справочнику процедур и состояниям здоровья клиентов (только чтение). */
public interface MedicalQueryRepository extends Repository<MedicalProcedure, Integer> {

    @Query("""
            select new sanatorium.core.medical.ProcedureInfo(p.id, p.name, p.cabinetId, c.slotsPerDay)
              from MedicalProcedure p join Cabinet c on c.id = p.cabinetId
             where p.id in :ids
             order by p.id
            """)
    List<ProcedureInfo> findInfos(@Param("ids") Collection<Integer> ids);

    /** Из переданных процедур — те, что разрешены для лечебного профиля путёвки. */
    @Query("select p.id from MedicalProcedure p join p.profileIds pid where pid = :profileId and p.id in :ids")
    List<Integer> findAllowedForProfile(@Param("profileId") Integer profileId, @Param("ids") Collection<Integer> ids);

    /** Запрос Q2 главы 2: процедуры, противопоказанные клиенту по его состояниям здоровья. */
    @Query("""
            select new sanatorium.core.medical.ContraindicationRow(p.id, p.name, mc.id, mc.name)
              from MedicalProcedure p
              join p.contraindicationIds cid
              join ClientCondition cc on cc.id.conditionId = cid
              join MedicalCondition mc on mc.id = cid
             where cc.id.clientId = :clientId and p.id in :ids
             order by p.id, mc.id
            """)
    List<ContraindicationRow> findContraindications(@Param("clientId") Long clientId, @Param("ids") Collection<Integer> ids);
}
