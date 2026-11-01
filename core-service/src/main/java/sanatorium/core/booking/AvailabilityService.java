package sanatorium.core.booking;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import sanatorium.core.common.ApiException;
import sanatorium.core.directory.RoomCategoryRepository;
import sanatorium.core.common.CoreProperties;
import sanatorium.core.common.Dtos.CategoryAvailability;
import sanatorium.core.common.Money;
import sanatorium.core.pricingclient.PricingClient;
import sanatorium.core.pricingclient.QuotedLine;

/** Поиск свободных мест с предпросмотром динамической цены (ФТ-05, ФТ-06). Квоты не фиксируются. */
@Service
public class AvailabilityService {

    private final RoomCategoryRepository categories;
    private final BookingRepository bookings;
    private final PricingClient pricing;
    private final CoreProperties props;

    public AvailabilityService(RoomCategoryRepository categories, BookingRepository bookings, PricingClient pricing,
                               CoreProperties props) {
        this.categories = categories;
        this.bookings = bookings;
        this.pricing = pricing;
        this.props = props;
    }

    public List<CategoryAvailability> search(LocalDate from, LocalDate to, int places) {
        if (from.isBefore(LocalDate.now())) {
            throw ApiException.badRequest("Дата заезда не может быть в прошлом");
        }
        if (!to.isAfter(from)) {
            throw ApiException.badRequest("Дата выезда должна быть позже даты заезда");
        }
        if (StayDates.nightsCount(from, to) > props.booking().maxNights()) {
            throw ApiException.badRequest("Срок проживания не более " + props.booking().maxNights() + " суток");
        }
        if (places < 1 || places > 10) {
            throw ApiException.badRequest("Количество мест: от 1 до 10");
        }

        List<LocalDate> nights = StayDates.nights(from, to);
        List<CategoryAvailability> result = new ArrayList<>();
        for (var cat : categories.findAll(Sort.by("id"))) {
            List<FreePlace> free = bookings.freePlaces(cat.getId(), from, to);
            int maxInRoom = RoomPlacement.maxInOneRoom(free);
            if (free.isEmpty()) {
                continue; // категория полностью занята на период — не показываем
            }
            try {
                List<QuotedLine> quote = pricing.quote(cat.getId(), nights, false);
                BigDecimal total = quote.stream().map(QuotedLine::price).reduce(BigDecimal.ZERO, BigDecimal::add);
                BigDecimal avg = Money.round(total.divide(BigDecimal.valueOf(nights.size()), 10, RoundingMode.HALF_UP));
                boolean snapshot = quote.stream().anyMatch(QuotedLine::fallback);
                result.add(new CategoryAvailability(cat.getId(), cat.getName(), free.size(), maxInRoom, avg,
                        Money.round(total), snapshot, true));
            } catch (ApiException ex) {
                // Цена недоступна — показываем места без цены, бронирование для категории вернёт 503.
                result.add(new CategoryAvailability(cat.getId(), cat.getName(), free.size(), maxInRoom, null, null, false, false));
            }
        }
        return result;
    }
}
