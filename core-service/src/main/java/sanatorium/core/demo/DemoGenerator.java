package sanatorium.core.demo;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.time.ZoneId;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Random;
import java.util.Set;
import sanatorium.core.booking.CancellationCalculator;
import sanatorium.core.booking.FreePlace;
import sanatorium.core.booking.Placement;
import sanatorium.core.booking.RoomPlacement;
import sanatorium.core.common.Money;
import sanatorium.core.demo.DemoCatalog.Procedure;
import sanatorium.core.demo.DemoDataset.*;
import sanatorium.core.demo.DemoNames.Person;
import sanatorium.core.medical.SlotPlanner;

/**
 * Детерминированный (фиксированный seed) генератор демо-данных. Чистый класс: не обращается к БД и Spring, поэтому
 * проверяется обычным модульным тестом. Все даты считаются от «сегодня» ({@link Config#today()}).
 *
 * <p>Модель: целевая загрузка по датам (сезонность лето / Новый год / майские, тренд роста) превращается в поток заездов
 * по категориям; каждый заезд размещается тем же алгоритмом {@link RoomPlacement}, что и в бою, поэтому пересечений по
 * койко-местам нет (как и в БД, ограничение bp_no_overlap). Для будущих дат принимается лишь доля заездов, уже
 * забронированных «на сегодня» (чем дальше дата, тем меньше), кроме новогодних. Расписание процедур строится реальным
 * {@link SlotPlanner}: два сеанса не занимают один слот кабинета и не пересекаются у одного гостя.
 */
public final class DemoGenerator {

    /** Идентификаторы справочников, уже вставленных в БД (по естественным ключам). */
    public record Refs(Map<String, Long> categories, Map<String, Long> profiles, Map<String, Long> conditions,
                       Map<String, Long> diets, Map<String, Long> channels, Map<String, Long> cabinets,
                       Map<String, Long> procedures, Map<String, Long> rooms, List<Long> customers,
                       Map<String, Long> users, long ivanovClientId) { }

    /** Последний занятый id в таблицах (новые строки получают base+1, base+2, ...). */
    public record Bases(long client, long voucher, long booking, long payment, long assignment, long review) { }

    public record Config(LocalDate today, OffsetDateTime now, ZoneId zone, int dayStartMinute, int dayMinutes,
                         int clientCount, long seed, double volume) {
        public static Config of(LocalDate today, OffsetDateTime now, ZoneId zone) {
            return new Config(today, now, zone, 8 * 60, 480, 170, 20261101L, 0.75);
        }
    }

    // ---- сезонность и цены (зеркалируются в pricing-forecast/cli.py) ----

    /** Сезонный коэффициент цены на дату; границы совпадают с season_periods в cli seed. */
    public static double seasonK(LocalDate d) {
        int m = d.getMonthValue();
        int day = d.getDayOfMonth();
        if ((m == 12 && day >= 25) || (m == 1 && day <= 10)) {
            return 1.30;
        }
        if (m == 1 || m == 2 || m == 3) {
            return 0.85;
        }
        if (m == 4) {
            return 1.00;
        }
        if (m == 5) {
            return day <= 11 ? 1.10 : 1.00;
        }
        if (m >= 6 && m <= 8) {
            return 1.35;
        }
        if (m == 9) {
            return 1.05;
        }
        if (m == 10) {
            return 0.95;
        }
        return 0.85; // 1 ноября - 24 декабря
    }

    private static final double[] MONTH_OCC = {0, 0.40, 0.38, 0.46, 0.50, 0.60, 0.72, 0.85, 0.88, 0.66, 0.48, 0.36, 0.43};

    static boolean newYear(LocalDate d) {
        return (d.getMonthValue() == 12 && d.getDayOfMonth() >= 24) || (d.getMonthValue() == 1 && d.getDayOfMonth() <= 9);
    }

    /** Целевая загрузка (0..1) на дату до учёта тренда: месячная кривая + праздничные пики. */
    static double baseOccupancy(LocalDate d) {
        double o = MONTH_OCC[d.getMonthValue()];
        if (newYear(d)) {
            o = 0.93;
        } else if (d.getMonthValue() == 5 && d.getDayOfMonth() <= 11) {
            o = Math.max(o, 0.74);
        } else if (d.getMonthValue() == 3 && d.getDayOfMonth() >= 5 && d.getDayOfMonth() <= 9) {
            o = Math.max(o, 0.62);
        }
        return o;
    }

    private static final double[] CAT_AFFINITY_BASE = {1.0, 1.0, 0.85, 0.7, 0.45, 0.9};

    static double categoryAffinity(int cat, double baseOcc) {
        boolean peak = baseOcc >= 0.7;
        if (cat == 3) {
            return peak ? 1.15 : 0.7;
        }
        if (cat == 4) {
            return peak ? 0.85 : 0.45;
        }
        return CAT_AFFINITY_BASE[cat];
    }

    /** Цена места за сутки как в pricing-forecast: тариф * сезон * поправка на загрузку, в коридоре [0.8; 1.6] тарифа. */
    static BigDecimal nightPrice(int cat, LocalDate night, double occFraction) {
        double base = DemoCatalog.CATEGORIES.get(cat).basePrice();
        double adj = 0.90 + Math.max(0, Math.min(100, occFraction * 100)) * 0.003;
        double v = base * seasonK(night) * adj;
        v = Math.max(base * 0.8, Math.min(base * 1.6, v));
        return Money.round(BigDecimal.valueOf(v));
    }

    /** Ожидаемая цена места за сутки (по типичной загрузке даты); те же значения идут в price_snapshot. */
    public static BigDecimal expectedPrice(int cat, LocalDate night) {
        double base = baseOccupancy(night);
        return nightPrice(cat, night, Math.min(0.99, base * categoryAffinity(cat, base) * 1.2));
    }

    // ---- состояние ----

    private final Refs refs;
    private final Bases bases;
    private final Config cfg;
    private final Random rng;
    private final DemoDataset out = new DemoDataset();

    private final LocalDate simStart;
    private final LocalDate simEnd;
    private final int[] roomCategory;
    private final String[] roomNumber;
    private final List<List<Integer>> roomsOfCategory = new ArrayList<>();
    private final boolean[][][] busy; // [номер][место][сутки от simStart]

    private final List<ClientInfo> clientInfos = new ArrayList<>();
    private final List<Stay> stays = new ArrayList<>();
    private final List<int[]> failedFuture = new ArrayList<>(); // {категория, смещение заезда от today, ночей, мест}

    private long nextVoucher;
    private long nextBooking;
    private long nextPayment;
    private long nextInvoice = 810000;

    private static final class ClientInfo {
        long id;
        Person person;
        LocalDate birth;
        List<String> conditions = new ArrayList<>();
        String profile;
        final List<LocalDate[]> activeStays = new ArrayList<>();
    }

    private static final class Stay {
        int cat;
        int room;
        List<Integer> placeNos;
        LocalDate ci;
        LocalDate co;
        int places;
        String status;
        ClientInfo client;
        long voucherId;
        long bookingId;
        OffsetDateTime createdAt;
        BigDecimal perDay;
        BigDecimal total;
        long profileId;
        String profileCode;
        long assignmentId;

