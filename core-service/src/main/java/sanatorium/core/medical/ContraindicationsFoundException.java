package sanatorium.core.medical;

import java.util.List;
import sanatorium.core.common.Dtos.ContraindicationWarning;

/**
 * Найдены противопоказания (НФТ-09): система не принимает клинических решений, а предупреждает врача.
 * Клиент API получает 409 со списком предупреждений и может повторить запрос с confirmContraindications=true.
 */
public class ContraindicationsFoundException extends RuntimeException {
    private final transient List<ContraindicationWarning> warnings;

    public ContraindicationsFoundException(List<ContraindicationWarning> warnings) {
        super("Обнаружены противопоказания к назначаемым процедурам");
        this.warnings = warnings;
    }

    public List<ContraindicationWarning> warnings() {
        return warnings;
    }
}
