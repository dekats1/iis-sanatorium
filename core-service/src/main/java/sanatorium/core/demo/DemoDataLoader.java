package sanatorium.core.demo;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.context.annotation.Profile;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;
import sanatorium.core.common.CoreProperties;
import sanatorium.core.demo.DemoCatalog.Procedure;
import sanatorium.core.demo.DemoDataset.*;

/**
 * Демонстрационные данные (профиль demo). Пользователи и справочники создаются всегда; «живой» объём — около 170
 * клиентов, 1,4 тыс. путёвок за 18 месяцев назад и 3 месяца вперёд, платежи, лечение, расписание, отзывы, лояльность,
 * склад, персонал, пакеты, уведомления, журнал аудита — генерирует {@link DemoGenerator} детерминированно (seed) от
 * сегодняшней даты и загружает пакетными вставками одной транзакцией.
 *
 * <p>Идемпотентность: если клиентов уже не меньше {@link #SEEDED_CLIENTS} (набор загружен), повторный запуск ничего не
 * добавляет; справочники вставляются по естественным ключам (ON CONFLICT DO NOTHING). Идентификаторы больших таблиц
 * назначаются заранее (OVERRIDING SYSTEM VALUE), после вставки последовательности сдвигаются за максимум.
 */
@Component
@Profile("demo")
public class DemoDataLoader implements ApplicationRunner {

    private static final Logger log = LoggerFactory.getLogger(DemoDataLoader.class);
    static final int SEEDED_CLIENTS = 100;

    private final JdbcTemplate jdbc;
    private final PasswordEncoder encoder;
    private final CoreProperties props;

    public DemoDataLoader(JdbcTemplate jdbc, PasswordEncoder encoder, CoreProperties props) {
        this.jdbc = jdbc;
        this.encoder = encoder;
        this.props = props;
    }

    @Override
    @Transactional
    public void run(ApplicationArguments args) {
        long started = System.currentTimeMillis();
        Map<String, Long> users = ensureUsers();
        if (count("clients") >= SEEDED_CLIENTS) {
            log.info("Демо-данные уже загружены (клиентов: {}), пропуск", count("clients"));
            return;
        }
        long ivanov = ensureIvanovClient(users.get("client"));

        ZoneId zone = ZoneId.of(props.schedule().zone());
        LocalDate today = LocalDate.now(zone);
        OffsetDateTime now = OffsetDateTime.now(zone);

        DemoGenerator.Refs refs = loadReferences(users, ivanov);
        DemoGenerator.Bases bases = new DemoGenerator.Bases(maxId("clients"), maxId("vouchers"), maxId("bookings"),
                maxId("payments"), maxId("treatment_assignments"), maxId("guest_reviews"));
        DemoDataset data = new DemoGenerator(refs, bases, DemoGenerator.Config.of(today, now, zone)).generate();

        insertAll(data, ivanov);
        seedPriceSnapshot(refs, today);
        seedOperations(refs, data, today, now);
        for (String table : new String[]{"clients", "vouchers", "bookings", "payments", "treatment_assignments", "guest_reviews"}) {
            resetSequence(table);
        }
        log.info("Демо-данные загружены за {} мс: клиентов {}, путёвок {}, платежей {}, сеансов {}, отзывов {}, записей аудита {} "
                        + "(пользователи: admin, doctor, manager, sysadmin, client)",
                System.currentTimeMillis() - started, data.clients.size(), data.vouchers.size(), data.payments.size(), data.slots.size(),
                data.reviews.size(), data.audit.size());
    }

    // ---- пользователи ----

