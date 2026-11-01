package sanatorium.core.directory;

import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.data.domain.Sort;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/directory/medical-conditions")
@Tag(name = "directory", description = "Справочник: состояния здоровья")
public class MedicalConditionController extends DirectoryCrudController<MedicalCondition, Integer> {

    public MedicalConditionController(DirectoryService service, MedicalConditionRepository repo) {
        super(service, repo, Sort.by("name"));
    }
}
