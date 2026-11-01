package sanatorium.core.roommap;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.Map;
import java.util.function.Function;
import java.util.stream.Collectors;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import sanatorium.core.common.ApiException;
import sanatorium.core.directory.Room;
import sanatorium.core.directory.RoomCategory;
import sanatorium.core.directory.RoomCategoryRepository;
import sanatorium.core.directory.RoomRepository;
import sanatorium.core.roommap.RoomMapDtos.InteractiveRoomView;
import sanatorium.core.roommap.RoomMapDtos.RoomMapStats;
import sanatorium.core.roommap.RoomMapDtos.UpdateRoomStatusRequest;

@Service
public class RoomMapService {

    private final RoomRepository roomRepository;
    private final RoomCategoryRepository categoryRepository;

    private static final Map<Integer, BigDecimal> DEFAULT_PRICES = Map.of(
            1, BigDecimal.valueOf(85),
            2, BigDecimal.valueOf(115),
            3, BigDecimal.valueOf(165),
            4, BigDecimal.valueOf(130),
            5, BigDecimal.valueOf(260),
            6, BigDecimal.valueOf(105)
    );

    private final JdbcTemplate jdbc;

    public RoomMapService(RoomRepository roomRepository, RoomCategoryRepository categoryRepository, JdbcTemplate jdbc) {
        this.roomRepository = roomRepository;
        this.categoryRepository = categoryRepository;
        this.jdbc = jdbc;
    }