        int nights() {
            return (int) ChronoUnit.DAYS.between(ci, co);
        }

        boolean active() {
            return !"CANCELLED".equals(status) && !"EXPIRED".equals(status);
        }
    }

    public DemoGenerator(Refs refs, Bases bases, Config cfg) {
        this.refs = refs;
        this.bases = bases;
        this.cfg = cfg;
        this.rng = new Random(cfg.seed());
        this.simStart = cfg.today().minusMonths(18).minusDays(14);
        this.simEnd = cfg.today().plusDays(92);
        int n = DemoCatalog.ROOMS.size();
        roomCategory = new int[n];
        roomNumber = new String[n];
        for (int c = 0; c < DemoCatalog.CATEGORIES.size(); c++) {
            roomsOfCategory.add(new ArrayList<>());
        }
        for (int i = 0; i < n; i++) {
            DemoCatalog.RoomSpec r = DemoCatalog.ROOMS.get(i);
            roomCategory[i] = r.category();
            roomNumber[i] = r.number();
            roomsOfCategory.get(r.category()).add(i);
        }
        int days = (int) ChronoUnit.DAYS.between(simStart, simEnd) + 60;
        busy = new boolean[n][4][days];
        nextVoucher = bases.voucher();
        nextBooking = bases.booking();
        nextPayment = bases.payment();
    }

    public DemoDataset generate() {
        createClients();
        placePersonaStays();
        runArrivals();
        stays.sort(Comparator.comparing((Stay s) -> s.ci).thenComparing(s -> s.createdAt));
        for (Stay s : stays) {
            emitVoucher(s);
        }
        buildTreatment();
        buildLoyalty();
        buildReviews();
        buildWaitlist();
        buildRoomStates();
        buildNotifications();
        buildAudit();
        return out;
    }

    // ---- клиенты ----

    private void createClients() {
        for (int i = 0; i < cfg.clientCount(); i++) {
            ClientInfo c = new ClientInfo();
            boolean persona = i == 0;
            c.id = persona ? refs.ivanovClientId() : bases.client() + i;
            boolean female = rng.nextInt(100) < 58;
            c.person = persona ? new Person("Иванов", "Иван", "Петрович", false) : DemoNames.person(rng, female);
            int age = persona ? 0 : 28 + (int) Math.min(54, Math.abs(rng.nextGaussian()) * 14 + 14 + rng.nextInt(10));
            c.birth = persona ? LocalDate.of(1975, 3, 14)
                    : cfg.today().minusYears(age).minusDays(rng.nextInt(365));
            if (persona) {
                c.conditions.add("HYPERTENSION");
            } else {
                assignConditions(c, age);
            }
            c.profile = primaryProfile(c);
            String citizenship = rng.nextInt(100) < 87 ? "Республика Беларусь" : rng.nextInt(10) < 7 ? "Российская Федерация" : "Республика Казахстан";
            out.clients.add(new ClientRow(c.id, c.person.last(), c.person.first(), c.person.middle(), c.birth,
                    DemoNames.phone(rng), DemoNames.email(c.person, rng), citizenship));
            for (String code : c.conditions) {
                LocalDate diagnosed = cfg.today().minusYears(1 + rng.nextInt(12)).minusDays(rng.nextInt(300));
                out.clientConditions.add(new ClientConditionRow(c.id, code, diagnosed));
            }
            clientInfos.add(c);
        }
    }

    private static final String[] COND_CODES = {"HYPERTENSION", "DIABETES", "ARRHYTHMIA", "HEART_FAIL", "THROMBO", "ASTHMA", "EPILEPSY",
            "GLAUCOMA", "ULCER_ACUTE", "KIDNEY_STONES", "THYROID", "SKIN_ACUTE", "ONCOLOGY", "PREGNANCY"};
    private static final int[] COND_WEIGHT = {24, 11, 7, 2, 4, 3, 1, 3, 3, 3, 3, 1, 1, 1};

    private void assignConditions(ClientInfo c, int age) {
        int r = rng.nextInt(100);
        int count = r < 36 ? 0 : r < 70 ? 1 : r < 90 ? 2 : 3;
        if (age > 60 && count == 0 && rng.nextBoolean()) {
            count = 1;
        }
        int total = 0;
        for (int w : COND_WEIGHT) {
            total += w;
        }
        for (int k = 0; k < count; k++) {
            int x = rng.nextInt(total);
            int idx = 0;
            while (x >= COND_WEIGHT[idx]) {
                x -= COND_WEIGHT[idx];
                idx++;
            }
            String code = COND_CODES[idx];
            if ("PREGNANCY".equals(code) && (!c.person.female() || age > 42)) {
                continue;
            }
            if (!c.conditions.contains(code)) {
                c.conditions.add(code);
            }
        }
    }

    private String primaryProfile(ClientInfo c) {
        for (String code : c.conditions) {
            switch (code) {
                case "HYPERTENSION": case "ARRHYTHMIA": case "HEART_FAIL": case "THROMBO": return "CARDIO";
                case "ASTHMA": return "RESP";
                case "DIABETES": case "THYROID": return "ENDO";
                case "ULCER_ACUTE": case "KIDNEY_STONES": return "GIT";
                case "EPILEPSY": return "NERV";
                default: break;
            }
        }
        return randomProfile();
    }

    private String randomProfile() {
        String[] codes = {"WELL", "MSK", "NERV", "CARDIO", "RESP", "GIT", "ENDO", "REHAB"};
        int[] w = {24, 20, 15, 15, 11, 7, 5, 3};
        int x = rng.nextInt(100);
        for (int i = 0; i < codes.length; i++) {
            if (x < w[i]) {
                return codes[i];
            }
            x -= w[i];
        }
        return "WELL";
    }

    // ---- размещение заездов ----

    private static final int[] NIGHTS = {3, 5, 7, 10, 10, 12, 14, 14, 14, 14, 14, 18, 21, 21, 24, 28};
    private static final double AVG_NIGHTS = 14.3;

    private int dayIndex(LocalDate d) {
        return (int) ChronoUnit.DAYS.between(simStart, d);
    }

    private double trend(LocalDate d) {
        double span = ChronoUnit.DAYS.between(simStart, cfg.today().minusDays(30));
        double t = Math.min(1.0, Math.max(0.0, ChronoUnit.DAYS.between(simStart, d) / span));
        return 0.35 + 0.65 * t;
    }

    private double categoryOccupancy(int cat, LocalDate d) {
        double base = baseOccupancy(d);
        double o = base * trend(d) * categoryAffinity(cat, base) * cfg.volume() * (newYear(d) ? 1.5 : 1.0);
        return Math.max(0.02, Math.min(0.95, o));
    }

    private static double weekdayFactor(LocalDate d) {
        double[] f = {0.9, 0.8, 0.8, 0.9, 1.3, 1.7, 1.0};
        return f[d.getDayOfWeek().getValue() - 1] / 1.057;
    }

