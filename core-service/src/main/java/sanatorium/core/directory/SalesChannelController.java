package sanatorium.core.directory;

import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.data.domain.Sort;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/directory/sales-channels")
@Tag(name = "directory", description = "Справочник: каналы продаж")
public class SalesChannelController extends DirectoryCrudController<SalesChannel, Integer> {

    public SalesChannelController(DirectoryService service, SalesChannelRepository repo) {
        super(service, repo, Sort.by("id"));
    }
}
