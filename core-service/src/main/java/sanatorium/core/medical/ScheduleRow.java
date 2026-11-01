package sanatorium.core.medical;

import java.time.OffsetDateTime;

/** Сеанс расписания с названиями процедуры, кабинета и клиента — результат JPQL-выборки. */
public record ScheduleRow(Long id, Long assignmentId, Integer procedureId, String procedureName, String cabinetName,
                          OffsetDateTime slotDt, boolean done, Long voucherId, String clientName) { }
