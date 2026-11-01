package sanatorium.core.medical;

import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import java.time.LocalDate;
import java.util.List;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import sanatorium.core.common.Dtos.AssignmentRequest;
import sanatorium.core.common.Dtos.AssignmentView;
import sanatorium.core.common.Dtos.ScheduleEntry;
import sanatorium.core.identity.Access;

/** Лечебный блок: назначения, расписание, отметка выполнения. Роль DOCTOR (чтение назначений — также BOOKING_ADMIN). */
@RestController
@RequestMapping("/api")
@Tag(name = "medical", description = "Назначения лечения и расписание процедур (ФТ-12…ФТ-14)")
public class AssignmentController {

    private final AssignmentService assignments;
    private final ScheduleService schedule;

    public AssignmentController(AssignmentService assignments, ScheduleService schedule) {
        this.assignments = assignments;
        this.schedule = schedule;
    }

    @PostMapping("/assignments")
    @ResponseStatus(HttpStatus.CREATED)
    public AssignmentView create(@Valid @RequestBody AssignmentRequest req, @AuthenticationPrincipal Jwt jwt) {
        return assignments.create(req, Access.userId(jwt));
    }

    @GetMapping("/assignments/by-voucher/{voucherId}")
    public List<AssignmentView> byVoucher(@PathVariable long voucherId) {
        return assignments.byVoucher(voucherId);
    }

    @PostMapping("/assignments/{id}/schedule")
    @ResponseStatus(HttpStatus.CREATED)
    public List<ScheduleEntry> plan(@PathVariable long id) {
        return schedule.plan(id);
    }

    @GetMapping("/assignments/{id}/schedule")
    public List<ScheduleEntry> scheduleOf(@PathVariable long id) {
        assignments.get(id); // 404, если назначения нет
        return schedule.ofAssignment(id);
    }

    @GetMapping("/schedule")
    public List<ScheduleEntry> forDay(@RequestParam("date") @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date) {
        return schedule.forDay(date);
    }

    @PostMapping("/schedule/{id}/done")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void done(@PathVariable long id) {
        schedule.markDone(id);
    }
}
