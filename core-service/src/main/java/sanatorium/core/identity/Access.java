package sanatorium.core.identity;

import java.util.List;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.stereotype.Component;
import sanatorium.core.booking.Voucher;
import sanatorium.core.booking.VoucherRepository;
import sanatorium.core.client.ClientRepository;
import sanatorium.core.common.ApiException;

/** Проверки принадлежности ресурса пользователю (защита от доступа к чужим путёвкам, НФТ-04). */
@Component
public class Access {

    private final VoucherRepository vouchers;
    private final ClientRepository clients;

    public Access(VoucherRepository vouchers, ClientRepository clients) {
        this.vouchers = vouchers;
        this.clients = clients;
    }

    public static long userId(Jwt jwt) {
        return Long.parseLong(jwt.getSubject());
    }

    public static boolean isAdmin(Jwt jwt) {
        List<String> roles = jwt.getClaimAsStringList("roles");
        return roles != null && (roles.contains("BOOKING_ADMIN") || roles.contains("SYSADMIN"));
    }

    /** Сотрудник: любая роль, кроме клиента. */
    public static boolean isStaff(Jwt jwt) {
        List<String> roles = jwt.getClaimAsStringList("roles");
        return roles != null && roles.stream().anyMatch(r -> !"CLIENT".equals(r));
    }

    /** Клиент видит только свои путёвки; администратор бронирования — любые. */
    public Voucher requireVoucherAccess(Jwt jwt, long voucherId) {
        Voucher v = vouchers.findById(voucherId).orElseThrow(() -> ApiException.notFound("Путёвка не найдена"));
        if (!isAdmin(jwt)) {
            Long ownerUserId = clients.findUserIdById(v.getClientId()).orElse(null);
            if (ownerUserId == null || ownerUserId != userId(jwt)) {
                // 404, а не 403: не раскрываем существование чужих путёвок
                throw ApiException.notFound("Путёвка не найдена");
            }
        }
        return v;
    }
}
