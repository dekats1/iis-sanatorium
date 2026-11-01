package sanatorium.core.demo;

import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.junit.jupiter.api.Test;
import sanatorium.core.demo.DemoDataset.BookingRow;
import sanatorium.core.demo.DemoDataset.PlaceRow;
import sanatorium.core.demo.DemoDataset.SlotRow;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

/** Проверяет инварианты демо-данных без БД: размещение без пересечений, расписание без коллизий, согласованные суммы. */
class DemoGeneratorTest {

    private static final ZoneId ZONE = ZoneId.of("Europe/Minsk");
    private static final LocalDate TODAY = LocalDate.of(2026, 11, 1);
    private static final OffsetDateTime NOW = TODAY.atTime(11, 30).atZone(ZONE).toOffsetDateTime();

    private static Map<String, Long> ids(List<String> names, long start) {
        Map<String, Long> m = new HashMap<>();
        long id = start;
        for (String n : names) {
            m.put(n, id++);
        }
        return m;
    }

    static DemoGenerator.Refs refs() {
        Map<String, Long> users = new HashMap<>();
        long u = 1;
        for (String n : List.of("admin", "doctor", "manager", "sysadmin", "client", "doctor2", "doctor3")) {
            users.put(n, u++);
        }
        List<String> procedures = new ArrayList<>();
        DemoCatalog.PROCEDURES.forEach(p -> procedures.add(p.name()));
        List<String> rooms = new ArrayList<>();
        DemoCatalog.ROOMS.forEach(r -> rooms.add(r.number()));
        List<String> cabinets = new ArrayList<>();
        DemoCatalog.CABINETS.forEach(c -> cabinets.add(c.name()));
        return new DemoGenerator.Refs(
                ids(DemoCatalog.CATEGORIES.stream().map(DemoCatalog.Category::name).toList(), 1),
                ids(DemoCatalog.PROFILES.stream().map(DemoCatalog.Profile::code).toList(), 1),
                ids(DemoCatalog.CONDITIONS.stream().map(DemoCatalog.Condition::code).toList(), 1),
                ids(DemoCatalog.DIETS.stream().map(DemoCatalog.Diet::code).toList(), 1),
                ids(DemoCatalog.CHANNELS.stream().map(DemoCatalog.Channel::name).toList(), 1),
                ids(cabinets, 1), ids(procedures, 1), ids(rooms, 1), List.of(1L, 2L, 3L, 4L), users, 1L);
    }

    static DemoDataset generate() {
        DemoGenerator.Bases bases = new DemoGenerator.Bases(1, 0, 0, 0, 0, 0);
        return new DemoGenerator(refs(), bases, DemoGenerator.Config.of(TODAY, NOW, ZONE)).generate();
    }

    @Test
    void generationIsDeterministic() {
        DemoDataset a = generate();
        DemoDataset b = generate();
        assertEquals(a.vouchers, b.vouchers);
        assertEquals(a.slots, b.slots);
        assertEquals(a.reviews, b.reviews);
    }

    @Test
    void volumesMatchDemoScenario() {
        DemoDataset d = generate();
        assertEquals(90, DemoCatalog.ROOMS.size());
        assertEquals(6, DemoCatalog.CATEGORIES.size());
        assertTrue(DemoCatalog.PROCEDURES.size() >= 35, "процедур " + DemoCatalog.PROCEDURES.size());
        assertTrue(d.clients.size() >= 120 && d.clients.size() <= 180, "клиентов " + d.clients.size());
        assertTrue(d.vouchers.size() >= 400, "путёвок " + d.vouchers.size());
        assertTrue(d.reviews.size() > 50 && d.audit.size() > 100 && d.notifications.size() > 15 && d.waitlist.size() >= 20);
        Set<String> statuses = new HashSet<>();
        d.vouchers.forEach(v -> statuses.add(v.status()));
        assertTrue(statuses.containsAll(Set.of("CONFIRMED", "CHECKED_IN", "COMPLETED", "CANCELLED", "EXPIRED", "AWAITING_PAYMENT")),
                "статусы " + statuses);
    }

