package sanatorium.core.identity;

import jakarta.validation.Valid;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import sanatorium.core.common.Dtos.LoginRequest;
import sanatorium.core.common.Dtos.RegisterRequest;
import sanatorium.core.common.Dtos.TokenResponse;

@RestController
@RequestMapping("/api/auth")
@Tag(name = "auth", description = "Вход и регистрация клиента")
public class LoginController {

    private final AuthService auth;

    public LoginController(AuthService auth) {
        this.auth = auth;
    }

    @PostMapping("/login")
    public TokenResponse login(@Valid @RequestBody LoginRequest req) {
        return auth.login(req);
    }

    @PostMapping("/register")
    @ResponseStatus(HttpStatus.CREATED)
    public void register(@Valid @RequestBody RegisterRequest req) {
        auth.registerClient(req);
    }
}