    private double bookedShare(LocalDate ci) {
        long ahead = ChronoUnit.DAYS.between(cfg.today(), ci);
        if (newYear(ci) || (ci.getMonthValue() == 12 && ci.getDayOfMonth() >= 18)) {
            return Math.max(0.35, 0.8 - 0.004 * ahead);
        }
        return Math.exp(-ahead / 38.0) * 0.95;
    }

    private int drawNights() {
        return NIGHTS[rng.nextInt(NIGHTS.length)];
    }

    private int drawPlaces(int cat) {
        int cap = DemoCatalog.CATEGORIES.get(cat).capacity();
        int x = rng.nextInt(100);
        if (cap == 2) {
            return x < 25 ? 1 : 2;
        }
        if (cap == 3) {
            return x < 15 ? 1 : x < 60 ? 2 : 3;
        }
        return x < 20 ? 2 : x < 50 ? 3 : 4;
    }

    private void runArrivals() {
        int cats = DemoCatalog.CATEGORIES.size();
        double[] carry = new double[cats];
        int[] capPlaces = new int[cats];
        for (int c = 0; c < cats; c++) {
            capPlaces[c] = roomsOfCategory.get(c).size() * DemoCatalog.CATEGORIES.get(c).capacity();
        }
        for (LocalDate d = simStart; !d.isAfter(simEnd); d = d.plusDays(1)) {
            boolean future = d.isAfter(cfg.today());
            for (int c = 0; c < cats; c++) {
                double lambda = categoryOccupancy(c, d) * capPlaces[c] / AVG_NIGHTS * weekdayFactor(d) * (0.8 + 0.4 * rng.nextDouble());
                carry[c] += lambda;
                while (carry[c] > 0) {
                    int places = drawPlaces(c);
                    int nights = drawNights();
                    carry[c] -= places;
                    if (future && rng.nextDouble() > bookedShare(d)) {
                        continue;
                    }
                    place(c, d, d.plusDays(nights), places, null, null);
                }
            }
        }
    }

    /** Заезды персонажа «client» (Иванов): прошлые курсы, текущее проживание, будущий и отменённый. */
    private void placePersonaStays() {
        ClientInfo iv = clientInfos.get(0);
        LocalDate t = cfg.today();
        place(1, t.minusDays(400), t.minusDays(388), 1, "COMPLETED", iv);
        place(0, t.minusDays(262), t.minusDays(248), 1, "COMPLETED", iv);
        place(1, t.minusDays(121), t.minusDays(111), 1, "COMPLETED", iv);
        place(1, t.minusDays(5), t.plusDays(9), 1, "CHECKED_IN", iv);
        place(2, t.plusDays(60), t.plusDays(70), 2, "CONFIRMED", iv);
        place(0, t.plusDays(75), t.plusDays(82), 1, "CANCELLED", iv);
    }

    private String drawStatus(LocalDate ci, LocalDate co) {
        LocalDate today = cfg.today();
        int x = rng.nextInt(100);
        if (!co.isAfter(today)) {
            return x < 85 ? "COMPLETED" : x < 95 ? "CANCELLED" : "EXPIRED";
        }
        if (!ci.isAfter(today)) {
            if (ci.equals(today)) {
                return x < 65 ? "CHECKED_IN" : "CONFIRMED";
            }
            return "CHECKED_IN";
        }
        return x < 76 ? "CONFIRMED" : x < 88 ? "AWAITING_PAYMENT" : x < 95 ? "CANCELLED" : "EXPIRED";
    }

    private List<FreePlace> freePlaces(int cat, LocalDate ci, LocalDate co) {
        int from = dayIndex(ci);
        int to = dayIndex(co);
        List<FreePlace> free = new ArrayList<>();
        for (int room : roomsOfCategory.get(cat)) {
            for (int p = 0; p < DemoCatalog.CATEGORIES.get(cat).capacity(); p++) {
                boolean ok = true;
                for (int day = from; day < to && ok; day++) {
                    ok = !busy[room][p][day];
                }
                if (ok) {
                    free.add(new FreePlace(room, p + 1));
                }
            }
        }
        return free;
    }

    private void place(int cat, LocalDate ci, LocalDate co, int places, String forcedStatus, ClientInfo forcedClient) {
        String status = forcedStatus != null ? forcedStatus : drawStatus(ci, co);
        Optional<Placement> pl = RoomPlacement.choose(freePlaces(cat, ci, co), places);
        if (pl.isEmpty()) {
            if (ci.isAfter(cfg.today()) && failedFuture.size() < 400) {
                failedFuture.add(new int[]{cat, (int) ChronoUnit.DAYS.between(cfg.today(), ci), (int) ChronoUnit.DAYS.between(ci, co), places});
            }
            return;
        }
        Stay s = new Stay();
        s.cat = cat;
        s.ci = ci;
        s.co = co;
        s.places = places;
        s.status = status;
        s.room = pl.get().roomId();
        s.placeNos = pl.get().placeNos();
        s.client = forcedClient != null ? forcedClient : chooseClient(s);
        if (s.client == null) {
            return;
        }
        s.profileCode = rng.nextInt(100) < 75 ? s.client.profile : randomProfile();
        s.profileId = refs.profiles().get(s.profileCode);
        if (s.active()) {
            s.client.activeStays.add(new LocalDate[]{ci, co});
            int from = dayIndex(ci);
            int to = dayIndex(co);
            for (int p : s.placeNos) {
                for (int day = from; day < to; day++) {
                    busy[s.room][p - 1][day] = true;
                }
            }
        }
        s.createdAt = createdAt(s);
        price(s);
        stays.add(s);
    }

    private ClientInfo chooseClient(Stay s) {
        int n = clientInfos.size();
        for (int attempt = 0; attempt < 8; attempt++) {
            // Парето-подобные веса: часть гостей приезжает чаще (постоянные клиенты)
            int i = 1 + (int) Math.min(n - 2, Math.floor((n - 1) * Math.pow(rng.nextDouble(), 1.6)));
            ClientInfo c = clientInfos.get(i);
            if (!s.active() || !overlaps(c, s.ci, s.co)) {
                return c;
            }
        }
        return null;
    }

    private static boolean overlaps(ClientInfo c, LocalDate ci, LocalDate co) {
        for (LocalDate[] r : c.activeStays) {
            if (ci.isBefore(r[1]) && r[0].isBefore(co)) {
                return true;
            }
        }
        return false;
    }

    private OffsetDateTime at(LocalDate d, int hour, int minute) {
        return d.atTime(hour, minute).atZone(cfg.zone()).toOffsetDateTime();
    }

    private OffsetDateTime min(OffsetDateTime a, OffsetDateTime b) {
        return a.isBefore(b) ? a : b;
    }

