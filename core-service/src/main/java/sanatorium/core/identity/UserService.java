package sanatorium.core.identity;

import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.data.domain.PageRequest;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import sanatorium.core.common.ApiException;

/**
 * Управление учётными записями сотрудников (ФТ-02, роль SYSADMIN). Клиенты регистрируются сами (AuthService).
 * Известное ограничение: уже выданный JWT действует до истечения срока (ttl-minutes), даже если учётная
 * запись деактивирована; повторный вход невозможен сразу.
 */
@Service
public class UserService {

    static final Set<String> ROLE_CODES = Set.of("CLIENT", "BOOKING_ADMIN", "DOCTOR", "MANAGER", "SYSADMIN");

    public record UserRow(long id, String username, String fullName, String email, boolean active, List<String> roles) { }

    private final UserRepository users;
    private final RoleRepository roles;
    private final PasswordEncoder encoder;

    public UserService(UserRepository users, RoleRepository roles, PasswordEncoder encoder) {
        this.users = users;
        this.roles = roles;
        this.encoder = encoder;
    }

    @Transactional(readOnly = true)
    public List<UserRow> list(int page, int size) {
        return users.page(PageRequest.of(page, size)).stream().map(UserService::row).toList();
    }

    @Transactional
    public long create(String username, String password, String fullName, String email, List<String> roleCodes) {
        Set<Role> resolved = resolveRoles(roleCodes);
        UserAccount user = new UserAccount(username, encoder.encode(password), fullName, email);
        user.getRoles().addAll(resolved);
        try {
            return users.saveAndFlush(user).getId();
        } catch (DataIntegrityViolationException ex) {
            throw ApiException.conflict("Пользователь с таким логином или e-mail уже существует");
        }
    }

    @Transactional
    public void setRoles(long userId, long actorId, List<String> roleCodes) {
        Set<Role> resolved = resolveRoles(roleCodes);
        UserAccount user = users.lockById(userId).orElseThrow(() -> ApiException.notFound("Пользователь не найден"));
        // администратор не может лишить роли SYSADMIN самого себя (иначе система останется без администратора)
        if (userId == actorId && !roleCodes.contains("SYSADMIN")) {
            throw ApiException.conflict("Нельзя снять роль SYSADMIN с самого себя");
        }
        user.getRoles().clear();
        user.getRoles().addAll(resolved);
    }

    @Transactional
    public void setActive(long userId, long actorId, boolean active) {
        if (userId == actorId && !active) {
            throw ApiException.conflict("Нельзя деактивировать самого себя");
        }
        users.findById(userId).orElseThrow(() -> ApiException.notFound("Пользователь не найден")).setActive(active);
    }

    @Transactional
    public void resetPassword(long userId, String newPassword) {
        users.findById(userId).orElseThrow(() -> ApiException.notFound("Пользователь не найден"))
                .setPasswordHash(encoder.encode(newPassword));
    }

    /** Собственные данные текущего пользователя (ФТ-21). */
    @Transactional(readOnly = true)
    public UserRow me(long userId) {
        return users.findById(userId).map(UserService::row)
                .orElseThrow(() -> ApiException.notFound("Пользователь не найден"));
    }

    /** Правка своих данных: имя и e-mail. Логин и роли не меняются (ФТ-21). */
    @Transactional
    public UserRow updateMe(long userId, String fullName, String email) {
        UserAccount user = users.findById(userId).orElseThrow(() -> ApiException.notFound("Пользователь не найден"));
        if (fullName != null && !fullName.isBlank()) {
            user.setFullName(fullName.trim());
        }
        if (email != null) {
            user.setEmail(email);
        }
        return row(user);
    }

    /** Смена пароля самим пользователем: старый проверяется, новый хешируется (ФТ-21). */
    @Transactional
    public void changeOwnPassword(long userId, String oldPassword, String newPassword) {
        UserAccount user = users.findById(userId)
                .orElseThrow(() -> ApiException.notFound("Пользователь не найден"));
        if (!encoder.matches(oldPassword, user.getPasswordHash())) {
            throw ApiException.badRequest("Старый пароль указан неверно");
        }
        user.setPasswordHash(encoder.encode(newPassword));
    }

    private Set<Role> resolveRoles(List<String> codes) {
        if (codes == null || codes.isEmpty()) {
            throw ApiException.badRequest("Нужно указать хотя бы одну роль");
        }
        for (String c : codes) {
            if (!ROLE_CODES.contains(c)) {
                throw ApiException.badRequest("Неизвестная роль: " + c);
            }
        }
        return Set.copyOf(roles.findAllByCodeIn(Set.copyOf(codes)));
    }

    private static UserRow row(UserAccount u) {
        List<String> codes = u.getRoles().stream().map(Role::getCode).sorted().collect(Collectors.toList());
        return new UserRow(u.getId(), u.getUsername(), u.getFullName(), u.getEmail(), u.isActive(), codes);
    }
}
