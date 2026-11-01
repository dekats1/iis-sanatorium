package sanatorium.core.directory;

import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.data.domain.Sort;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/directory/customers")
@Tag(name = "directory", description = "Справочник: заказчики (только для сотрудников)")
public class CustomerController extends DirectoryCrudController<Customer, Long> {

    public CustomerController(DirectoryService service, CustomerRepository repo) {
        super(service, repo, Sort.by("name"));
    }
}
