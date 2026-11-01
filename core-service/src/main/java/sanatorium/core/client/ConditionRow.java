package sanatorium.core.client;

import java.time.LocalDate;

/** Строка выборки состояний клиента (конструкторное выражение JPQL). */
public record ConditionRow(Integer conditionId, String code, String name, LocalDate diagnosedAt) { }
