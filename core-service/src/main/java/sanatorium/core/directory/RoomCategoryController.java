package sanatorium.core.directory;

import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.data.domain.Sort;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/directory/room-categories")
@Tag(name = "directory", description = "Справочник: категории номеров")
public class RoomCategoryController extends DirectoryCrudController<RoomCategory, Integer> {

    public RoomCategoryController(DirectoryService service, RoomCategoryRepository repo) {
        super(service, repo, Sort.by("id"));
    }
}
