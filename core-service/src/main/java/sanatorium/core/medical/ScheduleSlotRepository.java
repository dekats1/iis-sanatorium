package sanatorium.core.medical;

import java.time.OffsetDateTime;
import java.util.Collection;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.transaction.annotation.Transactional;

public interface ScheduleSlotRepository extends JpaRepository<ScheduleSlot, Long> {

    long countByAssignmentId(Long assignmentId);

    /** Занятые слоты кабинетов за период. */
    @Query("""
            select new sanatorium.core.medical.SlotRow(p.cabinetId, c.slotsPerDay, s.slotDt)
              from ScheduleSlot s
              join MedicalProcedure p on p.id = s.procedureId
              join Cabinet c on c.id = p.cabinetId
             where p.cabinetId in :cabinetIds and s.slotDt >= :from and s.slotDt < :to
            """)
    List<SlotRow> findCabinetSlots(@Param("cabinetIds") Collection<Integer> cabinetIds,
                                   @Param("from") OffsetDateTime from, @Param("to") OffsetDateTime to);

    /** Все сеансы пациента (по путёвке) — занятое время независимо от кабинета. */
    @Query("""
            select new sanatorium.core.medical.SlotRow(p.cabinetId, c.slotsPerDay, s.slotDt)
              from ScheduleSlot s
              join TreatmentAssignment ta on ta.id = s.assignmentId
              join MedicalProcedure p on p.id = s.procedureId
              join Cabinet c on c.id = p.cabinetId
             where ta.voucherId = :voucherId
            """)
    List<SlotRow> findVoucherSlots(@Param("voucherId") Long voucherId);

    String ROW = """
            select new sanatorium.core.medical.ScheduleRow(s.id, s.assignmentId, s.procedureId, p.name, c.name,
                   s.slotDt, s.done, ta.voucherId, concat(cl.lastName, ' ', cl.firstName))
              from ScheduleSlot s
              join TreatmentAssignment ta on ta.id = s.assignmentId
              join MedicalProcedure p on p.id = s.procedureId
              join Cabinet c on c.id = p.cabinetId
              join Voucher v on v.id = ta.voucherId
              join Client cl on cl.id = v.clientId
            """;

    @Query(ROW + " where s.assignmentId = :assignmentId order by s.slotDt, s.id")
    List<ScheduleRow> findRowsByAssignment(@Param("assignmentId") Long assignmentId);

    @Query(ROW + " where s.slotDt >= :from and s.slotDt < :to order by s.slotDt, s.id")
    List<ScheduleRow> findRowsBetween(@Param("from") OffsetDateTime from, @Param("to") OffsetDateTime to);

    /** Отметка выполнения одним условным UPDATE; 0 — сеанса нет или он уже выполнен (ФТ-14). */
    @Modifying
    @Transactional
    @Query("update ScheduleSlot s set s.done = true where s.id = :id and s.done = false")
    int markDone(@Param("id") Long id);
}
