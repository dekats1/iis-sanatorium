package sanatorium.core.directory;

import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.data.domain.Sort;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/directory/treatment-profiles")
@Tag(name = "directory", description = "Справочник: лечебные профили")
public class TreatmentProfileController extends DirectoryCrudController<TreatmentProfile, Integer> {

    public TreatmentProfileController(DirectoryService service, TreatmentProfileRepository repo) {
        super(service, repo, Sort.by("name"));
    }
}
