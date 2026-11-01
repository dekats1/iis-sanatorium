package sanatorium.core.directory;

import io.swagger.v3.oas.annotations.tags.Tag;
import java.util.List;
import java.util.Set;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

/** Справочник процедур и их связи N:M с лечебными профилями и состояниями-противопоказаниями. */
@RestController
@RequestMapping("/api/directory/procedures")
@Tag(name = "directory", description = "Справочник: процедуры, профили и противопоказания")
public class MedicalProcedureController extends DirectoryCrudController<MedicalProcedure, Integer> {

    private final DirectoryService service;

    public MedicalProcedureController(DirectoryService service, MedicalProcedureRepository repo) {
        super(service, repo, Sort.by("name"));
        this.service = service;
    }

    @GetMapping("/{id}/profiles")
    public List<Integer> profiles(@PathVariable int id) {
        return service.procedureProfiles(id);
    }

    @PutMapping("/{id}/profiles")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void setProfiles(@PathVariable int id, @RequestBody Set<Integer> profileIds) {
        service.replaceProcedureProfiles(id, profileIds);
    }

    @GetMapping("/{id}/contraindications")
    public List<Integer> contraindications(@PathVariable int id) {
        return service.procedureContraindications(id);
    }

    @PutMapping("/{id}/contraindications")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void setContraindications(@PathVariable int id, @RequestBody Set<Integer> conditionIds) {
        service.replaceProcedureContraindications(id, conditionIds);
    }
}
