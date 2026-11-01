package sanatorium.core.booking;

import java.time.LocalDate;
import java.util.Collection;
import java.util.List;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import sanatorium.core.common.ApiException;
import sanatorium.core.common.CoreProperties;
import sanatorium.core.common.Dtos.WaitlistEntry;
import sanatorium.core.common.Dtos.WaitlistRequest;

/**
 * Лист ожидания (ФТ-11). Запись ставится, когда мест нет; при освобождении мест (отмена, истечение срока оплаты)
 * подходящие записи переводятся OPEN → NOTIFIED. Канал уведомления в прототипе — статус записи и журнал приложения
 * (почты/SMS нет): клиент и администратор видят статус в интерфейсе. Места за клиентом НЕ резервируются.
 */
@Service
public class WaitlistService {

    private static final Logger log = LoggerFactory.getLogger(WaitlistService.class);

    private final WaitlistRepository repo;
    private final BookingRepository bookings;
    private final CoreProperties props;

    public WaitlistService(WaitlistRepository repo, BookingRepository bookings, CoreProperties props) {
        this.repo = repo;
        this.bookings = bookings;
        this.props = props;
    }

    @Transactional
    public WaitlistEntry add(WaitlistRequest req, long clientId) {
        if (req.dateFrom().isBefore(LocalDate.now())) {
            throw ApiException.badRequest("Дата заезда не может быть в прошлом");
        }
        if (!req.dateTo().isAfter(req.dateFrom())) {
            throw ApiException.badRequest("Дата выезда должна быть позже даты заезда");
        }
        if (StayDates.nightsCount(req.dateFrom(), req.dateTo()) > props.booking().maxNights()) {
            throw ApiException.badRequest("Срок проживания не более " + props.booking().maxNights() + " суток");
        }
        if (RoomPlacement.choose(bookings.freePlaces(req.categoryId(), req.dateFrom(), req.dateTo()), req.places()).isPresent()) {
            throw ApiException.conflict("Места на эти даты есть — оформите бронирование, лист ожидания не нужен");
        }
        return view(repo.saveAndFlush(new WaitlistItem(clientId, req.categoryId(), req.dateFrom(), req.dateTo(), req.places())));
    }

    @Transactional(readOnly = true)
    public WaitlistEntry get(long id) {
        return repo.findById(id).map(WaitlistService::view)
                .orElseThrow(() -> ApiException.notFound("Запись листа ожидания не найдена"));
    }

    @Transactional(readOnly = true)
    public List<WaitlistEntry> forClient(long clientId) {
        return repo.findByClientIdOrderByIdDesc(clientId).stream().map(WaitlistService::view).toList();
    }

    @Transactional(readOnly = true)
    public List<WaitlistEntry> list(String status) {
        var page = PageRequest.of(0, 500);
        List<WaitlistItem> items;
        if (status == null || status.isBlank()) {
            items = repo.findLatest(page);
        } else {
            WaitlistStatus parsed;
            try {
                parsed = WaitlistStatus.valueOf(status);
            } catch (IllegalArgumentException ex) {
                throw ApiException.badRequest("Статус: OPEN, NOTIFIED или CLOSED");
            }
            items = repo.findByStatusOrderByIdDesc(parsed, page);
        }
        return items.stream().map(WaitlistService::view).toList();
    }

    @Transactional
    public void close(long id) {
        repo.findById(id).orElseThrow(() -> ApiException.notFound("Запись листа ожидания не найдена"))
                .setStatus(WaitlistStatus.CLOSED);
    }

    /** Вызывается после освобождения мест в категориях: уведомляет подходящие открытые записи. Возвращает число уведомлённых. */
    @Transactional
    public int notifyFreed(Collection<Integer> categoryIds) {
        int notified = 0;
        for (int category : categoryIds) {
            List<WaitlistItem> open = repo.findByStatusAndCategoryIdAndDateToAfterOrderById(
                    WaitlistStatus.OPEN, category, LocalDate.now());
            for (WaitlistItem e : open) {
                if (RoomPlacement.choose(bookings.freePlaces(category, e.getDateFrom(), e.getDateTo()), e.getPlaces()).isPresent()
                        && repo.changeStatus(e.getId(), WaitlistStatus.OPEN, WaitlistStatus.NOTIFIED) > 0) {
                    log.info("Лист ожидания: освободились места для записи {} (клиент {}, категория {}, {}–{})",
                            e.getId(), e.getClientId(), category, e.getDateFrom(), e.getDateTo());
                    notified++;
                }
            }
        }
        return notified;
    }

    private static WaitlistEntry view(WaitlistItem w) {
        return new WaitlistEntry(w.getId(), w.getClientId(), w.getCategoryId(), w.getDateFrom(), w.getDateTo(),
                w.getPlaces(), w.getStatus().name(), w.getCreatedAt());
    }
}