    private OffsetDateTime createdAt(Stay s) {
        OffsetDateTime now = cfg.now();
        if (s.ci.isAfter(cfg.today())) {
            if ("AWAITING_PAYMENT".equals(s.status)) {
                return now.minusMinutes(60 + rng.nextInt(19 * 60));
            }
            if ("EXPIRED".equals(s.status)) {
                return now.minusMinutes(26 * 60 + rng.nextInt(13 * 24 * 60));
            }
            return now.minusMinutes(120 + rng.nextInt(40 * 24 * 60));
        }
        int lead = 1 + (int) Math.min(150, -Math.log(1 - rng.nextDouble()) * 24);
        OffsetDateTime c = at(s.ci.minusDays(lead), 8 + rng.nextInt(13), rng.nextInt(60));
        return min(c, now.minusMinutes(180));
    }

    private void price(Stay s) {
        BigDecimal perPlace = BigDecimal.ZERO;
        int n = s.nights();
        for (int i = 0; i < n; i++) {
            LocalDate night = s.ci.plusDays(i);
            perPlace = perPlace.add(expectedPrice(s.cat, night));
        }
        s.total = Money.round(perPlace.multiply(BigDecimal.valueOf(s.places)));
        s.perDay = Money.round(perPlace.divide(BigDecimal.valueOf(n), 10, RoundingMode.HALF_UP));
    }

    // ---- путёвки, брони, платежи ----

    private static final double[] CH_W = {20, 14, 27, 12, 10, 9, 8};

    private int drawChannelIndex() {
        double total = 0;
        for (double w : CH_W) {
            total += w;
        }
        double x = rng.nextDouble() * total;
        for (int i = 0; i < CH_W.length; i++) {
            if (x < CH_W[i]) {
                return i;
            }
            x -= CH_W[i];
        }
        return 0;
    }

    private BigDecimal pct(BigDecimal v, int percent) {
        return Money.percentOf(v, percent);
    }

    private long invoice() {
        return nextInvoice++;
    }

    private void pay(Stay s, String kind, BigDecimal amount, String status, OffsetDateTime when) {
        out.payments.add(new PaymentRow(++nextPayment, s.voucherId, kind, amount, status,
                "PENDING".equals(status) || "SUCCESS".equals(status) || "DECLINED".equals(status) ? invoice() : null, when));
    }

    private void emitVoucher(Stay s) {
        s.voucherId = ++nextVoucher;
        s.bookingId = ++nextBooking;
        int chIdx = s.client.id == refs.ivanovClientId() ? 2 : drawChannelIndex();
        DemoCatalog.Channel channel = DemoCatalog.CHANNELS.get(chIdx);
        Long customer = null;
        if ((channel.name().startsWith("Корпоратив") || channel.name().equals("Туроператор")) && !refs.customers().isEmpty()) {
            customer = refs.customers().get(rng.nextInt(refs.customers().size()));
        }
        Long diet = dietFor(s);
        long createdBy = s.client.id == refs.ivanovClientId() ? refs.users().get("client") : refs.users().get("admin");
        OffsetDateTime deadline = s.createdAt.plusHours(24);
        out.vouchers.add(new VoucherRow(s.voucherId, s.client.id, customer, refs.channels().get(channel.name()), s.profileId, diet,
                createdBy, s.status, s.perDay, s.total, deadline, s.createdAt));
        String bookingStatus;
        switch (s.status) {
            case "CHECKED_IN": bookingStatus = "CHECKED_IN"; break;
            case "COMPLETED": bookingStatus = "COMPLETED"; break;
            case "CONFIRMED": bookingStatus = "CONFIRMED"; break;
            case "AWAITING_PAYMENT": bookingStatus = "ACTIVE"; break;
            default: bookingStatus = "CANCELLED"; break;
        }
        long roomId = refs.rooms().get(roomNumber[s.room]);
        out.bookings.add(new BookingRow(s.bookingId, s.voucherId, roomId, s.ci, s.co, s.places, bookingStatus));
        for (int p : s.placeNos) {
            out.places.add(new PlaceRow(s.bookingId, roomId, p, s.ci, s.co, s.active()));
        }
        emitPayments(s);
    }

    private Long dietFor(Stay s) {
        String code;
        if (s.client.conditions.contains("DIABETES")) {
            code = "D9";
        } else if (s.client.conditions.contains("ULCER_ACUTE")) {
            code = "D1";
        } else if (s.client.conditions.contains("KIDNEY_STONES") || "GIT".equals(s.profileCode)) {
            code = "D5";
        } else if ("CARDIO".equals(s.profileCode)) {
            code = "D10";
        } else if ("ENDO".equals(s.profileCode)) {
            code = "D8";
        } else {
            int x = rng.nextInt(100);
            if (x < 8) {
                return null;
            }
            code = x < 14 ? "VEG" : "D15";
        }
        return refs.diets().get(code);
    }

    private void emitPayments(Stay s) {
        OffsetDateTime now = cfg.now();
        BigDecimal prepay = pct(s.total, 30);
        OffsetDateTime payAt = min(s.createdAt.plusMinutes(5 + rng.nextInt(235)), now.minusMinutes(1));
        switch (s.status) {
            case "AWAITING_PAYMENT":
                if (rng.nextInt(100) < 60) {
                    pay(s, "PREPAY", prepay, "PENDING", s.createdAt.plusMinutes(2));
                }
                break;
            case "EXPIRED":
                if (rng.nextInt(100) < 70) {
                    pay(s, "PREPAY", prepay, rng.nextInt(4) == 0 ? "DECLINED" : "PENDING", s.createdAt.plusMinutes(3));
                }
                break;
            case "CANCELLED": {
                boolean paid = rng.nextInt(100) < 75;
                OffsetDateTime horizon = s.ci.isAfter(cfg.today()) ? now : at(s.ci, 9, 0);
                long minutes = Math.max(30, ChronoUnit.MINUTES.between(s.createdAt, horizon));
                OffsetDateTime cancelAt = min(s.createdAt.plusMinutes((long) (minutes * (0.15 + 0.7 * rng.nextDouble()))), now.minusMinutes(1));
                if (paid) {
                    OffsetDateTime paidAt = min(payAt, cancelAt.minusMinutes(1));
                    if (paidAt.isBefore(s.createdAt)) {
                        paidAt = s.createdAt.plusMinutes(1);
                    }
                    pay(s, "PREPAY", prepay, "SUCCESS", paidAt);
                    var res = new CancellationCalculator().calculate(s.ci, cancelAt.atZoneSameInstant(cfg.zone()).toLocalDate(), s.total, prepay);
                    if (res.refund().signum() > 0) {
                        boolean old = cancelAt.isBefore(now.minusDays(3));
                        pay(s, "REFUND", res.refund(), old ? "SUCCESS" : "PENDING", cancelAt);
                    }
                }
                break;
            }
            default: { // CONFIRMED, CHECKED_IN, COMPLETED
                if (rng.nextInt(100) < 6) {
                    pay(s, "PREPAY", prepay, "DECLINED", payAt.minusMinutes(3));
                }
                pay(s, "PREPAY", prepay, "SUCCESS", payAt);
                if ("CHECKED_IN".equals(s.status) || "COMPLETED".equals(s.status)) {
                    OffsetDateTime restAt = min(at(s.ci, 10 + rng.nextInt(4), rng.nextInt(60)), now.minusMinutes(1));
                    if (restAt.isAfter(payAt) && rng.nextInt(100) < 85) {
                        pay(s, "PREPAY", s.total.subtract(prepay), "SUCCESS", restAt);
                    }
                }
                break;
            }
        }
    }

