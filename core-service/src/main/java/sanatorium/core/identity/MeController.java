package sanatorium.core.identity;

import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import sanatorium.core.client.ClientConditionRepository;
import sanatorium.core.client.ClientRepository;
import sanatorium.core.client.ConditionRow;
import sanatorium.core.common.ApiException;

/**
 * Личный профиль (ФТ-21): просмотр и правка своих данных, смена пароля, свои состояния здоровья.
 * Доступен любому вошедшему: в SecurityConfig попадает под общий «/api/** authenticated».
 */
@RestController
@RequestMapping("/api/me")
@Tag(name = "me", description = "Личный профиль: свои данные, смена пароля, состояния здоровья (ФТ-21)")
public class MeController {

    public record UpdateMe(@NotBlank @Size(max = 150) String fullName,
                           @Size(max = 150) String email) { }

    public record ChangePassword(@NotBlank String oldPassword,
                                 @NotBlank @Size(min = 8, max = 72) String newPassword) { }

    private final UserService service;
    private final ClientRepository clients;
    private final ClientConditionRepository conditions;

    public MeController(UserService service, ClientRepository clients, ClientConditionRepository conditions) {
        this.service = service;
        this.clients = clients;
        this.conditions = conditions;
    }

    @GetMapping
    public UserService.UserRow me(@AuthenticationPrincipal Jwt jwt) {
        return service.me(Access.userId(jwt));
    }

    @PutMapping
    public UserService.UserRow update(@Valid @RequestBody UpdateMe r, @AuthenticationPrincipal Jwt jwt) {
        return service.updateMe(Access.userId(jwt), r.fullName(), r.email());
    }

    @PutMapping("/password")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void changePassword(@Valid @RequestBody ChangePassword r, @AuthenticationPrincipal Jwt jwt) {
        service.changeOwnPassword(Access.userId(jwt), r.oldPassword(), r.newPassword());
    }

    /** Свои состояния здоровья — только чтение; управляет ими врач (СЦ-3). */
    @GetMapping("/conditions")
    public List<ConditionRow> conditions(@AuthenticationPrincipal Jwt jwt) {
        Long clientId = clients.findIdByUserId(Access.userId(jwt)).orElse(null);
        if (clientId == null) {
            return List.of();
        }
        return conditions.findRows(clientId);
    }
}
