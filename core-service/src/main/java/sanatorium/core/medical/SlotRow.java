package sanatorium.core.medical;

import java.time.OffsetDateTime;

/** Сеанс в расписании с параметрами кабинета — для перевода времени в индекс слота. */
public record SlotRow(Integer cabinetId, Integer slotsPerDay, OffsetDateTime slotDt) { }