    // ---- лечение: назначения, расписание, записи врача, медкарты ----

    private static final String[] DOCTORS = {"doctor", "doctor2", "doctor3"};
    private static final String[] DOCTOR_NAMES = {"Др. Воронова С.М. (Главный врач / Терапевт)", "Др. Ковалев Д.И. (Врач-физиотерапевт)",
            "Др. Лисовская А.П. (Врач-кардиолог)"};

    private List<Procedure> allowedProcedures(Stay s) {
        List<Procedure> list = new ArrayList<>();
        for (Procedure p : DemoCatalog.PROCEDURES) {
            boolean inProfile = false;
            for (String code : p.profiles()) {
                if (code.equals(s.profileCode)) {
                    inProfile = true;
                }
            }
            boolean contra = false;
            for (String code : p.contra()) {
                if (s.client.conditions.contains(code)) {
                    contra = true;
                }
            }
            if (inProfile && !contra) {
                list.add(p);
            }
        }
        return list;
    }

    private void buildTreatment() {
        LocalDate today = cfg.today();
        OffsetDateTime now = cfg.now();
        long nextAssignment = bases.assignment();
        Map<Integer, Map<LocalDate, Set<Integer>>> cabinetBusy = new HashMap<>();
        List<Stay> treated = new ArrayList<>();
        for (Stay s : stays) {
            boolean current = "CHECKED_IN".equals(s.status);
            boolean recent = "COMPLETED".equals(s.status) && !s.co.isBefore(today.minusDays(45));
            if (current || recent) {
                treated.add(s);
            }
        }
        int slotCount = 0;
        for (Stay s : treated) {
            List<Procedure> allowed = allowedProcedures(s);
            if (allowed.isEmpty()) {
                continue;
            }
            java.util.Collections.shuffle(allowed, rng);
            int r = rng.nextInt(100);
            int count = Math.min(allowed.size(), r < 15 ? 2 : r < 50 ? 3 : r < 85 ? 4 : 5);
            int doctor = (int) (s.voucherId % DOCTORS.length);
            long doctorId = refs.users().get(DOCTORS[doctor]);
            OffsetDateTime created = min(at(s.ci, 9 + rng.nextInt(3), rng.nextInt(60)), now.minusMinutes(5));
            s.assignmentId = ++nextAssignment;
            out.assignments.add(new AssignmentRow(s.assignmentId, s.voucherId, doctorId, created));

            List<SlotPlanner.Request> requests = new ArrayList<>();
            for (int i = 0; i < count; i++) {
                Procedure p = allowed.get(i);
                int nights = s.nights();
                int sessions = rng.nextInt(100) < 70 ? Math.max(3, nights - 1 - rng.nextInt(3)) : Math.max(3, nights / 2);
                sessions = Math.min(sessions, Math.max(1, nights - 1));
                int procIdx = DemoCatalog.PROCEDURES.indexOf(p);
                int cabIdx = DemoCatalog.cabinetIndex(p.cabinet());
                requests.add(new SlotPlanner.Request(procIdx, cabIdx, DemoCatalog.CABINETS.get(cabIdx).slotsPerDay(), sessions));
                out.assignmentItems.add(new AssignmentItemRow(s.assignmentId, refs.procedures().get(p.name()), sessions));
            }
            List<LocalDate> days = s.ci.datesUntil(s.co).toList();
            SlotPlanner.Plan plan = SlotPlanner.plan(days, requests, cfg.dayMinutes(), cabinetBusy, new HashMap<>());
            for (SlotPlanner.Slot slot : plan.slots()) {
                cabinetBusy.computeIfAbsent(slot.cabinetId(), k -> new HashMap<>())
                        .computeIfAbsent(slot.date(), k -> new HashSet<>()).add(slot.slotIndex());
                OffsetDateTime when = slot.date().atStartOfDay(cfg.zone()).plusMinutes(cfg.dayStartMinute() + slot.startMinute()).toOffsetDateTime();
                boolean done = !when.isAfter(now) && rng.nextInt(100) < 96;
                Procedure p = DemoCatalog.PROCEDURES.get(slot.procedureId());
                out.slots.add(new SlotRow(s.assignmentId, refs.procedures().get(p.name()), refs.cabinets().get(p.cabinet()), when, done));
                slotCount++;
            }
        }

        // электронные медкарты и записи врача
        int cardNo = 0;
        for (ClientInfo c : clientInfos) {
            cardNo++;
            boolean persona = c.id == refs.ivanovClientId();
            int age = (int) ChronoUnit.YEARS.between(c.birth, today);
            int height = persona ? 178 : (c.person.female() ? 156 : 168) + rng.nextInt(20);
            double w = persona ? 74.5 : (c.person.female() ? 52 : 68) + rng.nextInt(30) + rng.nextDouble();
            int sys = persona ? 120 : 112 + rng.nextInt(38) + (c.conditions.contains("HYPERTENSION") ? 15 : 0);
            int dia = persona ? 80 : 70 + rng.nextInt(22) + (c.conditions.contains("HYPERTENSION") ? 8 : 0);
            String[] blood = {"O (I) Rh+", "A (II) Rh+", "B (III) Rh+", "AB (IV) Rh+", "O (I) Rh-", "A (II) Rh-"};
            String[] allergy = {"Нет данных об аллергии", "Пенициллиновый ряд (лёгкая крапивница)", "Пыльца берёзы (сезонный ринит)", "Цитрусовые", "Нет", "Йодсодержащие препараты"};
            StringBuilder chronic = new StringBuilder();
            for (String code : c.conditions) {
                for (DemoCatalog.Condition cond : DemoCatalog.CONDITIONS) {
                    if (cond.code().equals(code)) {
                        if (chronic.length() > 0) {
                            chronic.append("; ");
                        }
                        chronic.append(cond.name());
                    }
                }
            }
            String chronicText = persona ? "Остеохондроз пояснично-крестцового отдела позвоночника; гипертоническая болезнь I ст."
                    : chronic.length() == 0 ? "Не выявлено" : chronic.toString();
            out.ehr.add(new EhrRow(c.id, persona ? "СКК-2026/001" : String.format("СКК-%d/%04d", today.getYear(), cardNo + 1),
                    persona ? "A (II) Rh+" : blood[rng.nextInt(blood.length)],
                    persona ? "Пенициллиновый ряд (лёгкая крапивница)" : allergy[rng.nextInt(allergy.length)], chronicText, height,
                    BigDecimal.valueOf(Math.round(w * 10) / 10.0).setScale(1, RoundingMode.HALF_UP), sys, dia,
                    60 + rng.nextInt(28) + (age > 65 ? 4 : 0), now.minusDays(rng.nextInt(60))));
        }
        for (Stay s : stays) {
            boolean current = "CHECKED_IN".equals(s.status);
            boolean recent = "COMPLETED".equals(s.status) && !s.co.isBefore(today.minusDays(120));
            if (!current && !recent) {
                continue;
            }
            int doctor = (int) (s.voucherId % DOCTORS.length);
            long doctorId = refs.users().get(DOCTORS[doctor]);
            int sys = 112 + rng.nextInt(35);
            int dia = 68 + rng.nextInt(20);
            int pulse = 60 + rng.nextInt(28);
            out.notes.add(new NoteRow(s.client.id, doctorId, DOCTOR_NAMES[doctor], "INITIAL", DemoTexts.complaint(rng, s.profileCode),
                    DemoTexts.objective(rng, sys, dia, pulse), DemoTexts.recommendation(rng, "INITIAL"),
                    min(at(s.ci, 10 + rng.nextInt(2), rng.nextInt(60)), now.minusMinutes(5))));
            if (s.nights() >= 9) {
                LocalDate mid = s.ci.plusDays(s.nights() / 2);
                OffsetDateTime when = at(mid, 11, rng.nextInt(60));
                if (!when.isAfter(now)) {
                    out.notes.add(new NoteRow(s.client.id, doctorId, DOCTOR_NAMES[doctor], "CONTROL", "Жалобы уменьшились, переносимость процедур хорошая",
                            DemoTexts.objective(rng, sys - 4, dia - 2, pulse - 2), DemoTexts.recommendation(rng, "CONTROL"), when));
                }
            }
            if ("COMPLETED".equals(s.status)) {
                out.notes.add(new NoteRow(s.client.id, doctorId, DOCTOR_NAMES[doctor], "DISCHARGE", "Жалоб активно не предъявляет",
                        DemoTexts.objective(rng, sys - 6, dia - 3, pulse - 3), DemoTexts.recommendation(rng, "DISCHARGE"),
                        min(at(s.co.minusDays(1), 12, rng.nextInt(60)), now.minusMinutes(5))));
            }
        }
    }

