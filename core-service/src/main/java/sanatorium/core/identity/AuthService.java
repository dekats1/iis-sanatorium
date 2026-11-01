package sanatorium.core.identity;

import java.util.List;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import sanatorium.core.client.Client;
import sanatorium.core.client.ClientRepository;
import sanatorium.core.common.ApiException;
import sanatorium.core.common.CoreProperties;
import sanatorium.core.common.Dtos.LoginRequest;
import sanatorium.core.common.Dtos.RegisterRequest;
import sanatorium.core.common.Dtos.TokenResponse;

/** Вход и саморегистрация клиента (ФТ-01, ФТ-02). Пароли — BCrypt, токен — JWT HS256. */
@Service
public class AuthService {

    // Хеш-пустышка: при неизвестном логине всё равно выполняем проверку BCrypt, чтобы время ответа
    // не выдавало существование учётной записи.
    private final String dummyHash;

    private final UserRepository users;
    private final RoleRepository roles;
    private final ClientRepository clients;
    private final PasswordEncoder encoder;
    private final JwtTokenProvider jwt;
    private final CoreProperties props;

    public AuthService(UserRepository users, RoleRepository roles, ClientRepository clients, PasswordEncoder encoder,
                       JwtTokenProvider jwt, CoreProperties props) {
        this.users = users;
        this.roles = roles;
        this.clients = clients;
        this.encoder = encoder;
        this.jwt = jwt;
        this.props = props;
        this.dummyHash = encoder.encode("dummy-password-for-timing");
    }

    @Transactional(readOnly = true)
    public TokenResponse login(LoginRequest req) {
        UserAccount user = users.findByUsername(req.username()).orElse(null);
        boolean ok = encoder.matches(req.password(), user == null ? dummyHash : user.getPasswordHash());
        if (user == null || !ok || !user.isActive()) {
            throw new ApiException(HttpStatus.UNAUTHORIZED, "Неверный логин или пароль");
        }
        List<String> codes = user.getRoles().stream().map(Role::getCode).sorted().toList();
        return new TokenResponse(jwt.issueUserToken(user.getId(), codes), "Bearer", props.jwt().ttlMinutes(), codes);
    }

    @Transactional
    public void registerClient(RegisterRequest r) {
        Role clientRole = roles.findByCode("CLIENT")
                .orElseThrow(() -> ApiException.badGateway("Справочник ролей не заполнен"));
        try {
            UserAccount user = new UserAccount(r.username(), encoder.encode(r.password()), fullName(r), r.email());
            user.getRoles().add(clientRole);
            users.saveAndFlush(user);
            Client client = new Client(r.lastName(), r.firstName(), r.birthDate());
            client.setUserId(user.getId());
            client.setMiddleName(blankToNull(r.middleName()));
            client.setPhone(blankToNull(r.phone()));
            client.setEmail(blankToNull(r.email()));
            clients.saveAndFlush(client);
        } catch (DataIntegrityViolationException ex) {
            throw ApiException.conflict("Пользователь с таким логином или e-mail уже существует");
        }
    }

    private static String fullName(RegisterRequest r) {
        return (r.lastName() + " " + r.firstName() + (r.middleName() == null || r.middleName().isBlank() ? "" : " " + r.middleName())).trim();
    }

    private static String blankToNull(String s) {
        return s == null || s.isBlank() ? null : s;
    }
}