    @Transactional(readOnly = true)
    public List<InteractiveRoomView> listRooms(Integer floor, String status, Integer categoryId, boolean isStaff) {
        Map<Integer, RoomCategory> categories = categoryRepository.findAll().stream()
                .collect(Collectors.toMap(RoomCategory::getId, Function.identity(), (a, b) -> a));

        List<Room> rooms = roomRepository.findAll();
        return rooms.stream()
                .filter(Room::isActive)
                .filter(r -> floor == null || (r.getFloor() != null && r.getFloor().equals(floor)))
                .filter(r -> status == null || status.isBlank() || status.equalsIgnoreCase("ALL") || r.getStatus().equalsIgnoreCase(status))
                .filter(r -> categoryId == null || r.getCategoryId().equals(categoryId))
                .sorted((a, b) -> {
                    int c = Integer.compare(a.getFloor() != null ? a.getFloor() : 0, b.getFloor() != null ? b.getFloor() : 0);
                    return c != 0 ? c : a.getRoomNumber().compareTo(b.getRoomNumber());
                })
                .map(r -> toView(r, categories.get(r.getCategoryId()), isStaff))
                .collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public InteractiveRoomView getRoom(int id, boolean isStaff) {
        Room r = roomRepository.findById(id)
                .orElseThrow(() -> ApiException.notFound("Номер #" + id + " не найден"));
        RoomCategory cat = categoryRepository.findById(r.getCategoryId()).orElse(null);
        return toView(r, cat, isStaff);
    }

    @Transactional
    public InteractiveRoomView updateStatus(int id, UpdateRoomStatusRequest req, boolean isStaff) {
        Room r = roomRepository.findById(id)
                .orElseThrow(() -> ApiException.notFound("Номер #" + id + " не найден"));

        r.setStatus(req.status().toUpperCase().trim());
        if (req.notes() != null) {
            r.setNotes(req.notes().trim());
        } else if ("VACANT".equalsIgnoreCase(req.status())) {
            r.setNotes(null);
        }

        Room saved = roomRepository.save(r);
        RoomCategory cat = categoryRepository.findById(saved.getCategoryId()).orElse(null);
        InteractiveRoomView view = toView(saved, cat, isStaff);

        // If extra guest info is supplied by staff and room is not vacant
        if (isStaff && !"VACANT".equalsIgnoreCase(req.status())) {
            return new InteractiveRoomView(
                    view.id(),
                    view.roomNumber(),
                    view.categoryId(),
                    view.categoryName(),
                    view.floor(),
                    view.building(),
                    view.capacity(),
                    view.status(),
                    view.pricePerDay(),
                    view.windowView(),
                    view.amenities(),
                    req.guestName() != null ? req.guestName() : view.currentGuestName(),
                    req.voucherCode() != null ? req.voucherCode() : view.voucherCode(),
                    req.checkInDate() != null ? req.checkInDate() : view.checkInDate(),
                    req.checkOutDate() != null ? req.checkOutDate() : view.checkOutDate(),
                    req.notes() != null ? req.notes() : view.notes()
            );
        }
        return view;
    }

    @Transactional(readOnly = true)
    public RoomMapStats getStats() {
        List<Room> activeRooms = roomRepository.findAll().stream().filter(Room::isActive).toList();
        int total = activeRooms.size();
        int vacant = (int) activeRooms.stream().filter(r -> "VACANT".equalsIgnoreCase(r.getStatus())).count();
        int occupied = (int) activeRooms.stream().filter(r -> "OCCUPIED".equalsIgnoreCase(r.getStatus())).count();
        int cleaning = (int) activeRooms.stream().filter(r -> "CLEANING".equalsIgnoreCase(r.getStatus())).count();
        int reserved = (int) activeRooms.stream().filter(r -> "RESERVED".equalsIgnoreCase(r.getStatus())).count();

        double occPct = total > 0 ? Math.round((occupied * 100.0 / total) * 10.0) / 10.0 : 0.0;
        return new RoomMapStats(total, vacant, occupied, cleaning, reserved, occPct);
    }

    private InteractiveRoomView toView(Room r, RoomCategory cat, boolean isStaff) {
        String catName = cat != null ? cat.getName() : "Категория #" + r.getCategoryId();
        int cap = cat != null ? cat.getCapacityTotal() : 2;
        BigDecimal price = DEFAULT_PRICES.getOrDefault(r.getCategoryId(), BigDecimal.valueOf(120));

        List<String> amenitiesList = new ArrayList<>();
        if (r.getAmenities() != null && !r.getAmenities().isBlank()) {
            amenitiesList = Arrays.stream(r.getAmenities().split(","))
                    .map(String::trim)
                    .filter(s -> !s.isBlank())
                    .collect(Collectors.toList());
        }

        String guestName = null;
        String voucherCode = null;
        String checkIn = null;
        String checkOut = null;

        if (isStaff && "OCCUPIED".equalsIgnoreCase(r.getStatus())) {
            guestName = r.getNotes() != null && r.getNotes().contains("Гость:") 
                    ? r.getNotes().replace("Гость:", "").trim() 
                    : "Проживающий гость";
            voucherCode = "V-2026-" + (r.getId() + 100);
            checkIn = "2026-10-20";
            checkOut = "2026-11-05";
            // реальное проживание из броней: текущая путёвка в статусе CHECKED_IN
            List<String[]> stay = jdbc.query("""
                    SELECT v.id, c.last_name || ' ' || c.first_name, b.check_in, b.check_out
                      FROM bookings b JOIN vouchers v ON v.id = b.voucher_id JOIN clients c ON c.id = v.client_id
                     WHERE b.room_id = ? AND b.status = 'CHECKED_IN' AND b.check_in <= CURRENT_DATE AND b.check_out > CURRENT_DATE
                     ORDER BY b.check_in DESC LIMIT 1
                    """, (rs, n) -> new String[]{rs.getString(1), rs.getString(2), rs.getString(3), rs.getString(4)}, r.getId());
            if (!stay.isEmpty()) {
                guestName = stay.get(0)[1];
                voucherCode = "№" + stay.get(0)[0];
                checkIn = stay.get(0)[2];
                checkOut = stay.get(0)[3];
            }
        }

        return new InteractiveRoomView(
                r.getId(),
                r.getRoomNumber(),
                r.getCategoryId(),
                catName,
                r.getFloor() != null ? r.getFloor() : 1,
                r.getBuilding() != null ? r.getBuilding() : "Главный спальный корпус",
                cap,
                r.getStatus() != null ? r.getStatus() : "VACANT",
                price,
                r.getWindowView() != null ? r.getWindowView() : "Парковая аллея",
                amenitiesList,
                guestName,
                voucherCode,
                checkIn,
                checkOut,
                r.getNotes()
        );
    }
}
