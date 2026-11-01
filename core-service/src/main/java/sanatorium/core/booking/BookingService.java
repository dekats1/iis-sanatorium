package sanatorium.core.booking;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.sql.SQLException;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Objects;
import java.util.UUID;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;
import sanatorium.core.client.ClientRepository;
import sanatorium.core.common.ApiException;
import sanatorium.core.common.CoreProperties;
import sanatorium.core.common.Dtos.CreateVoucherRequest;
import sanatorium.core.common.Dtos.VoucherView;
import sanatorium.core.common.Money;
import sanatorium.core.pricingclient.PricingClient;
import sanatorium.core.pricingclient.QuotedLine;

/**
 * Сценарий СЦ-1: бронирование с динамической ценой (ФТ-05…ФТ-09).
 *
 * <p>Последовательность: (1) проверка дат и клиента; (2) предварительная проверка наличия мест без блокировок;
 * (3) фиксация цены в pricing-forecast (HTTP-вызов вне транзакции БД — транзакция не держится на сетевом
 * вызове); (4) размещение в одной транзакции: путёвка + бронь + места. Конкурентные брони разрешает
 * ограничение bp_no_overlap (EXCLUDE USING gist): при нарушении (SQLSTATE 23P01) транзакция откатывается
 * и подбор повторяется — максимум core.booking.placement-retries раз.
 */
@Service
public class BookingService {

    private static final Logger log = LoggerFactory.getLogger(BookingService.class);
    private static final String EXCLUSION_VIOLATION = "23P01";

    private final VoucherRepository vouchers;
    private final BookingRepository bookings;
    private final ClientRepository clients;
    private final VoucherViewService views;
    private final PricingClient pricing;
    private final CoreProperties props;
    private final TransactionTemplate tx;

    public BookingService(VoucherRepository vouchers, BookingRepository bookings, ClientRepository clients,
                          VoucherViewService views, PricingClient pricing, CoreProperties props,
                          PlatformTransactionManager txManager) {
        this.vouchers = vouchers;
        this.bookings = bookings;
        this.clients = clients;
        this.views = views;
        this.pricing = pricing;
        this.props = props;
        this.tx = new TransactionTemplate(txManager);
    }

    public VoucherView create(CreateVoucherRequest req, long userId, boolean isAdmin) {
        validateDates(req.checkIn(), req.checkOut());
        long clientId = resolveClient(req, userId, isAdmin);
        int category = req.categoryId();
        List<LocalDate> nights = StayDates.nights(req.checkIn(), req.checkOut());

        if (RoomPlacement.choose(bookings.freePlaces(category, req.checkIn(), req.checkOut()), req.places()).isEmpty()) {
            throw ApiException.conflict("Нет номера с таким количеством свободных мест на выбранные даты");
        }

        List<QuotedLine> quote = pricing.quote(category, nights, true);
        BigDecimal perPlaceTotal = quote.stream().map(QuotedLine::price).reduce(BigDecimal.ZERO, BigDecimal::add);
        BigDecimal total = Money.round(perPlaceTotal.multiply(BigDecimal.valueOf(req.places())));
        BigDecimal perDay = Money.round(perPlaceTotal.divide(BigDecimal.valueOf(nights.size()), 10, RoundingMode.HALF_UP));
        // vouchers.quote_id — одно значение: сохраняем идентификатор первой зафиксированной котировки;
        // остальные ночи прослеживаются в price_reviews по quote_id каждой строки (ограничение прототипа).
        UUID quoteId = quote.stream().map(QuotedLine::quoteId).filter(Objects::nonNull).findFirst().orElse(null);
        OffsetDateTime deadline = OffsetDateTime.now().plusHours(props.booking().paymentDeadlineHours());

        int retries = Math.max(1, props.booking().placementRetries());
        for (int attempt = 1; attempt <= retries; attempt++) {
            try {
                long voucherId = tx.execute(status -> place(req, clientId, userId, quoteId, perDay, total, deadline));
                return views.view(voucherId).orElseThrow();
            } catch (DataIntegrityViolationException ex) {
                if (!isExclusionViolation(ex)) {
                    throw ex;
                }
                log.info("Гонка за места (попытка {}/{}), повторяем подбор", attempt, retries);
            }
        }
        throw ApiException.conflict("Места только что заняты другим клиентом, повторите поиск");
    }

    /**
     * Размещение в одной транзакции: путёвка → бронь → места. Путёвка и бронь сохраняются через JPA (IDENTITY —
     * INSERT выполняется сразу), места — нативной вставкой с daterange. Нарушение bp_no_overlap откатывает всё.
     */
    private long place(CreateVoucherRequest req, long clientId, long userId, UUID quoteId, BigDecimal perDay,
                       BigDecimal total, OffsetDateTime deadline) {
        List<FreePlace> free = bookings.freePlaces(req.categoryId(), req.checkIn(), req.checkOut());
        Placement placement = RoomPlacement.choose(free, req.places())
                .orElseThrow(() -> ApiException.conflict("Нет номера с таким количеством свободных мест"));
        Voucher voucher = vouchers.save(new Voucher(clientId, req.customerId(), req.channelId(), req.profileId(),
                req.dietId(), userId, quoteId, perDay, total, deadline));
        Booking booking = bookings.save(new Booking(voucher.getId(), placement.roomId(), req.checkIn(), req.checkOut(),
                req.places()));
        for (int placeNo : placement.placeNos()) {
            bookings.insertPlace(booking.getId(), placement.roomId(), placeNo, req.checkIn(), req.checkOut());
        }
        return voucher.getId();
    }

    private long resolveClient(CreateVoucherRequest req, long userId, boolean isAdmin) {
        if (isAdmin) {
            if (req.clientId() == null) {
                throw ApiException.badRequest("Для оформления администратором нужен clientId");
            }
            return req.clientId();
        }
        return clients.findIdByUserId(userId)
                .orElseThrow(() -> ApiException.conflict("Профиль клиента не найден"));
    }

    private void validateDates(LocalDate checkIn, LocalDate checkOut) {
        if (checkIn.isBefore(LocalDate.now())) {
            throw ApiException.badRequest("Дата заезда не может быть в прошлом");
        }
        if (!checkOut.isAfter(checkIn)) {
            throw ApiException.badRequest("Дата выезда должна быть позже даты заезда");
        }
        if (StayDates.nightsCount(checkIn, checkOut) > props.booking().maxNights()) {
            throw ApiException.badRequest("Срок проживания не более " + props.booking().maxNights() + " суток");
        }
    }

    static boolean isExclusionViolation(DataIntegrityViolationException ex) {
        return ex.getMostSpecificCause() instanceof SQLException sql && EXCLUSION_VIOLATION.equals(sql.getSQLState());
    }
}
