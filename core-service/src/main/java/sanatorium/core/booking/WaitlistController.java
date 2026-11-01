package sanatorium.core.booking;

import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import sanatorium.core.client.ClientRepository;
import sanatorium.core.common.ApiException;
import sanatorium.core.common.Dtos.WaitlistEntry;
import sanatorium.core.common.Dtos.WaitlistRequest;
import sanatorium.core.identity.Access;

@RestController
@RequestMapping("/api/waitlist")
@Tag(name = "waitlist", description = "Лист ожидания (ФТ-11)")
public class WaitlistController {

    private final WaitlistService waitlist;
    private final ClientRepository clients;

    public WaitlistController(WaitlistService waitlist, ClientRepository clients) {
        this.waitlist = waitlist;
        this.clients = clients;
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public WaitlistEntry add(@Valid @RequestBody WaitlistRequest req, @AuthenticationPrincipal Jwt jwt) {
        long clientId;
        if (Access.isAdmin(jwt)) {
            if (req.clientId() == null) {
                throw ApiException.badRequest("Для постановки администратором нужен clientId");
            }
            clientId = req.clientId();
        } else {
            clientId = clients.findIdByUserId(Access.userId(jwt))
                    .orElseThrow(() -> ApiException.conflict("Профиль клиента не найден"));
        }
        return waitlist.add(req, clientId);
    }

    /** Записи текущего клиента. */
    @GetMapping("/my")
    public List<WaitlistEntry> my(@AuthenticationPrincipal Jwt jwt) {
        long clientId = clients.findIdByUserId(Access.userId(jwt))
                .orElseThrow(() -> ApiException.notFound("Профиль клиента не найден"));
        return waitlist.forClient(clientId);
    }

    /** Все записи (администратор бронирования); фильтр по статусу OPEN/NOTIFIED/CLOSED. */
    @GetMapping
    public List<WaitlistEntry> list(@RequestParam(value = "status", required = false) String status,
                                    @AuthenticationPrincipal Jwt jwt) {
        if (!Access.isAdmin(jwt)) {
            throw ApiException.notFound("Не найдено");
        }
        return waitlist.list(status);
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void close(@PathVariable long id, @AuthenticationPrincipal Jwt jwt) {
        WaitlistEntry e = waitlist.get(id);
        if (!Access.isAdmin(jwt)) {
            long clientId = clients.findIdByUserId(Access.userId(jwt)).orElse(-1L);
            if (clientId != e.clientId()) {
                throw ApiException.notFound("Запись листа ожидания не найдена"); // чужие записи не раскрываем
            }
        }
        waitlist.close(id);
    }
}