    // ---- лояльность ----

    private record Event(OffsetDateTime time, boolean earn, Stay stay) { }

    private void buildLoyalty() {
        Map<Long, List<Stay>> byClient = new HashMap<>();
        for (Stay s : stays) {
            if (s.active()) {
                byClient.computeIfAbsent(s.client.id, k -> new ArrayList<>()).add(s);
            }
        }
        OffsetDateTime now = cfg.now();
        for (ClientInfo c : clientInfos) {
            List<Stay> list = byClient.get(c.id);
            if (list == null || list.isEmpty()) {
                continue;
            }
            List<Event> events = new ArrayList<>();
            OffsetDateTime first = null;
            for (Stay s : list) {
                if (first == null || s.createdAt.isBefore(first)) {
                    first = s.createdAt;
                }
                events.add(new Event(s.createdAt.plusMinutes(10), false, s));
                if ("COMPLETED".equals(s.status)) {
                    events.add(new Event(min(at(s.co, 12, 0), now.minusMinutes(1)), true, s));
                }
            }
            events.sort(Comparator.comparing(Event::time));
            int balance = 100;
            BigDecimal spent = BigDecimal.ZERO;
            out.bonuses.add(new BonusRow(c.id, 100, "WELCOME", "Приветственный бонус нового гостя", null, first.minusMinutes(1)));
            for (Event e : events) {
                if (e.earn()) {
                    int percent = spent.compareTo(BigDecimal.valueOf(5000)) >= 0 ? 10 : spent.compareTo(BigDecimal.valueOf(2500)) >= 0 ? 7
                            : spent.compareTo(BigDecimal.valueOf(1000)) >= 0 ? 5 : 3;
                    int amount = e.stay().total.multiply(BigDecimal.valueOf(percent)).divide(BigDecimal.valueOf(100), 0, RoundingMode.DOWN).intValue();
                    spent = spent.add(e.stay().total);
                    balance += amount;
                    out.bonuses.add(new BonusRow(c.id, amount, "EARN", "Кэшбэк " + percent + "% за путёвку №" + e.stay().voucherId,
                            e.stay().voucherId, e.time()));
                } else if (balance >= 100 && rng.nextInt(100) < 18) {
                    int amount = Math.min(balance / 50 * 50, 50 * (1 + rng.nextInt(6)));
                    balance -= amount;
                    out.bonuses.add(new BonusRow(c.id, -amount, "REDEMPTION", "Списание бонусов при оплате путёвки №" + e.stay().voucherId,
                            e.stay().voucherId, e.time()));
                }
            }
            if (rng.nextInt(100) < 7) {
                balance += 100;
                out.bonuses.add(new BonusRow(c.id, 100, "ADJUSTMENT", "Корректировка: компенсация за неудобства при заселении", null,
                        first.plusDays(20).isBefore(now) ? first.plusDays(20) : first.plusMinutes(5)));
            }
            out.loyalty.add(new LoyaltyRow(c.id, balance, spent, first.minusMinutes(1)));
        }
    }

    // ---- отзывы ----

    private void buildReviews() {
        OffsetDateTime now = cfg.now();
        LocalDate today = cfg.today();
        long nextReview = bases.review();
        for (Stay s : stays) {
            if (!"COMPLETED".equals(s.status) || rng.nextInt(100) >= 24) {
                continue;
            }
            int x = rng.nextInt(100);
            int overall = x < 46 ? 5 : x < 78 ? 4 : x < 91 ? 3 : x < 97 ? 2 : 1;
            int room = clamp(overall + rng.nextInt(3) - 1);
            int treat = clamp(overall + rng.nextInt(3) - 1);
            int food = clamp(overall + rng.nextInt(3) - 1);
            int service = clamp(overall + rng.nextInt(3) - 1);
            int nps = overall == 5 ? 9 + rng.nextInt(2) : overall == 4 ? 7 + rng.nextInt(3) : overall == 3 ? 5 + rng.nextInt(3)
                    : overall == 2 ? 2 + rng.nextInt(4) : rng.nextInt(4);
            long id = ++nextReview;
            OffsetDateTime created = min(at(s.co.plusDays(1 + rng.nextInt(6)), 9 + rng.nextInt(12), rng.nextInt(60)), now.minusMinutes(30));
            String status = "PUBLISHED";
            int st = rng.nextInt(100);
            long ageDays = ChronoUnit.DAYS.between(s.co, today);
            if (ageDays <= 5 ? st < 40 : st < 4) {
                status = "PENDING";
            } else if (st >= 97) {
                status = "REJECTED";
            }
            String comment = "REJECTED".equals(status) ? DemoTexts.SPAM_COMMENT : DemoTexts.reviewComment(rng, overall, room, treat, food, service);
            String reply = null;
            OffsetDateTime repliedAt = null;
            String replier = null;
            if ("PUBLISHED".equals(status) && ageDays >= 3 && rng.nextInt(100) < 65) {
                reply = DemoTexts.replyText(rng, s.client.person.first() + " " + s.client.person.middle(), overall);
                repliedAt = min(created.plusHours(6 + rng.nextInt(60)), now.minusMinutes(5));
                replier = DemoTexts.REPLIERS[rng.nextInt(DemoTexts.REPLIERS.length)];
            }
            out.reviews.add(new ReviewRow(id, s.voucherId, s.client.id, s.client.person.fullName(), DemoCatalog.CATEGORIES.get(s.cat).name(),
                    roomNumber[s.room], s.ci + " — " + s.co, overall, nps, room, treat, food, service, comment, status, reply, repliedAt,
                    replier, created));
            List<Procedure> procs = allowedProcedures(s);
            java.util.Collections.shuffle(procs, rng);
            for (int i = 0; i < Math.min(procs.size(), 1 + rng.nextInt(3)); i++) {
                int rating = clamp(treat + rng.nextInt(3) - 1);
                out.feedbacks.add(new FeedbackRow(id, procs.get(i).name(), rating, DemoTexts.procedureComment(rng, rating)));
            }
        }
    }