    private Map<String, Long> ensureUsers() {
        String hash = null;
        String[][] defs = {
                {"admin", "Администратор бронирования", "BOOKING_ADMIN"},
                {"doctor", "Врач", "DOCTOR"},
                {"manager", "Менеджер по доходам", "MANAGER"},
                {"sysadmin", "Системный администратор", "SYSADMIN"},
                {"client", "Иванов Иван", "CLIENT"},
                {"doctor2", "Ковалев Дмитрий Игоревич", "DOCTOR"},
                {"doctor3", "Лисовская Анна Павловна", "DOCTOR"}};
        Map<String, Long> ids = new LinkedHashMap<>();
        for (String[] d : defs) {
            List<Long> found = jdbc.queryForList("SELECT id FROM users WHERE username = ?", Long.class, d[0]);
            if (!found.isEmpty()) {
                ids.put(d[0], found.get(0));
                continue;
            }
            if (hash == null) {
                hash = encoder.encode(props.demo().password());
            }
            Long id = jdbc.queryForObject("INSERT INTO users (username, password_hash, full_name) VALUES (?, ?, ?) RETURNING id",
                    Long.class, d[0], hash, d[1]);
            int linked = jdbc.update("INSERT INTO user_roles (user_id, role_id) SELECT ?, id FROM roles WHERE code = ?", id, d[2]);
            if (linked != 1) {
                throw new IllegalStateException("Справочник ролей не заполнен: " + d[2]);
            }
            ids.put(d[0], id);
        }
        return ids;
    }

    private long ensureIvanovClient(long userId) {
        List<Long> found = jdbc.queryForList("SELECT id FROM clients WHERE user_id = ?", Long.class, userId);
        if (!found.isEmpty()) {
            return found.get(0);
        }
        return jdbc.queryForObject("INSERT INTO clients (user_id, last_name, first_name, birth_date) VALUES (?, 'Иванов', 'Иван', DATE '1975-03-14') RETURNING id",
                Long.class, userId);
    }

    // ---- справочники ----

    private Map<String, Long> idMap(String sql, Object... args) {
        Map<String, Long> m = new HashMap<>();
        jdbc.query(sql, rs -> {
            m.put(rs.getString(2), rs.getLong(1));
        }, args);
        return m;
    }

