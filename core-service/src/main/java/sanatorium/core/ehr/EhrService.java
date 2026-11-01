package sanatorium.core.ehr;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.stream.Collectors;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import sanatorium.core.ehr.EhrDtos.CreateDoctorNoteRequest;
import sanatorium.core.ehr.EhrDtos.DoctorNoteView;
import sanatorium.core.ehr.EhrDtos.EhrRecordView;
import sanatorium.core.ehr.EhrDtos.UpdateEhrRequest;

@Service
public class EhrService {

    private final EhrRecordRepository ehrRepository;
    private final DoctorNoteRepository noteRepository;

    public EhrService(EhrRecordRepository ehrRepository, DoctorNoteRepository noteRepository) {
        this.ehrRepository = ehrRepository;
        this.noteRepository = noteRepository;
    }

    @Transactional
    public EhrRecord getOrCreate(long clientId) {
        return ehrRepository.findByClientId(clientId).orElseGet(() -> {
            EhrRecord rec = new EhrRecord(clientId);
            return ehrRepository.save(rec);
        });
    }

    @Transactional(readOnly = true)
    public EhrRecordView getView(long clientId) {
        EhrRecord rec = ehrRepository.findByClientId(clientId).orElse(null);
        if (rec == null) {
            rec = new EhrRecord(clientId);
        }
        return toView(rec);
    }

    @Transactional
    public EhrRecordView update(long clientId, UpdateEhrRequest req) {
        EhrRecord rec = getOrCreate(clientId);

        if (req.sanatoriumCardNumber() != null) rec.setSanatoriumCardNumber(req.sanatoriumCardNumber());
        if (req.bloodType() != null) rec.setBloodType(req.bloodType());
        if (req.allergies() != null) rec.setAllergies(req.allergies());
        if (req.chronicDiseases() != null) rec.setChronicDiseases(req.chronicDiseases());
        if (req.heightCm() != null) rec.setHeightCm(req.heightCm());
        if (req.weightKg() != null) rec.setWeightKg(req.weightKg());
        if (req.bloodPressureSystolic() != null) rec.setBloodPressureSystolic(req.bloodPressureSystolic());
        if (req.bloodPressureDiastolic() != null) rec.setBloodPressureDiastolic(req.bloodPressureDiastolic());
        if (req.pulse() != null) rec.setPulse(req.pulse());
        rec.setUpdatedAt(OffsetDateTime.now());

        return toView(ehrRepository.save(rec));
    }

    @Transactional(readOnly = true)
    public List<DoctorNoteView> getNotes(long clientId) {
        return noteRepository.findByClientIdOrderByCreatedAtDesc(clientId).stream()
                .map(this::toNoteView)
                .collect(Collectors.toList());
    }

    @Transactional
    public DoctorNoteView addNote(CreateDoctorNoteRequest req, Long doctorId) {
        Long docId = doctorId != null ? doctorId : (req.doctorId() != null ? req.doctorId() : 2L);
        String docName = req.doctorName() != null && !req.doctorName().isBlank() ? req.doctorName() : "Врач санатория";

        DoctorVisitType vt = DoctorVisitType.CONTROL;
        if (req.visitType() != null) {
            try {
                vt = DoctorVisitType.valueOf(req.visitType());
            } catch (Exception ignored) {
            }
        }

        DoctorNote note = new DoctorNote(
                req.clientId() != null ? req.clientId() : 1L,
                docId,
                docName,
                vt,
                req.complaints(),
                req.objectiveStatus(),
                req.recommendations()
        );

        return toNoteView(noteRepository.save(note));
    }

    private EhrRecordView toView(EhrRecord r) {
        Double bmi = null;
        if (r.getHeightCm() != null && r.getHeightCm() > 0 && r.getWeightKg() != null) {
            double hM = r.getHeightCm() / 100.0;
            double rawBmi = r.getWeightKg().doubleValue() / (hM * hM);
            bmi = BigDecimal.valueOf(rawBmi).setScale(1, RoundingMode.HALF_UP).doubleValue();
        }

        return new EhrRecordView(
                r.getClientId(),
                r.getSanatoriumCardNumber(),
                r.getBloodType(),
                r.getAllergies(),
                r.getChronicDiseases(),
                r.getHeightCm(),
                r.getWeightKg(),
                bmi,
                r.getBloodPressureSystolic(),
                r.getBloodPressureDiastolic(),
                r.getPulse(),
                r.getUpdatedAt()
        );
    }

    private DoctorNoteView toNoteView(DoctorNote n) {
        return new DoctorNoteView(
                n.getId(),
                n.getClientId(),
                n.getDoctorId(),
                n.getDoctorName(),
                n.getVisitType().name(),
                n.getComplaints(),
                n.getObjectiveStatus(),
                n.getRecommendations(),
                n.getCreatedAt()
        );
    }
}