    private static int clamp(int v) {
        return Math.max(1, Math.min(5, v));
    }

    // ---- лист ожидания ----

    private void buildWaitlist() {
        LocalDate today = cfg.today();
        OffsetDateTime now = cfg.now();
        List<int[]> wishes = new ArrayList<>(failedFuture);
        java.util.Collections.shuffle(wishes, rng);
        int target = 26;
        List<WaitRow> rows = new ArrayList<>();
        for (int i = 0; i < target; i++) {
            int cat;
            LocalDate from;
            int nights;
            int places;
            if (i < wishes.size() && i < 14) {
                int[] w = wishes.get(i);
                cat = w[0];
                from = today.plusDays(w[1]);
                nights = w[2];
                places = w[3];
            } else {
                // популярные категории на пиковые даты (новогодние и ближайшие выходные)
                int[] cats = {3, 4, 2, 1, 3, 4};
                cat = cats[rng.nextInt(cats.length)];
                from = rng.nextBoolean() ? LocalDate.of(today.getYear(), 12, 27 + rng.nextInt(3))
                        : today.plusDays(7 + rng.nextInt(40));
                nights = new int[]{7, 10, 14}[rng.nextInt(3)];
                places = Math.min(DemoCatalog.CATEGORIES.get(cat).capacity(), 2 + rng.nextInt(2));
            }
            ClientInfo c = clientInfos.get(1 + rng.nextInt(clientInfos.size() - 1));
            int x = rng.nextInt(100);
            String status = x < 60 ? "OPEN" : x < 80 ? "NOTIFIED" : "CLOSED";
            if (from.isBefore(today)) {
                from = today.plusDays(3);
            }
            rows.add(new WaitRow(c.id, refs.categories().get(DemoCatalog.CATEGORIES.get(cat).name()), from, from.plusDays(nights), places, status,
                    now.minusHours(2 + rng.nextInt(24 * 25))));
        }
        out.waitlist.addAll(rows);
    }

    // ---- карта номеров ----

    private void buildRoomStates() {
        LocalDate today = cfg.today();
        Map<String, String[]> state = new HashMap<>();
        for (Stay s : stays) {
            if (!s.active()) {
                continue;
            }
            String num = roomNumber[s.room];
            if ("CHECKED_IN".equals(s.status)) {
                state.put(num, new String[]{"OCCUPIED", "Гость: " + s.client.person.shortName() + " (путёвка №" + s.voucherId + ")"});
            }
        }
        for (Stay s : stays) {
            if (!s.active()) {
                continue;
            }
            String num = roomNumber[s.room];
            if (state.containsKey(num)) {
                continue;
            }
            if ("CONFIRMED".equals(s.status) && !s.ci.isBefore(today) && s.ci.isBefore(today.plusDays(3))) {
                state.put(num, new String[]{"RESERVED", "Заезд " + s.ci + ": " + s.client.person.shortName() + " (путёвка №" + s.voucherId + ")"});
            } else if ("COMPLETED".equals(s.status) && s.co.equals(today)) {
                state.put(num, new String[]{"CLEANING", "Уборка после выезда гостя, смена белья"});
            }
        }
        int extraCleaning = 0;
        for (int i = 0; i < roomNumber.length && extraCleaning < 3; i += 17) {
            if (!state.containsKey(roomNumber[i])) {
                state.put(roomNumber[i], new String[]{"CLEANING", "Плановая генеральная уборка"});
                extraCleaning++;
            }
        }
        for (String num : roomNumber) {
            String[] st = state.get(num);
            out.roomStates.add(new RoomState(refs.rooms().get(num), st == null ? "VACANT" : st[0], st == null ? null : st[1]));
        }
    }

    // ---- уведомления ----