    @Test
    void activePlacesNeverOverlap() {
        DemoDataset d = generate();
        Map<String, List<PlaceRow>> byPlace = new HashMap<>();
        Map<Long, Integer> capacity = new HashMap<>();
        for (int i = 0; i < DemoCatalog.ROOMS.size(); i++) {
            capacity.put((long) (i + 1), DemoCatalog.CATEGORIES.get(DemoCatalog.ROOMS.get(i).category()).capacity());
        }
        for (PlaceRow p : d.places) {
            assertTrue(p.to().isAfter(p.from()));
            assertTrue(p.placeNo() >= 1 && p.placeNo() <= capacity.get(p.roomId()), "место сверх вместимости");
            if (p.active()) {
                byPlace.computeIfAbsent(p.roomId() + "/" + p.placeNo(), k -> new ArrayList<>()).add(p);
            }
        }
        for (List<PlaceRow> list : byPlace.values()) {
            for (int i = 0; i < list.size(); i++) {
                for (int j = i + 1; j < list.size(); j++) {
                    PlaceRow a = list.get(i);
                    PlaceRow b = list.get(j);
                    assertTrue(!a.from().isBefore(b.to()) || !b.from().isBefore(a.to()), "пересечение " + a + " и " + b);
                }
            }
        }
        Map<Long, BookingRow> bookings = new HashMap<>();
        d.bookings.forEach(b -> bookings.put(b.id(), b));
        for (PlaceRow p : d.places) {
            BookingRow b = bookings.get(p.bookingId());
            assertEquals(b.roomId(), p.roomId());
            assertEquals(b.checkIn(), p.from());
            assertEquals(b.checkOut(), p.to());
        }
    }

    @Test
    void scheduleHasNoCabinetOrGuestCollisions() {
        DemoGenerator.Refs refs = refs();
        DemoDataset d = generate();
        Map<Long, Integer> slotsPerDay = new HashMap<>();
        for (DemoCatalog.Cabinet c : DemoCatalog.CABINETS) {
            slotsPerDay.put(refs.cabinets().get(c.name()), c.slotsPerDay());
        }
        Map<Long, Long> voucherOfAssignment = new HashMap<>();
        d.assignments.forEach(a -> voucherOfAssignment.put(a.id(), a.voucherId()));
        Set<String> cabinetSlots = new HashSet<>();
        Map<String, List<long[]>> guestIntervals = new HashMap<>();
        long today = 0;
        for (SlotRow s : d.slots) {
            String key = s.cabinetId() + "@" + s.slotDt();
            assertTrue(cabinetSlots.add(key), "кабинет занят дважды: " + key);
            long len = 480 / slotsPerDay.get(s.cabinetId());
            long start = s.slotDt().toInstant().getEpochSecond() / 60;
            String g = voucherOfAssignment.get(s.assignmentId()) + "";
            List<long[]> list = guestIntervals.computeIfAbsent(g, k -> new ArrayList<>());
            for (long[] iv : list) {
                assertTrue(start >= iv[1] || iv[0] >= start + len, "гость занят одновременно: путёвка " + g);
            }
            list.add(new long[]{start, start + len});
            if (s.slotDt().atZoneSameInstant(ZONE).toLocalDate().equals(TODAY)) {
                today++;
            }
        }
        assertTrue(today > 10, "на сегодня сеансов " + today);
    }

    @Test
    void paymentsAndLoyaltyAreConsistent() {
        DemoDataset d = generate();
        Map<Long, java.math.BigDecimal> total = new HashMap<>();
        d.vouchers.forEach(v -> total.put(v.id(), v.total()));
        Map<Long, java.math.BigDecimal> paid = new HashMap<>();
        for (DemoDataset.PaymentRow p : d.payments) {
            assertTrue(p.amount().signum() > 0);
            if ("PREPAY".equals(p.kind()) && "SUCCESS".equals(p.status())) {
                paid.merge(p.voucherId(), p.amount(), java.math.BigDecimal::add);
            }
        }
        paid.forEach((id, sum) -> assertTrue(sum.compareTo(total.get(id)) <= 0, "переплата по путёвке " + id));
        for (DemoDataset.PaymentRow p : d.payments) {
            if ("REFUND".equals(p.kind())) {
                assertTrue(paid.containsKey(p.voucherId()) && p.amount().compareTo(paid.get(p.voucherId())) <= 0);
            }
        }
        Map<Long, Integer> balance = new HashMap<>();
        d.bonuses.forEach(b -> balance.merge(b.clientId(), b.amount(), Integer::sum));
        for (DemoDataset.LoyaltyRow l : d.loyalty) {
            assertEquals(l.balance(), balance.get(l.clientId()).intValue());
            assertTrue(l.balance() >= 0);
        }
    }
}
