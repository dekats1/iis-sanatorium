package sanatorium.core.audit;

import io.swagger.v3.oas.annotations.tags.Tag;
import java.util.List;
import org.springframework.data.domain.PageRequest;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/** Просмотр журнала (только SYSADMIN). Постраничный список: page — с нуля, size — от 1 до 200. */
@RestController
@RequestMapping("/api/audit")
@Tag(name = "audit", description = "Журнал действий")
public class AuditController {

    private final AuditLogRepository repo;

    public AuditController(AuditLogRepository repo) {
        this.repo = repo;
    }

    @GetMapping
    @Transactional(readOnly = true)
    public List<AuditRow> list(@RequestParam(defaultValue = "0") int page, @RequestParam(defaultValue = "50") int size) {
        return repo.findLatest(PageRequest.of(Math.max(0, page), Math.max(1, Math.min(size, 200))));
    }
}
