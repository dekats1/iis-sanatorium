package sanatorium.core.directory;

import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.data.domain.Sort;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/directory/rooms")
@Tag(name = "directory", description = "Справочник: номера")
public class RoomController extends DirectoryCrudController<Room, Integer> {

    public RoomController(DirectoryService service, RoomRepository repo) {
        super(service, repo, Sort.by("roomNumber"));
    }
}
