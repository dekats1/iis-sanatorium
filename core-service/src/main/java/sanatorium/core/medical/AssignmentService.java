package sanatorium.core.medical;

import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import sanatorium.core.booking.Voucher;
import sanatorium.core.booking.VoucherRepository;
import sanatorium.core.booking.VoucherStatus;
import sanatorium.core.common.ApiException;
import sanatorium.core.common.Dtos.AssignmentItem;
import sanatorium.core.common.Dtos.AssignmentItemView;
import sanatorium.core.common.Dtos.AssignmentRequest;
import sanatorium.core.common.Dtos.AssignmentView;
import sanatorium.core.common.Dtos.ContraindicationWarning;

/**
 * Назначение лечения врачом (ФТ-12, сценарий СЦ-3). Предусловия: путёвка оплачена и заезд зарегистрирован (CHECKED_IN);
 * процедуры должны относиться к лечебному профилю путёвки. Противопоказания не блокируют назначение окончательно:
 * при конфликте возвращается предупреждение, а решение за врачом (confirmContraindications=true) — НФТ-09.
 */
@Service
public class AssignmentService {

    private static final Logger log = LoggerFactory.getLogger(AssignmentService.class);

    private final VoucherRepository vouchers;
    private final TreatmentAssignmentRepository assignments;
    private final AssignmentProcedureRepository items;
    private final MedicalQueryRepository queries;

    public AssignmentService(VoucherRepository vouchers, TreatmentAssignmentRepository assignments,
                             AssignmentProcedureRepository items, MedicalQueryRepository queries) {
        this.vouchers = vouchers;
        this.assignments = assignments;
        this.items = items;
        this.queries = queries;
    }

    @Transactional
    public AssignmentView create(AssignmentRequest req, long doctorId) {
        Voucher voucher = vouchers.findById(req.voucherId()).orElseThrow(() -> ApiException.notFound("Путёвка не найдена"));
        if (voucher.getStatus() != VoucherStatus.CHECKED_IN) {
            throw ApiException.conflict("Назначение возможно только после заезда (статус CHECKED_IN), сейчас " + voucher.getStatus());
        }

        Set<Integer> seen = new HashSet<>();
        for (AssignmentItem item : req.items()) {
            if (!seen.add(item.procedureId())) {
                throw ApiException.badRequest("Процедура " + item.procedureId() + " указана в назначении дважды");
            }
        }
        List<ProcedureInfo> found = queries.findInfos(seen);
        if (found.size() != seen.size()) {
            throw ApiException.badRequest("Некоторые процедуры не найдены в справочнике");
        }
        Set<Integer> allowed = Set.copyOf(queries.findAllowedForProfile(voucher.getProfileId(), seen));
        Set<Integer> notAllowed = seen.stream().filter(id -> !allowed.contains(id)).collect(Collectors.toCollection(HashSet::new));
        if (!notAllowed.isEmpty()) {
            String names = found.stream().filter(p -> notAllowed.contains(p.id())).map(ProcedureInfo::name).collect(Collectors.joining(", "));
            throw ApiException.conflict("Процедуры не входят в лечебный профиль путёвки: " + names);
        }

        List<ContraindicationWarning> warnings = queries.findContraindications(voucher.getClientId(), seen).stream()
                .map(r -> new ContraindicationWarning(r.procedureId(), r.procedureName(), r.conditionId(), r.conditionName()))
                .toList();
        if (!warnings.isEmpty() && !req.confirmContraindications()) {
            throw new ContraindicationsFoundException(warnings);
        }
        if (!warnings.isEmpty()) {
            // врач осознанно подтвердил назначение вопреки противопоказаниям — фиксируем в журнале приложения
            log.warn("Врач {} подтвердил назначение вопреки противопоказаниям: путёвка {}, {}", doctorId, req.voucherId(), warnings);
        }

        TreatmentAssignment assignment = assignments.save(new TreatmentAssignment(req.voucherId(), doctorId));
        for (AssignmentItem item : req.items()) {
            items.save(new AssignmentProcedure(assignment.getId(), item.procedureId(), item.sessions()));
        }
        items.flush();
        return view(assignment);
    }

    @Transactional(readOnly = true)
    public List<AssignmentView> byVoucher(long voucherId) {
        return assignments.findByVoucherIdOrderById(voucherId).stream().map(this::view).toList();
    }

    @Transactional(readOnly = true)
    public AssignmentView get(long id) {
        return view(assignments.findById(id).orElseThrow(() -> ApiException.notFound("Назначение не найдено")));
    }

    private AssignmentView view(TreatmentAssignment a) {
        List<AssignmentItemView> rows = items.findItems(a.getId()).stream()
                .map(r -> new AssignmentItemView(r.procedureId(), r.procedureName(), r.sessionsPlanned())).toList();
        return new AssignmentView(a.getId(), a.getVoucherId(), a.getDoctorId(), a.getCreatedAt(), rows);
    }
}
