package sanatorium.core.medical;

import java.time.LocalDate;
import java.time.LocalTime;
import java.time.OffsetDateTime;
import java.time.ZoneId;
import java.time.ZonedDateTime;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.TreeSet;
import java.util.stream.Collectors;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import sanatorium.core.booking.BookingRepository;
import sanatorium.core.booking.Voucher;
import sanatorium.core.booking.VoucherRepository;
import sanatorium.core.booking.VoucherStatus;
import sanatorium.core.common.ApiException;
import sanatorium.core.common.CoreProperties;
import sanatorium.core.common.Dtos.AssignmentItemView;
import sanatorium.core.common.Dtos.AssignmentView;
import sanatorium.core.common.Dtos.ScheduleEntry;
import sanatorium.core.directory.CabinetRepository;
import sanatorium.core.medical.SlotPlanner.Interval;
import sanatorium.core.medical.SlotPlanner.Request;

/**
 * Формирование расписания процедур (ФТ-13). Собирает данные о занятости из БД, вызывает чистый алгоритм SlotPlanner
 * и сохраняет сеансы одной транзакцией. Перед чтением занятости блокируются строки кабинетов (FOR UPDATE, порядок по id),
 * поэтому два одновременных планирования не займут один слот: ограничения UNIQUE на слот кабинета в схеме нет —
 * целостность обеспечивается этой блокировкой (ограничение прототипа).
 */
@Service
public class ScheduleService {

    private final AssignmentService assignments;
    private final VoucherRepository vouchers;
    private final BookingRepository bookings;
    private final MedicalQueryRepository queries;
    private final CabinetRepository cabinets;
    private final ScheduleSlotRepository slots;
    private final CoreProperties props;

    public ScheduleService(AssignmentService assignments, VoucherRepository vouchers, BookingRepository bookings,
                           MedicalQueryRepository queries, CabinetRepository cabinets, ScheduleSlotRepository slots,
                           CoreProperties props) {
        this.assignments = assignments;
        this.vouchers = vouchers;
        this.bookings = bookings;
        this.queries = queries;
        this.cabinets = cabinets;
        this.slots = slots;
        this.props = props;
    }

