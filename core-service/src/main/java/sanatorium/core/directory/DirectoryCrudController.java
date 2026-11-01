package sanatorium.core.directory;

import jakarta.validation.Valid;
import java.util.List;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.ResponseStatus;

/**
 * Общий CRUD справочника. Чтение — любому аутентифицированному пользователю (списки в формах бронирования),
 * изменение — только SYSADMIN: правила заданы в SecurityConfig по шаблону /api/directory/**.
 */
public abstract class DirectoryCrudController<E extends DirectoryEntity<E>, ID> {

    private final DirectoryService service;
    private final JpaRepository<E, ID> repo;
    private final Sort sort;

    protected DirectoryCrudController(DirectoryService service, JpaRepository<E, ID> repo, Sort sort) {
        this.service = service;
        this.repo = repo;
        this.sort = sort;
    }

    @GetMapping
    public List<E> list() {
        return service.list(repo, sort);
    }

    @GetMapping("/{id}")
    public E get(@PathVariable ID id) {
        return service.get(repo, id);
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public E create(@Valid @RequestBody E body) {
        return service.create(repo, body);
    }

    @PutMapping("/{id}")
    public E update(@PathVariable ID id, @Valid @RequestBody E body) {
        return service.update(repo, id, body);
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@PathVariable ID id) {
        service.delete(repo, id);
    }
}
