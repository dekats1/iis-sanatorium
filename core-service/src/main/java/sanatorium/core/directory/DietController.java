package sanatorium.core.directory;

import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.data.domain.Sort;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/directory/diets")
@Tag(name = "directory", description = "Справочник: диеты")
public class DietController extends DirectoryCrudController<Diet, Integer> {

    public DietController(DirectoryService service, DietRepository repo) {
        super(service, repo, Sort.by("name"));
    }
}