    @Transactional
    public List<ScheduleEntry> plan(long assignmentId) {
        AssignmentView assignment = assignments.get(assignmentId);
        Voucher voucher = vouchers.findById(assignment.voucherId()).orElseThrow();
        if (voucher.getStatus() != VoucherStatus.CHECKED_IN) {
            throw ApiException.conflict("Расписание формируется для проживающего (статус CHECKED_IN), сейчас " + voucher.getStatus());
        }
        if (slots.countByAssignmentId(assignmentId) > 0) {
            throw ApiException.conflict("Расписание по этому назначению уже сформировано");
        }

        ZoneId zone = ZoneId.of(props.schedule().zone());
        int dayStart = LocalTime.parse(props.schedule().dayStart()).toSecondOfDay() / 60;
        int dayMinutes = props.schedule().dayMinutes();

        LocalDate checkIn = bookings.findCheckInDate(assignment.voucherId()).orElseThrow();
        LocalDate checkOut = bookings.findCheckOutDate(assignment.voucherId()).orElseThrow();
        LocalDate first = LocalDate.now(zone).isAfter(checkIn) ? LocalDate.now(zone) : checkIn;
        if (!first.isBefore(checkOut)) {
            throw ApiException.conflict("Срок проживания по путёвке истёк, расписание сформировать нельзя");
        }
        List<LocalDate> days = first.datesUntil(checkOut).toList();

        List<Integer> procedureIds = assignment.items().stream().map(AssignmentItemView::procedureId).toList();
        Map<Integer, ProcedureInfo> info = queries.findInfos(procedureIds).stream()
                .collect(Collectors.toMap(ProcedureInfo::id, p -> p));
        List<Request> requests = assignment.items().stream().map(it -> {
            ProcedureInfo p = info.get(it.procedureId());
            return new Request(p.id(), p.cabinetId(), p.slotsPerDay(), it.sessionsPlanned());
        }).toList();

        Set<Integer> cabinetIds = new TreeSet<>();
        requests.forEach(r -> cabinetIds.add(r.cabinetId()));
        cabinets.lockAllByIdIn(cabinetIds); // FOR UPDATE в порядке id

        OffsetDateTime from = days.get(0).atStartOfDay(zone).toOffsetDateTime();
        OffsetDateTime to = days.get(days.size() - 1).plusDays(1).atStartOfDay(zone).toOffsetDateTime();

        Map<Integer, Map<LocalDate, Set<Integer>>> cabinetBusy = new HashMap<>();
        for (SlotRow row : slots.findCabinetSlots(cabinetIds, from, to)) {
            ZonedDateTime z = row.slotDt().atZoneSameInstant(zone);
            int len = dayMinutes / row.slotsPerDay();
            int index = (minuteOfDay(z) - dayStart) / len;
            cabinetBusy.computeIfAbsent(row.cabinetId(), k -> new HashMap<>())
                    .computeIfAbsent(z.toLocalDate(), k -> new HashSet<>()).add(index);
        }
        Map<LocalDate, List<Interval>> patientBusy = new HashMap<>();
        for (SlotRow row : slots.findVoucherSlots(assignment.voucherId())) {
            ZonedDateTime z = row.slotDt().atZoneSameInstant(zone);
            int len = dayMinutes / row.slotsPerDay();
            int start = (minuteOfDay(z) - dayStart) / len * len;
            patientBusy.computeIfAbsent(z.toLocalDate(), k -> new ArrayList<>()).add(new Interval(start, start + len));
        }

        var plan = SlotPlanner.plan(days, requests, dayMinutes, cabinetBusy, patientBusy);
        if (!plan.unplaced().isEmpty()) {
            String detail = plan.unplaced().entrySet().stream()
                    .map(e -> info.get(e.getKey()).name() + ": не размещено сеансов " + e.getValue())
                    .collect(Collectors.joining("; "));
            throw ApiException.conflict("Не хватает свободных слотов кабинетов в срок проживания (" + detail
                    + "). Уменьшите число сеансов или измените назначение.");
        }

        for (SlotPlanner.Slot s : plan.slots()) {
            ZonedDateTime when = ZonedDateTime.of(s.date(), LocalTime.MIDNIGHT, zone).plusMinutes(dayStart + s.startMinute());
            slots.save(new ScheduleSlot(assignmentId, s.procedureId(), when.toOffsetDateTime()));
        }
        slots.flush();
        return ofAssignment(assignmentId);
    }

    @Transactional(readOnly = true)
    public List<ScheduleEntry> ofAssignment(long assignmentId) {
        return slots.findRowsByAssignment(assignmentId).stream().map(ScheduleService::entry).toList();
    }

    /** Сеансы за сутки по всему санаторию (рабочее место врача и процедурной медсестры). */
    @Transactional(readOnly = true)
    public List<ScheduleEntry> forDay(LocalDate day) {
        ZoneId zone = ZoneId.of(props.schedule().zone());
        return slots.findRowsBetween(day.atStartOfDay(zone).toOffsetDateTime(), day.plusDays(1).atStartOfDay(zone).toOffsetDateTime())
                .stream().map(ScheduleService::entry).toList();
    }

    /** Отметка выполнения (ФТ-14). Повторная отметка — 409, чтобы счётчики не расходились. */
    @Transactional
    public void markDone(long scheduleId) {
        if (slots.markDone(scheduleId) == 0) {
            if (!slots.existsById(scheduleId)) {
                throw ApiException.notFound("Сеанс не найден");
            }
            throw ApiException.conflict("Сеанс уже отмечен выполненным");
        }
    }

    private static ScheduleEntry entry(ScheduleRow r) {
        return new ScheduleEntry(r.id(), r.assignmentId(), r.procedureId(), r.procedureName(), r.cabinetName(),
                r.slotDt(), r.done(), r.voucherId(), r.clientName());
    }

    private static int minuteOfDay(ZonedDateTime z) {
        return z.getHour() * 60 + z.getMinute();
    }
}