    private void buildNotifications() {
        LocalDate today = cfg.today();
        OffsetDateTime now = cfg.now();
        long arrivals = stays.stream().filter(s -> s.active() && s.ci.equals(today)).count();
        long departures = stays.stream().filter(s -> "COMPLETED".equals(s.status) && s.co.equals(today)).count();
        long awaiting = stays.stream().filter(s -> "AWAITING_PAYMENT".equals(s.status)).count();
        long sessionsToday = out.slots.stream().filter(s -> s.slotDt().atZoneSameInstant(cfg.zone()).toLocalDate().equals(today)).count();
        long openWait = out.waitlist.stream().filter(w -> "OPEN".equals(w.status())).count();
        long pendingReviews = out.reviews.stream().filter(r -> "PENDING".equals(r.status())).count();
        long checkedIn = stays.stream().filter(s -> "CHECKED_IN".equals(s.status)).count();

        Long client = refs.users().get("client");
        Long admin = refs.users().get("admin");
        Long doctor = refs.users().get("doctor");
        Long manager = refs.users().get("manager");
        Long sysadmin = refs.users().get("sysadmin");
        ClientInfo iv = clientInfos.get(0);
        Stay current = stays.stream().filter(s -> s.client == iv && "CHECKED_IN".equals(s.status)).findFirst().orElse(null);
        Stay future = stays.stream().filter(s -> s.client == iv && "CONFIRMED".equals(s.status)).findFirst().orElse(null);
        if (current != null) {
            n(client, "MEDICAL", "Расписание процедур на сегодня", "На сегодня у вас запланированы процедуры по путёвке №" + current.voucherId
                    + ". Подробности — в разделе «Мои путёвки».", "/my", false, now.minusMinutes(25));
            n(client, "INFO", "Добро пожаловать!", "Вы заселены в номер " + roomNumber[current.room] + ". Приятного отдыха и успешного лечения.", "/my", true, now.minusDays(5).plusHours(1));
            n(client, "INFO", "Электронная медицинская карта", "Ваша санаторно-курортная карта СКК-2026/001 внесена в базу данных.", "/profile", true, now.minusDays(5));
        }
        if (future != null) {
            n(client, "PAYMENT", "Предоплата получена", "Предоплата по путёвке №" + future.voucherId + " зачислена, бронь подтверждена.", "/my", true, now.minusDays(12));
        }
        n(client, "LOYALTY", "Начислен кэшбэк", "За завершённую путёвку начислен кэшбэк бонусами. Проверьте баланс в разделе «Лояльность».", "/profile", false, now.minusDays(2));
        n(client, "WAITLIST", "Освободились места", "В категории из вашего листа ожидания появились свободные места на нужные даты.", "/search", false, now.minusHours(6));
        n(client, "INFO", "Ответ на ваш отзыв", "Администрация санатория ответила на ваш отзыв о предыдущем пребывании.", "/reviews", true, now.minusDays(20));

        n(admin, "INFO", "Заезды на сегодня", "Сегодня запланировано заездов: " + arrivals + ". Проживает гостей: " + checkedIn + ".", "/admin", false, now.minusMinutes(50));
        n(admin, "PAYMENT", "Ожидают оплаты", "Путёвок в статусе «Ожидает оплаты»: " + awaiting + ". Срок оплаты — 24 часа с момента оформления.", "/admin", false, now.minusHours(1));
        n(admin, "WAITLIST", "Лист ожидания", "Открытых заявок в листе ожидания: " + openWait + ". При освобождении мест система уведомит гостей.", "/admin", false, now.minusHours(3));
        n(admin, "INFO", "Выезды сегодня", "Сегодня выезжает гостей: " + departures + ". Номера будут переведены на уборку.", "/rooms", true, now.minusHours(5));
        n(admin, "PAYMENT", "Платёж отклонён", "Банк отклонил оплату по одной из путёвок. Свяжитесь с гостем и предложите повторить оплату.", "/admin", true, now.minusDays(1));

        n(doctor, "MEDICAL", "Процедуры на сегодня", "По санаторию запланировано сеансов: " + sessionsToday + ". Расписание — в рабочем месте врача.", "/doctor", false, now.minusMinutes(40));
        n(doctor, "MEDICAL", "Новые проживающие", "Гостей в статусе «Проживает» без назначений лечения стоит проверить после утреннего обхода.", "/doctor", false, now.minusHours(4));
        n(doctor, "INFO", "Противопоказания", "При назначении процедур система предупреждает о противопоказаниях по заболеваниям гостя.", "/doctor", true, now.minusDays(2));

        n(manager, "INFO", "Рекомендации цены", "Есть рекомендации цены вне коридора, ожидающие решения менеджера.", "/manager", false, now.minusMinutes(90));
        n(manager, "INFO", "Новые отзывы", "Отзывов на модерации: " + pendingReviews + ". Оценка NPS обновляется ежедневно.", "/manager", false, now.minusHours(7));
        n(manager, "LOYALTY", "Программа лояльности", "За месяц начислено бонусов по " + out.bonuses.stream().filter(b -> "EARN".equals(b.type())).count() + " операциям.", "/manager", true, now.minusDays(3));

        n(sysadmin, "INFO", "Резервное копирование", "Ночное резервное копирование БД выполнено успешно.", "/sysadmin", true, now.minusHours(9));
        n(sysadmin, "INFO", "Журнал аудита", "Журнал действий пользователей доступен в разделе «Аудит».", "/sysadmin", false, now.minusDays(1));

        n(null, "INFO", "Плановые работы", "Завтра с 02:00 до 03:00 возможна кратковременная недоступность онлайн-бронирования.", null, false, now.minusHours(12));
        n(null, "LOYALTY", "Новогодние предложения", "Открыты пакеты «Новый год в санатории». Бронируйте заранее — количество номеров ограничено.", "/packages", false, now.minusDays(1));
    }

    private void n(Long userId, String type, String title, String message, String link, boolean read, OffsetDateTime created) {
        out.notifications.add(new NotificationRow(userId, type, title, message, link, read, created));
    }

    // ---- журнал аудита (формат AuditInterceptor: action = метод, entity = путь, details = status=код) ----

    private void buildAudit() {
        OffsetDateTime now = cfg.now();
        String[][] actions = {
                {"admin", "POST", "/api/vouchers", "201"},
                {"admin", "POST", "/api/vouchers/{v}/check-in", "200"},
                {"admin", "POST", "/api/vouchers/{v}/check-out", "200"},
                {"admin", "POST", "/api/vouchers/{v}/cancel", "200"},
                {"admin", "POST", "/api/waitlist", "201"},
                {"admin", "PUT", "/api/interactive-rooms/{r}/status", "200"},
                {"doctor", "POST", "/api/assignments", "201"},
                {"doctor", "POST", "/api/assignments/{a}/schedule", "201"},
                {"doctor", "POST", "/api/schedule/{s}/done", "200"},
                {"doctor", "POST", "/api/ehr/notes", "201"},
                {"manager", "PUT", "/api/packages/{p}/toggle", "200"},
                {"manager", "POST", "/api/loyalty/add-bonus", "200"},
                {"manager", "POST", "/api/reviews/{rv}/reply", "200"},
                {"client", "POST", "/api/vouchers", "201"},
                {"client", "POST", "/api/vouchers/{v}/pay", "200"},
                {"client", "POST", "/api/reviews", "201"},
                {"sysadmin", "PUT", "/api/users/{u}/roles", "200"},
                {"sysadmin", "PUT", "/api/users/{u}/active", "200"},
                {"sysadmin", "POST", "/api/inventory/{i}/restock", "200"},
                {"sysadmin", "PUT", "/api/staff/{st}/status", "200"},
                {null, "POST", "/api/auth/login", "200"},
                {null, "POST", "/api/auth/login", "401"}};
        int total = 340;
        List<AuditRow> rows = new ArrayList<>();
        for (int i = 0; i < total; i++) {
            String[] a = actions[rng.nextInt(actions.length)];
            if (a[0] == null && rng.nextInt(3) > 0) {
                a = actions[rng.nextInt(actions.length - 2)];
            }
            Long user = a[0] == null ? null : refs.users().get(a[0]);
            String path = a[2]
                    .replace("{v}", String.valueOf(bases.voucher() + 1 + rng.nextInt(Math.max(1, stays.size()))))
                    .replace("{r}", String.valueOf(1 + rng.nextInt(DemoCatalog.ROOMS.size())))
                    .replace("{a}", String.valueOf(bases.assignment() + 1 + rng.nextInt(Math.max(1, out.assignments.size()))))
                    .replace("{s}", String.valueOf(1 + rng.nextInt(Math.max(1, out.slots.size()))))
                    .replace("{p}", String.valueOf(1 + rng.nextInt(8)))
                    .replace("{rv}", String.valueOf(bases.review() + 1 + rng.nextInt(Math.max(1, out.reviews.size()))))
                    .replace("{u}", String.valueOf(1 + rng.nextInt(8)))
                    .replace("{i}", String.valueOf(1 + rng.nextInt(24)))
                    .replace("{st}", String.valueOf(1 + rng.nextInt(16)));
            long minutesAgo = (long) (Math.pow(rng.nextDouble(), 1.7) * 30 * 24 * 60) + 3;
            rows.add(new AuditRow(user, a[1], path.length() <= 50 ? path : path.substring(0, 50), "status=" + a[3], now.minusMinutes(minutesAgo)));
        }
        rows.sort(Comparator.comparing(AuditRow::createdAt));
        out.audit.addAll(rows);
    }
}