    private DemoGenerator.Refs loadReferences(Map<String, Long> users, long ivanov) {
        for (DemoCatalog.Category c : DemoCatalog.CATEGORIES) {
            jdbc.update("INSERT INTO room_categories (name, capacity_total, description) VALUES (?, ?, ?) "
                    + "ON CONFLICT (name) DO UPDATE SET description = EXCLUDED.description", c.name(), c.capacity(), c.description());
        }
        Map<String, Long> categories = idMap("SELECT id, name FROM room_categories");

        List<Object[]> rooms = new ArrayList<>();
        for (DemoCatalog.RoomSpec r : DemoCatalog.ROOMS) {
            rooms.add(new Object[]{categories.get(DemoCatalog.CATEGORIES.get(r.category()).name()), r.number(), r.floor(), r.view(),
                    r.amenities(), r.building()});
        }
        jdbc.batchUpdate("INSERT INTO rooms (category_id, room_number, floor, is_active, status, window_view, amenities, building) "
                + "VALUES (?, ?, ?, TRUE, 'VACANT', ?, ?, ?) ON CONFLICT (room_number) DO UPDATE SET category_id = EXCLUDED.category_id, "
                + "floor = EXCLUDED.floor, is_active = TRUE, status = 'VACANT', notes = NULL, window_view = EXCLUDED.window_view, "
                + "amenities = EXCLUDED.amenities, building = EXCLUDED.building", rooms);
        Map<String, Long> roomIds = idMap("SELECT id, room_number FROM rooms");

        List<Object[]> rows = new ArrayList<>();
        DemoCatalog.PROFILES.forEach(p -> rows.add(new Object[]{p.code(), p.name()}));
        jdbc.batchUpdate("INSERT INTO treatment_profiles (code, name) VALUES (?, ?) ON CONFLICT (code) DO NOTHING", rows);
        Map<String, Long> profiles = idMap("SELECT id, code FROM treatment_profiles");

        rows.clear();
        DemoCatalog.CABINETS.forEach(c -> rows.add(new Object[]{c.name(), c.slotsPerDay()}));
        jdbc.batchUpdate("INSERT INTO cabinets (name, slots_per_day) VALUES (?, ?) ON CONFLICT (name) DO NOTHING", rows);
        Map<String, Long> cabinets = idMap("SELECT id, name FROM cabinets");

        rows.clear();
        DemoCatalog.CONDITIONS.forEach(c -> rows.add(new Object[]{c.code(), c.name()}));
        jdbc.batchUpdate("INSERT INTO medical_conditions (code, name) VALUES (?, ?) ON CONFLICT (code) DO NOTHING", rows);
        Map<String, Long> conditions = idMap("SELECT id, code FROM medical_conditions");

        rows.clear();
        for (Procedure p : DemoCatalog.PROCEDURES) {
            rows.add(new Object[]{p.name(), p.minutes(), cabinets.get(p.cabinet())});
        }
        jdbc.batchUpdate("INSERT INTO procedures (name, duration_min, cabinet_id) VALUES (?, ?, ?) ON CONFLICT (name) DO NOTHING", rows);
        Map<String, Long> procedures = idMap("SELECT id, name FROM procedures");
        List<Object[]> links = new ArrayList<>();
        List<Object[]> contra = new ArrayList<>();
        for (Procedure p : DemoCatalog.PROCEDURES) {
            for (String code : p.profiles()) {
                links.add(new Object[]{procedures.get(p.name()), profiles.get(code)});
            }
            for (String code : p.contra()) {
                contra.add(new Object[]{procedures.get(p.name()), conditions.get(code)});
            }
        }
        jdbc.batchUpdate("INSERT INTO procedure_profiles (procedure_id, profile_id) VALUES (?, ?) ON CONFLICT DO NOTHING", links);
        jdbc.batchUpdate("INSERT INTO procedure_contraindications (procedure_id, condition_id) VALUES (?, ?) ON CONFLICT DO NOTHING", contra);

        rows.clear();
        DemoCatalog.DIETS.forEach(d -> rows.add(new Object[]{d.code(), d.name()}));
        jdbc.batchUpdate("INSERT INTO diets (code, name) VALUES (?, ?) ON CONFLICT (code) DO NOTHING", rows);
        Map<String, Long> diets = idMap("SELECT id, code FROM diets");

        rows.clear();
        DemoCatalog.CHANNELS.forEach(c -> rows.add(new Object[]{c.name(), BigDecimal.valueOf(c.commissionPct()), c.quota()}));
        jdbc.batchUpdate("INSERT INTO sales_channels (name, commission_pct, quota_places) VALUES (?, ?, ?) ON CONFLICT (name) DO NOTHING", rows);
        Map<String, Long> channels = idMap("SELECT id, name FROM sales_channels");

        rows.clear();
        DemoCatalog.ORGS.forEach(o -> rows.add(new Object[]{o.name(), o.contractNo(), o.name()}));
        jdbc.batchUpdate("INSERT INTO customers (type, name, contract_no) SELECT 'ORG', ?, ? WHERE NOT EXISTS (SELECT 1 FROM customers WHERE name = ?)", rows);
        Map<String, Long> orgs = idMap("SELECT id, name FROM customers WHERE type = 'ORG'");
        List<Long> customers = new ArrayList<>();
        DemoCatalog.ORGS.forEach(o -> customers.add(orgs.get(o.name())));

        return new DemoGenerator.Refs(categories, profiles, conditions, diets, channels, cabinets, procedures, roomIds, customers, users, ivanov);
    }

    // ---- пакетная вставка набора ----

