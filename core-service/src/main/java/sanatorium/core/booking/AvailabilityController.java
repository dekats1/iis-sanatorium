package sanatorium.core.booking;

import java.time.LocalDate;
import java.util.List;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import sanatorium.core.common.Dtos.CategoryAvailability;

@RestController
@RequestMapping("/api/availability")
@Tag(name = "availability", description = "Поиск свободных мест с динамической ценой")
public class AvailabilityController {

    private final AvailabilityService service;

    public AvailabilityController(AvailabilityService service) {
        this.service = service;
    }

    @GetMapping
    public List<CategoryAvailability> search(
            @RequestParam("from") @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam("to") @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to,
            @RequestParam(value = "places", defaultValue = "1") int places) {
        return service.search(from, to, places);
    }
}
