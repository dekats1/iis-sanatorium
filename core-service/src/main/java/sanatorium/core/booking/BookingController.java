package sanatorium.core.booking;

import java.util.List;
import jakarta.validation.Valid;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
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
import sanatorium.core.common.Dtos.CancelResponse;
import sanatorium.core.common.Dtos.CreateVoucherRequest;
import sanatorium.core.common.Dtos.PayResponse;
import sanatorium.core.common.Dtos.VoucherView;
import sanatorium.core.identity.Access;
import sanatorium.core.payment.PaymentService;

@RestController
@RequestMapping("/api/vouchers")
@Tag(name = "vouchers", description = "Путёвки: оформление, оплата, отмена")
public class BookingController {

    private final BookingService booking;
    private final PaymentService payments;
    private final VoucherLifecycleService lifecycle;
    private final ClientRepository clients;
    private final VoucherViewService views;
    private final Access access;

    public BookingController(BookingService booking, PaymentService payments, VoucherLifecycleService lifecycle,
                             ClientRepository clients, VoucherViewService views, Access access) {
        this.booking = booking;
        this.payments = payments;
        this.lifecycle = lifecycle;
        this.clients = clients;
        this.views = views;
        this.access = access;
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public VoucherView create(@Valid @RequestBody CreateVoucherRequest req, @AuthenticationPrincipal Jwt jwt) {
        return booking.create(req, Access.userId(jwt), Access.isAdmin(jwt));
    }

    /** Путёвки текущего клиента (история, запрос Q6 главы 2 — упрощённо). */
    @GetMapping("/my")
    public List<VoucherView> my(@AuthenticationPrincipal Jwt jwt) {
        long clientId = clients.findIdByUserId(Access.userId(jwt))
                .orElseThrow(() -> ApiException.notFound("Профиль клиента не найден"));
        return views.viewsByClient(clientId);
    }

    /** Список путёвок для рабочего места администратора (ФТ-07); права — в SecurityConfig (только BOOKING_ADMIN). */
    @GetMapping
    public List<VoucherView> list(@RequestParam(value = "status", required = false) String status) {
        return views.viewsAll(status);
    }

    @GetMapping("/{id}")
    public VoucherView get(@PathVariable long id, @AuthenticationPrincipal Jwt jwt) {
        access.requireVoucherAccess(jwt, id);
        return views.view(id).orElseThrow(() -> ApiException.notFound("Путёвка не найдена"));
    }

    @PostMapping("/{id}/pay")
    public PayResponse pay(@PathVariable long id, @AuthenticationPrincipal Jwt jwt) {
        access.requireVoucherAccess(jwt, id);
        return payments.startPrepayment(id);
    }

    @PostMapping("/{id}/cancel")
    public CancelResponse cancel(@PathVariable long id, @AuthenticationPrincipal Jwt jwt) {
        access.requireVoucherAccess(jwt, id);
        var result = lifecycle.cancel(id);
        VoucherView view = views.view(id).orElseThrow(() -> ApiException.notFound("Путёвка не найдена"));
        return new CancelResponse(view, result.retainPercent(), result.retained(), result.refund());
    }

    /** Регистрация заезда (ФТ-10); доступ только администратору бронирования — см. SecurityConfig. */
    @PostMapping("/{id}/check-in")
    public VoucherView checkIn(@PathVariable long id) {
        lifecycle.checkIn(id);
        return views.view(id).orElseThrow(() -> ApiException.notFound("Путёвка не найдена"));
    }

    @PostMapping("/{id}/check-out")
    public VoucherView checkOut(@PathVariable long id) {
        lifecycle.checkOut(id);
        return views.view(id).orElseThrow(() -> ApiException.notFound("Путёвка не найдена"));
    }
}
