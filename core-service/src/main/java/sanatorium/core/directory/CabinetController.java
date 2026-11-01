package sanatorium.core.directory;

import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.data.domain.Sort;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/directory/cabinets")
@Tag(name = "directory", description = "Справочник: процедурные кабинеты")
public class CabinetController extends DirectoryCrudController<Cabinet, Integer> {

    public CabinetController(DirectoryService service, CabinetRepository repo) {
        super(service, repo, Sort.by("name"));
    }
}
