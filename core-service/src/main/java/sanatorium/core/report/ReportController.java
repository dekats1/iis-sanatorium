package sanatorium.core.report;

import java.time.LocalDate;
import java.util.List;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import sanatorium.core.common.Dtos.BiMonthlyPoint;
import sanatorium.core.common.Dtos.ChannelRevenue;
import sanatorium.core.common.Dtos.KpiView;
import sanatorium.core.common.Dtos.ProfilePopularity;
import sanatorium.core.identity.SecurityConfig;

/** Отчёты менеджера по доходам (доступ ограничен ролью MANAGER в SecurityConfig). */
@RestController
@RequestMapping("/api/reports")
@Tag(name = "reports", description = "KPI, выручка по каналам и BI аналитика")
public class ReportController {

    private final ReportService reports;

    public ReportController(ReportService reports) {
        this.reports = reports;
    }

    @GetMapping("/kpi")
    public KpiView kpi(@RequestParam("from") @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
                       @RequestParam("to") @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to) {
        return reports.kpi(from, to);
    }

    @GetMapping("/channels")
    public List<ChannelRevenue> channels() {
        return reports.channels();
    }

    @GetMapping("/bi-monthly")
    public List<BiMonthlyPoint> biMonthly() {
        return reports.biMonthly();
    }

    @GetMapping("/profiles")
    public List<ProfilePopularity> profiles() {
        return reports.profilePopularity();
    }
}
