package sanatorium.core.medical;

/** Процедура с параметрами кабинета (ёмкость в слотах/день) — для планировщика. */
public record ProcedureInfo(Integer id, String name, Integer cabinetId, Integer slotsPerDay) { }