    private void insertAll(DemoDataset d, long ivanov) {
        List<Object[]> rows = new ArrayList<>();
        for (ClientRow c : d.clients) {
            if (c.id() == ivanov) {
                jdbc.update("UPDATE clients SET middle_name = ?, phone = ?, email = ?, citizenship = ? WHERE id = ?",
                        c.middle(), c.phone(), c.email(), c.citizenship(), c.id());
            } else {
                rows.add(new Object[]{c.id(), c.last(), c.first(), c.middle(), c.birth(), c.phone(), c.email(), c.citizenship()});
            }
        }
        jdbc.batchUpdate("INSERT INTO clients (id, last_name, first_name, middle_name, birth_date, phone, email, citizenship) "
                + "OVERRIDING SYSTEM VALUE VALUES (?, ?, ?, ?, ?, ?, ?, ?)", rows);

        Map<String, Long> conds = idMap("SELECT id, code FROM medical_conditions");
        rows.clear();
        d.clientConditions.forEach(c -> rows.add(new Object[]{c.clientId(), conds.get(c.conditionCode()), c.diagnosedAt()}));
        jdbc.batchUpdate("INSERT INTO client_conditions (client_id, condition_id, diagnosed_at) VALUES (?, ?, ?) ON CONFLICT DO NOTHING", rows);

        rows.clear();
        d.vouchers.forEach(v -> rows.add(new Object[]{v.id(), v.clientId(), v.customerId(), v.channelId(), v.profileId(), v.dietId(), v.createdBy(),
                v.status(), v.pricePerDay(), v.total(), v.deadline(), v.createdAt()}));
        jdbc.batchUpdate("INSERT INTO vouchers (id, client_id, customer_id, channel_id, profile_id, diet_id, created_by, status, "
                + "price_per_place_day, total_price, payment_deadline, created_at) OVERRIDING SYSTEM VALUE VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)", rows);

        rows.clear();
        d.bookings.forEach(b -> rows.add(new Object[]{b.id(), b.voucherId(), b.roomId(), b.checkIn(), b.checkOut(), b.places(), b.status()}));
        jdbc.batchUpdate("INSERT INTO bookings (id, voucher_id, room_id, check_in, check_out, places_count, status) "
                + "OVERRIDING SYSTEM VALUE VALUES (?, ?, ?, ?, ?, ?, ?)", rows);

        rows.clear();
        d.places.forEach(p -> rows.add(new Object[]{p.bookingId(), p.roomId(), p.placeNo(), p.from(), p.to(), p.active()}));
        jdbc.batchUpdate("INSERT INTO booking_places (booking_id, room_id, place_no, stay_range, is_active) "
                + "VALUES (?, ?, ?, daterange(CAST(? AS date), CAST(? AS date), '[)'), ?)", rows);

        rows.clear();
        d.payments.forEach(p -> rows.add(new Object[]{p.id(), p.voucherId(), p.kind(), p.amount(), p.status(), p.invoiceId(), p.createdAt()}));
        jdbc.batchUpdate("INSERT INTO payments (id, voucher_id, kind, amount, status, invoice_id, created_at) "
                + "OVERRIDING SYSTEM VALUE VALUES (?, ?, ?, ?, ?, ?, ?)", rows);

        rows.clear();
        d.assignments.forEach(a -> rows.add(new Object[]{a.id(), a.voucherId(), a.doctorId(), a.createdAt()}));
        jdbc.batchUpdate("INSERT INTO treatment_assignments (id, voucher_id, doctor_id, created_at) OVERRIDING SYSTEM VALUE VALUES (?, ?, ?, ?)", rows);
        rows.clear();
        d.assignmentItems.forEach(i -> rows.add(new Object[]{i.assignmentId(), i.procedureId(), i.sessions()}));
        jdbc.batchUpdate("INSERT INTO assignment_procedures (assignment_id, procedure_id, sessions_planned) VALUES (?, ?, ?)", rows);
        rows.clear();
        d.slots.forEach(s -> rows.add(new Object[]{s.assignmentId(), s.procedureId(), s.slotDt(), s.done()}));
        jdbc.batchUpdate("INSERT INTO procedure_schedule (assignment_id, procedure_id, slot_dt, done) VALUES (?, ?, ?, ?)", rows);

        rows.clear();
        d.ehr.forEach(e -> rows.add(new Object[]{e.clientId(), e.cardNumber(), e.bloodType(), e.allergies(), e.chronic(), e.heightCm(), e.weightKg(),
                e.systolic(), e.diastolic(), e.pulse(), e.updatedAt()}));
        jdbc.batchUpdate("INSERT INTO ehr_records (client_id, sanatorium_card_number, blood_type, allergies, chronic_diseases, height_cm, weight_kg, "
                + "blood_pressure_systolic, blood_pressure_diastolic, pulse, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT DO NOTHING", rows);
        rows.clear();
        d.notes.forEach(n -> rows.add(new Object[]{n.clientId(), n.doctorId(), n.doctorName(), n.visitType(), n.complaints(), n.objective(),
                n.recommendations(), n.createdAt()}));
        jdbc.batchUpdate("INSERT INTO doctor_notes (client_id, doctor_id, doctor_name, visit_type, complaints, objective_status, recommendations, created_at) "
                + "VALUES (?, ?, ?, ?, ?, ?, ?, ?)", rows);

        rows.clear();
        d.loyalty.forEach(l -> rows.add(new Object[]{l.clientId(), l.balance(), l.spentMoney(), l.createdAt()}));
        jdbc.batchUpdate("INSERT INTO loyalty_accounts (client_id, balance, spent_money, created_at) VALUES (?, ?, ?, ?) ON CONFLICT DO NOTHING", rows);
        rows.clear();
        d.bonuses.forEach(b -> rows.add(new Object[]{b.clientId(), b.amount(), b.type(), b.description(), b.voucherId(), b.createdAt()}));
        jdbc.batchUpdate("INSERT INTO bonus_transactions (client_id, amount, type, description, voucher_id, created_at) VALUES (?, ?, ?, ?, ?, ?)", rows);

        rows.clear();
        d.reviews.forEach(r -> rows.add(new Object[]{r.id(), r.voucherId(), r.clientId(), r.clientName(), r.categoryName(), r.roomNumber(), r.stayDates(),
                r.overall(), r.nps(), r.room(), r.treatment(), r.food(), r.service(), r.comment(), r.status(), r.replyText(), r.repliedAt(),
                r.replierName(), r.createdAt()}));
        jdbc.batchUpdate("INSERT INTO guest_reviews (id, voucher_id, client_id, client_name, category_name, room_number, stay_dates, overall_rating, "
                + "nps_score, room_rating, treatment_rating, food_rating, service_rating, comment, status, reply_text, replied_at, replier_name, created_at) "
                + "OVERRIDING SYSTEM VALUE VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)", rows);
        rows.clear();
        d.feedbacks.forEach(f -> rows.add(new Object[]{f.reviewId(), f.procedureName(), f.rating(), f.comment()}));
        jdbc.batchUpdate("INSERT INTO procedure_feedback (review_id, procedure_name, rating, comment) VALUES (?, ?, ?, ?)", rows);

        rows.clear();
        d.waitlist.forEach(w -> rows.add(new Object[]{w.clientId(), w.categoryId(), w.from(), w.to(), w.places(), w.status(), w.createdAt()}));
        jdbc.batchUpdate("INSERT INTO waitlist (client_id, category_id, date_from, date_to, places, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)", rows);

        rows.clear();
        d.roomStates.forEach(r -> rows.add(new Object[]{r.status(), r.notes(), r.roomId()}));
        jdbc.batchUpdate("UPDATE rooms SET status = ?, notes = ? WHERE id = ?", rows);

        rows.clear();
        d.notifications.forEach(n -> rows.add(new Object[]{n.userId(), n.type(), n.title(), n.message(), n.link(), n.read(), n.createdAt()}));
        jdbc.batchUpdate("INSERT INTO app_notifications (user_id, type, title, message, link, is_read, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)", rows);

        rows.clear();
        d.audit.forEach(a -> rows.add(new Object[]{a.userId(), a.action(), a.entity(), a.details(), a.createdAt()}));
        jdbc.batchUpdate("INSERT INTO audit_log (user_id, action, entity, details, created_at) VALUES (?, ?, ?, ?, ?)", rows);
    }

