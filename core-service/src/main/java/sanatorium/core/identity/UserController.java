package sanatorium.core.identity;

import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.Size;
import java.util.List;
import java.util.Map;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

/** Пользователи и роли (только SYSADMIN, см. SecurityConfig). */
@RestController
@RequestMapping("/api/users")
@Tag(name = "users", description = "Учётные записи и роли (ФТ-02)")
public class UserController {

    public record CreateUser(@NotBlank @Size(min = 3, max = 50) String username,
                             @NotBlank @Size(min = 8, max = 72) String password,
                             @NotBlank @Size(max = 150) String fullName,
                             @Email @Size(max = 150) String email,
                             @NotEmpty List<String> roles) { }

    public record Roles(@NotEmpty List<String> roles) { }

    public record Active(boolean active) { }

    public record NewPassword(@NotBlank @Size(min = 8, max = 72) String password) { }

    private final UserService service;

    public UserController(UserService service) {
        this.service = service;
    }

    /** Постраничный список: page — с нуля, size — от 1 до 200. */
    @GetMapping
    public List<UserService.UserRow> list(@RequestParam(defaultValue = "0") int page,
                                          @RequestParam(defaultValue = "50") int size) {
        return service.list(Math.max(0, page), Math.max(1, Math.min(size, 200)));
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public Map<String, Long> create(@Valid @RequestBody CreateUser r) {
        return Map.of("id", service.create(r.username(), r.password(), r.fullName(), r.email(), r.roles()));
    }

    @PutMapping("/{id}/roles")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void setRoles(@PathVariable long id, @Valid @RequestBody Roles r, @AuthenticationPrincipal Jwt jwt) {
        service.setRoles(id, Access.userId(jwt), r.roles());
    }

    @PutMapping("/{id}/active")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void setActive(@PathVariable long id, @RequestBody Active a, @AuthenticationPrincipal Jwt jwt) {
        service.setActive(id, Access.userId(jwt), a.active());
    }

    @PutMapping("/{id}/password")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void resetPassword(@PathVariable long id, @Valid @RequestBody NewPassword p) {
        service.resetPassword(id, p.password());
    }
}
