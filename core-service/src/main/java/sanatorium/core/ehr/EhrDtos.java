package sanatorium.core.ehr;

import java.math.BigDecimal;
import java.time.OffsetDateTime;

public final class EhrDtos {

    private EhrDtos() {
    }

    public record EhrRecordView(
            long clientId,
            String sanatoriumCardNumber,
            String bloodType,
            String allergies,
            String chronicDiseases,
            Integer heightCm,
            BigDecimal weightKg,
            Double bmi,
            Integer bloodPressureSystolic,
            Integer bloodPressureDiastolic,
            Integer pulse,
            OffsetDateTime updatedAt
    ) {
    }

    public record UpdateEhrRequest(
            String sanatoriumCardNumber,
            String bloodType,
            String allergies,
            String chronicDiseases,
            Integer heightCm,
            BigDecimal weightKg,
            Integer bloodPressureSystolic,
            Integer bloodPressureDiastolic,
            Integer pulse
    ) {
    }

    public record DoctorNoteView(
            long id,
            long clientId,
            long doctorId,
            String doctorName,
            String visitType,
            String complaints,
            String objectiveStatus,
            String recommendations,
            OffsetDateTime createdAt
    ) {
    }

    public record CreateDoctorNoteRequest(
            Long clientId,
            Long doctorId,
            String doctorName,
            String visitType,
            String complaints,
            String objectiveStatus,
            String recommendations
    ) {
    }
}
