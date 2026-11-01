package sanatorium.core.medical;

/** Противопоказание: процедура и состояние здоровья клиента, с которым она несовместима (запрос Q2 главы 2). */
public record ContraindicationRow(Integer procedureId, String procedureName, Integer conditionId, String conditionName) { }