    /** Резервный снимок цен (price_snapshot) на ближайшие 100 суток: работает, даже если pricing-forecast недоступен. */
    private void seedPriceSnapshot(DemoGenerator.Refs refs, LocalDate today) {
        List<Object[]> rows = new ArrayList<>();
        for (int c = 0; c < DemoCatalog.CATEGORIES.size(); c++) {
            Long categoryId = refs.categories().get(DemoCatalog.CATEGORIES.get(c).name());
            for (int i = 0; i < 100; i++) {
                LocalDate day = today.plusDays(i);
                rows.add(new Object[]{categoryId, day, DemoGenerator.expectedPrice(c, day)});
            }
        }
        jdbc.batchUpdate("INSERT INTO price_snapshot (category_id, stay_date, price) VALUES (?, ?, ?) ON CONFLICT DO NOTHING", rows);
    }

    // ---- склад, персонал, пакеты ----

    private void seedOperations(DemoGenerator.Refs refs, DemoDataset data, LocalDate today, OffsetDateTime now) {
        // склад расходников: часть позиций ниже порога (уведомления о дефиците)
        Object[][] items = {
                {"MED-MUD-01", "Сакская лечебная грязь (очищенная)", "Бальнеология", "Грязелечение", "кг", 145, 30},
                {"MED-PAR-02", "Парафин медицинский П-2", "Физиотерапия", "Парафино-озокеритолечение", "кг", 65, 20},
                {"MED-SALT-03", "Морская соль для ванн", "Бальнеология", "Ванны", "кг", 210, 50},
                {"MED-OIL-04", "Массажное масло натуральное пихтовое", "Массаж", "Массаж", "л", 4.5, 5},
                {"MED-HERB-05", "Фиточай сбор «Витаминный общеукрепляющий»", "Фитобар", "Фитобар", "упак", 320, 40},
                {"MED-OZO-06", "Озокерит очищенный", "Физиотерапия", "Парафино-озокеритолечение", "кг", 22, 25},
                {"MED-GEL-07", "Контактный гель для УЗ-терапии", "Физиотерапия", "Физиотерапия №2", "л", 6.5, 8},
                {"MED-ELC-08", "Электроды одноразовые для электрофореза", "Физиотерапия", "Физиотерапия", "упак", 85, 30},
                {"MED-PAD-09", "Гидрофильные прокладки для электрофореза", "Физиотерапия", "Физиотерапия", "пач", 140, 60},
                {"MED-SHT-10", "Простыни одноразовые 80×200", "Общего назначения", "Массаж №2", "упак", 260, 80},
                {"MED-GLV-11", "Перчатки нитриловые (100 шт.)", "Общего назначения", "Массаж №3", "упак", 45, 20},
                {"MED-NDL-12", "Иглы для иглорефлексотерапии (100 шт.)", "Иглорефлексотерапия", "Иглорефлексотерапия", "упак", 22, 10},
                {"MED-AROM-13", "Эфирные масла для аромамассажа (набор)", "Массаж", "Массаж №2", "набор", 14, 6},
                {"MED-HAL-14", "Соль для галоингаляций (галит)", "Ингаляции", "Ингаляторий", "кг", 35, 40},
                {"MED-ALK-15", "Минеральная вода для ингаляций", "Ингаляции", "Ингаляторий", "л", 480, 150},
                {"MED-O2-16", "Кислородные коктейльные смеси", "Фитобар", "Фитобар", "л", 36, 15},
                {"MED-SPL-17", "Соль для спелеокамеры", "Ингаляции", "Спелеотерапия (соляная пещера)", "кг", 900, 400},
                {"MED-CHL-18", "Дезинфицирующее средство для ванн", "Бальнеология", "Ванны №2", "л", 28, 20},
                {"MED-TWL-19", "Полотенца процедурные махровые", "Общего назначения", "Ванны", "шт", 410, 200},
                {"MED-CRM-20", "Крем для массажа нейтральный", "Массаж", "Массаж №3", "кг", 24, 10}};
        List<Object[]> rows = new ArrayList<>();
        int i = 0;
        for (Object[] it : items) {
            rows.add(new Object[]{it[0], it[1], it[2], refs.cabinets().get((String) it[3]), it[3], it[4],
                    BigDecimal.valueOf(((Number) it[5]).doubleValue()), BigDecimal.valueOf(((Number) it[6]).doubleValue()),
                    now.minusDays(3 + (i++ * 7L) % 55)});
        }
        jdbc.batchUpdate("INSERT INTO consumables (sku, name, category, cabinet_id, cabinet_name, unit, stock_quantity, min_threshold, last_restocked_at) "
                + "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT (sku) DO NOTHING", rows);

        // персонал; загрузка сегодня считается по реальному расписанию кабинета
        Map<Long, Integer> sessionsByCabinet = new HashMap<>();
        ZoneId zone = ZoneId.of(props.schedule().zone());
        for (SlotRow s : data.slots) {
            if (s.slotDt().atZoneSameInstant(zone).toLocalDate().equals(today)) {
                sessionsByCabinet.merge(s.cabinetId(), 1, Integer::sum);
            }
        }
        Object[][] staff = {
                {"Др. Воронова Светлана Михайловна", "Главный врач, терапевт", "Кабинет №101", null, "08:00 – 16:30", "ON_SHIFT", 8, 4.98},
                {"Виктор Сергеевич Мельников", "Массажист высшей категории", "Массаж", "Массаж", "08:30 – 17:00", "ON_SHIFT", 12, 4.95},
                {"Ирина Павловна Зайцева", "Медсестра бальнеотерапии", "Водолечебница (Ванны)", "Ванны", "08:00 – 16:00", "ON_SHIFT", 14, 4.88},
                {"Др. Ковалев Дмитрий Игоревич", "Врач-физиотерапевт", "Физиотерапия", "Физиотерапия", "09:00 – 17:30", "BREAK", 15, 4.90},
                {"Др. Лисовская Анна Павловна", "Врач-кардиолог", "Кабинет №103", null, "08:00 – 16:00", "ON_SHIFT", 10, 4.93},
                {"Елена Николаевна Павлович", "Медсестра-массажист", "Массаж №2", "Массаж №2", "08:00 – 16:00", "ON_SHIFT", 12, 4.84},
                {"Сергей Анатольевич Рудько", "Мануальный терапевт", "Массаж №3", "Массаж №3", "09:00 – 17:00", "ON_SHIFT", 10, 4.91},
                {"Наталья Васильевна Кравец", "Инструктор ЛФК", "Зал ЛФК", "Зал ЛФК", "08:00 – 16:00", "ON_SHIFT", 8, 4.86},
                {"Оксана Ивановна Гринько", "Инструктор по плаванию", "Бассейн", "Бассейн", "08:00 – 16:00", "BREAK", 12, 4.79},
                {"Татьяна Александровна Шульга", "Медсестра физиотерапевтического кабинета", "Физиотерапия №2", "Физиотерапия №2", "08:00 – 16:00", "ON_SHIFT", 16, 4.82},
                {"Андрей Петрович Козлов", "Врач-иглорефлексотерапевт", "Иглорефлексотерапия", "Иглорефлексотерапия", "09:00 – 15:00", "ON_SHIFT", 8, 4.97},
                {"Марина Юрьевна Сидорова", "Медсестра ингаляторного кабинета", "Ингаляторий", "Ингаляторий", "08:00 – 16:00", "ON_SHIFT", 16, 4.77},
                {"Людмила Фёдоровна Бондарь", "Оператор грязелечебницы", "Грязелечение", "Грязелечение", "08:00 – 14:00", "OFF_DUTY", 10, 4.72},
                {"Валентина Олеговна Лис", "Медсестра парафино-озокеритолечения", "Парафино-озокеритолечение", "Парафино-озокеритолечение", "08:00 – 16:00", "ON_SHIFT", 12, 4.85},
                {"Игорь Станиславович Мартинович", "Оператор спелеотерапии", "Спелеотерапия (соляная пещера)", "Спелеотерапия (соляная пещера)", "09:00 – 17:00", "ON_SHIFT", 8, 4.80},
                {"Анжела Викторовна Ященко", "Психолог-релаксолог", "Кабинет релаксации", "Кабинет релаксации", "10:00 – 18:00", "VACATION", 8, 4.99},
                {"Дарья Сергеевна Климович", "Фитотерапевт, фитобар", "Фитобар", "Фитобар", "08:00 – 16:00", "ON_SHIFT", 16, 4.74},
                {"Светлана Игоревна Тишкевич", "Медсестра бальнеотерапии", "Ванны №2", "Ванны №2", "08:00 – 16:00", "ON_SHIFT", 12, 4.83}};
        Map<String, Integer> staffInCabinet = new HashMap<>();
        for (Object[] s : staff) {
            if (s[3] != null) {
                staffInCabinet.merge((String) s[3], 1, Integer::sum);
            }
        }
        rows.clear();
        for (Object[] s : staff) {
            int max = (Integer) s[6];
            int assigned = 0;
            String status = (String) s[5];
            if (s[3] != null && ("ON_SHIFT".equals(status) || "BREAK".equals(status))) {
                int sessions = sessionsByCabinet.getOrDefault(refs.cabinets().get((String) s[3]), 0);
                assigned = Math.min(max, (int) Math.ceil(sessions / (double) staffInCabinet.get((String) s[3])));
            } else if (s[3] == null && "ON_SHIFT".equals(status)) {
                assigned = Math.min(max, 5 + data.vouchers.size() % 4);
            }
            rows.add(new Object[]{s[0], s[1], s[2], s[4], status, assigned, max, BigDecimal.valueOf((Double) s[7]), s[0]});
        }
        jdbc.batchUpdate("INSERT INTO staff_members (full_name, role, cabinet_name, shift_hours, status, assigned_slots_today, max_slots_per_day, rating) "
                + "SELECT ?, ?, ?, ?, ?, ?, ?, ? WHERE NOT EXISTS (SELECT 1 FROM staff_members WHERE full_name = ?)", rows);

        // пакеты: {название, описание, категория, профиль, ночей, цена без пакета, цена пакета, значок, активен}
        Object[][] packages = {
                {"Здоровое сердце и сосуды", "Комплексный 14-дневный курс кардио-реабилитации: сухие углекислые ванны, спелеотерапия, массаж и диетстол №10", "Комфорт", "CARDIO", 14, 2100, 1790, "Хит сезона", true},
                {"Свободное движение (Здоровые суставы)", "Интенсивная терапия опорно-двигательного аппарата: лечебные сакские грязи, подводный душ-массаж, озокеритолечение", "Комфорт", "MSK", 12, 1850, 1580, "Выбор врачей", true},
                {"Антистресс & Релакс Weekend", "Экспресс-восстановление жизненных сил: хвойные и жемчужные ванны, аромамассаж, релаксация и кислородные коктейли", "Люкс", "WELL", 7, 1550, 1320, "Премиум", true},
                {"Дыши свободно", "Курс для органов дыхания: галоингаляции, спелеотерапия в соляной пещере, ЛФК и массаж воротниковой зоны", "Стандарт", "RESP", 10, 1150, 980, null, true},
                {"Здоровый обмен веществ", "Программа для эндокринной системы: минеральные ванны, лечебная физкультура, диетстол №8 или №9, консультации эндокринолога", "Стандарт", "ENDO", 14, 1480, 1260, "Новинка", true},
                {"Здоровый ЖКТ", "Питьевое лечение минеральной водой, грязевые аппликации, фитотерапия и щадящая диета", "Стандарт", "GIT", 12, 1290, 1090, null, true},
                {"Новый год в санатории", "Праздничная программа с 28 декабря: проживание в люксе, новогодний ужин, процедуры велнес и каток в парке", "Люкс", "WELL", 8, 2900, 2450, "Новогодний", true},
                {"Семейный отдых «Сосновый бор»", "Семейный двухкомнатный номер, детская анимация, бассейн, оздоровительные программы для взрослых и детей", "Семейный двухкомнатный", "WELL", 10, 3400, 2890, "Для семей", true},
                {"Реабилитация после травм", "Восстановление после переломов и операций: механотерапия, магнитотерапия, лазер, мануальная терапия", "Комфорт", "REHAB", 14, 2200, 1880, null, true},
                {"Выходные для двоих", "Три дня отдыха в номере-студии: бассейн, спелеотерапия, массаж, ужин при свечах", "Студия", "WELL", 3, 560, 480, "Акция", false}};
        rows.clear();
        for (Object[] p : packages) {
            rows.add(new Object[]{p[0], p[1], refs.categories().get((String) p[2]), p[2], refs.profiles().get((String) p[3]),
                    DemoCatalog.PROFILES.stream().filter(x -> x.code().equals(p[3])).findFirst().orElseThrow().name(), p[4],
                    BigDecimal.valueOf(((Number) p[5]).doubleValue()), BigDecimal.valueOf(((Number) p[6]).doubleValue()), p[7], p[8], p[0]});
        }
        jdbc.batchUpdate("INSERT INTO sanatorium_packages (name, description, category_id, category_name, profile_id, profile_name, duration_nights, "
                + "base_price, package_price, badge, is_active) SELECT ?, ?, ?, ?, ?, ?, ?, ?, ?, CAST(? AS VARCHAR), ? "
                + "WHERE NOT EXISTS (SELECT 1 FROM sanatorium_packages WHERE name = ?)", rows);
    }

    // ---- служебное ----

    private long count(String table) {
        Long n = jdbc.queryForObject("SELECT COUNT(*) FROM " + table, Long.class);
        return n == null ? 0 : n;
    }

    private long maxId(String table) {
        Long n = jdbc.queryForObject("SELECT COALESCE(MAX(id), 0) FROM " + table, Long.class);
        return n == null ? 0 : n;
    }

    private void resetSequence(String table) {
        jdbc.queryForObject("SELECT setval(pg_get_serial_sequence('" + table + "', 'id'), GREATEST((SELECT COALESCE(MAX(id), 0) FROM "
                + table + "), 1), (SELECT COUNT(*) > 0 FROM " + table + "))", Long.class);
    }
}
