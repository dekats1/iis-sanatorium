package sanatorium.core.client;

import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import sanatorium.core.common.ApiException;
import sanatorium.core.common.Dtos.ClientRequest;
import sanatorium.core.common.Dtos.ClientView;
import sanatorium.core.common.Dtos.ConditionRequest;
import sanatorium.core.common.Dtos.ConditionView;

/**
 * Карточки клиентов и их состояния здоровья (ФТ-04). Доступ задаётся в SecurityConfig:
 * изменение карточки — администратор бронирования; чтение и состояния здоровья — администратор и врач
 * (медицинские сведения только им, НФТ-06).
 */
@RestController
@RequestMapping("/api/clients")
@Tag(name = "clients", description = "Карточки клиентов (пациентов)")
public class ClientController {

    private final ClientService service;

    public ClientController(ClientService service) {
        this.service = service;
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public ClientView create(@Valid @RequestBody ClientRequest req) {
        return service.create(req);
    }

    /** Поиск по началу фамилии; page — с нуля, size — от 1 до 200. */
    @GetMapping
    public List<ClientView> search(@RequestParam(value = "q", required = false) String q,
                                   @RequestParam(value = "page", defaultValue = "0") int page,
                                   @RequestParam(value = "size", defaultValue = "50") int size) {
        if (size < 1 || size > 200 || page < 0) {
            throw ApiException.badRequest("size: 1..200, page ≥ 0");
        }
        return service.search(q, page, size);
    }

    @GetMapping("/{id}")
    public ClientView get(@PathVariable long id) {
        return service.get(id);
    }

    @PutMapping("/{id}")
    public ClientView update(@PathVariable long id, @Valid @RequestBody ClientRequest req) {
        return service.update(id, req);
    }

    @GetMapping("/{id}/conditions")
    public List<ConditionView> conditions(@PathVariable long id) {
        return service.conditions(id);
    }

    @PostMapping("/{id}/conditions")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void addCondition(@PathVariable long id, @Valid @RequestBody ConditionRequest req) {
        service.addCondition(id, req.conditionId(), req.diagnosedAt());
    }

    @DeleteMapping("/{id}/conditions/{conditionId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void removeCondition(@PathVariable long id, @PathVariable int conditionId) {
        service.removeCondition(id, conditionId);
    }
}
