package sanatorium.core.demo;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.context.annotation.Profile;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;
import sanatorium.core.client.Client;
import sanatorium.core.client.ClientRepository;
import sanatorium.core.common.ApiException;
import sanatorium.core.common.CoreProperties;
import sanatorium.core.directory.Cabinet;
import sanatorium.core.directory.CabinetRepository;
import sanatorium.core.directory.Diet;
import sanatorium.core.directory.DietRepository;
import sanatorium.core.directory.MedicalCondition;
import sanatorium.core.directory.MedicalConditionRepository;
import sanatorium.core.directory.MedicalProcedure;
import sanatorium.core.directory.MedicalProcedureRepository;
import sanatorium.core.directory.Room;
import sanatorium.core.directory.RoomCategory;
import sanatorium.core.directory.RoomCategoryRepository;
import sanatorium.core.directory.RoomRepository;
import sanatorium.core.directory.SalesChannel;
import sanatorium.core.directory.SalesChannelRepository;
import sanatorium.core.directory.TreatmentProfile;
import sanatorium.core.directory.TreatmentProfileRepository;
import sanatorium.core.ehr.DoctorNote;
import sanatorium.core.ehr.DoctorNoteRepository;
import sanatorium.core.ehr.DoctorVisitType;
import sanatorium.core.ehr.EhrRecord;
import sanatorium.core.ehr.EhrRecordRepository;
import sanatorium.core.identity.Role;
import sanatorium.core.identity.RoleRepository;
import sanatorium.core.identity.UserAccount;
import sanatorium.core.identity.UserRepository;
import sanatorium.core.loyalty.BonusTransaction;
import sanatorium.core.loyalty.BonusTransactionRepository;
import sanatorium.core.loyalty.BonusTransactionType;
import sanatorium.core.loyalty.LoyaltyAccount;
import sanatorium.core.loyalty.LoyaltyAccountRepository;
import sanatorium.core.operations.Consumable;
import sanatorium.core.operations.ConsumableRepository;
import sanatorium.core.operations.SanatoriumPackage;
import sanatorium.core.operations.SanatoriumPackageRepository;
import sanatorium.core.operations.StaffMember;
import sanatorium.core.operations.StaffMemberRepository;
import sanatorium.core.review.GuestReview;
import sanatorium.core.review.GuestReviewRepository;
import sanatorium.core.review.ProcedureFeedback;

/**
 * Демонстрационные данные (профиль demo): категории, номера, справочники, пользователи,
 * отзывы гостей, лояльность, EHR, склад, персонал и пакеты.
 */
@Component
@Profile("demo")
public class DemoDataLoader implements ApplicationRunner {

    private static final Logger log = LoggerFactory.getLogger(DemoDataLoader.class);

    private final UserRepository users;
    private final RoleRepository roles;
    private final ClientRepository clients;
    private final RoomCategoryRepository categories;
    private final RoomRepository rooms;
    private final TreatmentProfileRepository profiles;
    private final DietRepository diets;
    private final SalesChannelRepository channels;
    private final CabinetRepository cabinets;
    private final MedicalProcedureRepository procedures;
    private final MedicalConditionRepository conditions;
    private final GuestReviewRepository reviews;
    private final LoyaltyAccountRepository loyaltyAccounts;
    private final BonusTransactionRepository bonusTransactions;
    private final EhrRecordRepository ehrRecords;
    private final DoctorNoteRepository doctorNotes;
    private final ConsumableRepository consumables;
    private final StaffMemberRepository staffMembers;
    private final SanatoriumPackageRepository packages;
    private final PasswordEncoder encoder;
    private final CoreProperties props;

    public DemoDataLoader(UserRepository users, RoleRepository roles, ClientRepository clients,
                          RoomCategoryRepository categories, RoomRepository rooms, TreatmentProfileRepository profiles,
                          DietRepository diets, SalesChannelRepository channels, CabinetRepository cabinets,
                          MedicalProcedureRepository procedures, MedicalConditionRepository conditions,
                          GuestReviewRepository reviews,
                          LoyaltyAccountRepository loyaltyAccounts,
                          BonusTransactionRepository bonusTransactions,
                          EhrRecordRepository ehrRecords,
                          DoctorNoteRepository doctorNotes,
                          ConsumableRepository consumables,
                          StaffMemberRepository staffMembers,
                          SanatoriumPackageRepository packages,
                          PasswordEncoder encoder, CoreProperties props) {
        this.users = users;
        this.roles = roles;
        this.clients = clients;
        this.categories = categories;
        this.rooms = rooms;
        this.profiles = profiles;
        this.diets = diets;
        this.channels = channels;
        this.cabinets = cabinets;
        this.procedures = procedures;
        this.conditions = conditions;
        this.reviews = reviews;
        this.loyaltyAccounts = loyaltyAccounts;
        this.bonusTransactions = bonusTransactions;
        this.ehrRecords = ehrRecords;
        this.doctorNotes = doctorNotes;
        this.consumables = consumables;
        this.staffMembers = staffMembers;
        this.packages = packages;
        this.encoder = encoder;
        this.props = props;
    }

    @Override
    @Transactional
    public void run(ApplicationArguments args) {
        Client client = null;
        if (users.count() == 0) {
            String hash = encoder.encode(props.demo().password());
            user("admin", "Администратор бронирования", "BOOKING_ADMIN", hash);
            user("doctor", "Врач", "DOCTOR", hash);
            user("manager", "Менеджер по доходам", "MANAGER", hash);
            user("sysadmin", "Системный администратор", "SYSADMIN", hash);
            UserAccount clientUser = user("client", "Иванов Иван", "CLIENT", hash);
            client = new Client("Иванов", "Иван", LocalDate.of(1975, 3, 14));
            client.setUserId(clientUser.getId());
            client = clients.save(client);

            categories.save(new RoomCategory("Стандарт", 2));
            categories.save(new RoomCategory("Комфорт", 2));
            categories.save(new RoomCategory("Люкс", 3));
            categories.flush();
            int[][] plan = {{1, 1, 5}, {2, 2, 4}, {3, 3, 2}};
            for (int[] p : plan) {
                for (int i = 1; i <= p[2]; i++) {
                    rooms.save(new Room(p[0], String.valueOf(p[0] * 100 + i), p[1]));
                }
            }
            TreatmentProfile nerv = profiles.save(new TreatmentProfile("NERV", "Нервная система"));
            TreatmentProfile msk = profiles.save(new TreatmentProfile("MSK", "Опорно-двигательный аппарат"));
            seedMedical(nerv, msk);
            diets.save(new Diet("D9", "Стол № 9"));
            diets.save(new Diet("D5", "Стол № 5"));
            channels.save(new SalesChannel("Прямые продажи", BigDecimal.ZERO));
            channels.save(new SalesChannel("Туроператор", BigDecimal.TEN));
            log.info("Демо-данные загружены (пользователи: admin, doctor, manager, sysadmin, client)");
        } else {
            client = clients.findAll().stream().findFirst().orElse(null);
        }

        if (client != null) {
            if (reviews.count() == 0) {
                seedReviews(client);
                log.info("Демо-отзывы качества и NPS успешно загружены");
            }
            seedOperationsAndHealth(client);
            log.info("Демо-данные лояльности, EHR, склада и персонала успешно загружены");
        }
    }

    private UserAccount user(String username, String fullName, String roleCode, String hash) {
        Role role = roles.findByCode(roleCode)
                .orElseThrow(() -> ApiException.badGateway("Справочник ролей не заполнен: " + roleCode));
        UserAccount u = new UserAccount(username, hash, fullName, null);
        u.getRoles().add(role);
        return users.saveAndFlush(u);
    }

    private void seedMedical(TreatmentProfile nerv, TreatmentProfile msk) {
        Cabinet physio = cabinets.save(new Cabinet("Физиотерапия", 8));
        Cabinet baths = cabinets.save(new Cabinet("Ванны", 6));
        Cabinet massage = cabinets.save(new Cabinet("Массаж", 6));
        MedicalCondition hypertension = conditions.save(new MedicalCondition("HYPERTENSION", "Гипертоническая болезнь"));
        conditions.save(new MedicalCondition("DIABETES", "Сахарный диабет"));
        conditions.save(new MedicalCondition("ARRHYTHMIA", "Нарушения ритма сердца"));
        procedure("Жемчужные ванны", 20, baths, nerv, msk, null);
        procedure("Лечебный массаж", 30, massage, nerv, msk, null);
        procedure("Электрофорез", 15, physio, nerv, msk, null);
        procedure("Парафинолечение", 25, physio, nerv, msk, hypertension);
    }

    private void procedure(String name, int minutes, Cabinet cabinet, TreatmentProfile a, TreatmentProfile b,
                           MedicalCondition contraindication) {
        MedicalProcedure p = new MedicalProcedure(name, minutes, cabinet.getId());
        p.getProfileIds().add(a.getId());
        p.getProfileIds().add(b.getId());
        if (contraindication != null) {
            p.getContraindicationIds().add(contraindication.getId());
        }
        procedures.save(p);
    }

    private void seedReviews(Client client) {
        Long cid = client.getId();

        GuestReview r1 = new GuestReview();
        r1.setClientId(cid);
        r1.setClientName("Иванова Мария Петровна");
        r1.setCategoryName("Стандарт");
        r1.setRoomNumber("101");
        r1.setStayDates("2026-09-10 — 2026-09-24");
        r1.setOverallRating(5);
        r1.setNpsScore(10);
        r1.setRoomRating(5);
        r1.setTreatmentRating(5);
        r1.setFoodRating(5);
        r1.setServiceRating(5);
        r1.setComment("Великолепный оздоровительный отдых! Процедуры подобраны идеально, в номере идеальная чистота и прекрасный вид на парковую аллею. Обязательно приеду снова!");
        r1.setReplyText("Уважаемая Мария Петровна! Благодарим за тёплые слова и высокую оценку. Будем рады видеть вас снова!");
        r1.setRepliedAt(OffsetDateTime.now().minusDays(20));
        r1.setReplierName("Главный врач Воронова С.М.");
        r1.setCreatedAt(OffsetDateTime.now().minusDays(21));
        r1.getProcedureFeedbacks().add(new ProcedureFeedback(r1, "Жемчужные ванны", 5, "Давление пришло в норму уже на 4-й день"));
        r1.getProcedureFeedbacks().add(new ProcedureFeedback(r1, "Электрофорез", 5, "Очень расслабляет, прекрасный сон"));
        reviews.save(r1);

        GuestReview r2 = new GuestReview();
        r2.setClientId(cid);
        r2.setClientName("Смирнов Алексей Викторович");
        r2.setCategoryName("Люкс");
        r2.setRoomNumber("301");
        r2.setStayDates("2026-09-15 — 2026-09-28");
        r2.setOverallRating(5);
        r2.setNpsScore(10);
        r2.setRoomRating(5);
        r2.setTreatmentRating(5);
        r2.setFoodRating(4);
        r2.setServiceRating(5);
        r2.setComment("Прекрасный люкс с панорамой на озеро Дикое. Оздоровительный курс позволил полностью восстановить спину. Спасибо медицинскому коллективу!");
        r2.setReplyText("Алексей Викторович, спасибо за доверие! Передали благодарность массажисту Виктору.");
        r2.setRepliedAt(OffsetDateTime.now().minusDays(15));
        r2.setReplierName("Служба заботы о гостях");
        r2.setCreatedAt(OffsetDateTime.now().minusDays(16));
        r2.getProcedureFeedbacks().add(new ProcedureFeedback(r2, "Лечебный массаж", 5, "Массажист Виктор — специалист с золотыми руками"));
        r2.getProcedureFeedbacks().add(new ProcedureFeedback(r2, "Жемчужные ванны", 5, "Природная минеральная вода очень помогла"));
        reviews.save(r2);

        GuestReview r3 = new GuestReview();
        r3.setClientId(cid);
        r3.setClientName("Кузнецов Евгений Дмитриевич");
        r3.setCategoryName("Комфорт");
        r3.setRoomNumber("202");
        r3.setStayDates("2026-10-01 — 2026-10-14");
        r3.setOverallRating(4);
        r3.setNpsScore(8);
        r3.setRoomRating(4);
        r3.setTreatmentRating(5);
        r3.setFoodRating(4);
        r3.setServiceRating(4);
        r3.setComment("Хороший санаторий, чистейший воздух соснового бора. Номер комфортный, хотя хотелось бы чуть больше розеток около рабочего стола.");
        r3.setReplyText("Евгений Дмитриевич, благодарим за конструктивное замечание! Добавили удлинители и USB-хабы в номера.");
        r3.setRepliedAt(OffsetDateTime.now().minusDays(8));
        r3.setReplierName("Руководитель номерного фонда");
        r3.setCreatedAt(OffsetDateTime.now().minusDays(9));
        r3.getProcedureFeedbacks().add(new ProcedureFeedback(r3, "Электрофорез", 4, "Полезно"));
        r3.getProcedureFeedbacks().add(new ProcedureFeedback(r3, "Парафинолечение", 5, "Суставы перестали болеть"));
        reviews.save(r3);

        GuestReview r4 = new GuestReview();
        r4.setClientId(cid);
        r4.setClientName("Ковалёва Ирина Борисовна");
        r4.setCategoryName("Люкс");
        r4.setRoomNumber("302");
        r4.setStayDates("2026-10-05 — 2026-10-18");
        r4.setOverallRating(5);
        r4.setNpsScore(10);
        r4.setRoomRating(5);
        r4.setTreatmentRating(5);
        r4.setFoodRating(5);
        r4.setServiceRating(5);
        r4.setComment("Люкс превзошел все ожидания! Терраса с видом на золотую осень и персональное внимание врачей сделали отдых незабываемым.");
        r4.setCreatedAt(OffsetDateTime.now().minusDays(5));
        r4.getProcedureFeedbacks().add(new ProcedureFeedback(r4, "Парафинолечение", 5, "Очень эффективная процедура"));
        r4.getProcedureFeedbacks().add(new ProcedureFeedback(r4, "Лечебный массаж", 5, "Профессионально и бережно"));
        reviews.save(r4);

        GuestReview r5 = new GuestReview();
        r5.setClientId(cid);
        r5.setClientName("Соколова Ольга Игоревна");
        r5.setCategoryName("Стандарт");
        r5.setRoomNumber("103");
        r5.setStayDates("2026-10-10 — 2026-10-22");
        r5.setOverallRating(3);
        r5.setNpsScore(6);
        r5.setRoomRating(3);
        r5.setTreatmentRating(4);
        r5.setFoodRating(4);
        r5.setServiceRating(4);
        r5.setComment("Лечение качественное, но Wi-Fi пару вечеров работал с перебоями, мешая онлайн-звонкам по работе. В остальном персонал очень заботливый.");
        r5.setReplyText("Ольга Игоревна, приносим извинения за неудобства со связью! Установили дополнительную mesh-точку Wi-Fi 100 Мбит/с.");
        r5.setRepliedAt(OffsetDateTime.now().minusDays(2));
        r5.setReplierName("Служба заботы о гостях");
        r5.setCreatedAt(OffsetDateTime.now().minusDays(3));
        r5.getProcedureFeedbacks().add(new ProcedureFeedback(r5, "Электрофорез", 4, null));
        reviews.save(r5);
    }

    private void seedOperationsAndHealth(Client client) {
        Long cid = client.getId();

        // 1. Loyalty
        if (loyaltyAccounts.findByClientId(cid).isEmpty()) {
            LoyaltyAccount la = new LoyaltyAccount(cid, 250, BigDecimal.valueOf(1400.00));
            loyaltyAccounts.save(la);
            bonusTransactions.save(new BonusTransaction(cid, 100, BonusTransactionType.WELCOME, "Приветственный бонус нового гостя", null));
            bonusTransactions.save(new BonusTransaction(cid, 150, BonusTransactionType.EARN, "Кэшбэк за оплату путевки", null));
        }

        // 2. EHR
        if (ehrRecords.findByClientId(cid).isEmpty()) {
            EhrRecord ehr = new EhrRecord(cid);
            ehr.setSanatoriumCardNumber("СКК-2026/001");
            ehr.setBloodType("A (II) Rh+");
            ehr.setAllergies("Пенициллиновый ряд (лёгкая крапивница)");
            ehr.setChronicDiseases("Остеохондроз пояснично-крестцового отдела позвоночника");
            ehr.setHeightCm(178);
            ehr.setWeightKg(BigDecimal.valueOf(74.5));
            ehr.setBloodPressureSystolic(120);
            ehr.setBloodPressureDiastolic(80);
            ehr.setPulse(68);
            ehrRecords.save(ehr);

            UserAccount doc = users.findByUsername("doctor").orElse(null);
            Long docId = doc != null ? doc.getId() : 2L;
            doctorNotes.save(new DoctorNote(
                    cid,
                    docId,
                    "Др. Воронова С.М. (Главный врач / Терапевт)",
                    DoctorVisitType.INITIAL,
                    "Жалобы на периодические ноющие боли в пояснице после длительного сидения за компьютером",
                    "Состояние удовлетворительное. ЧСС 68 уд/мин, АД 120/80 мм рт. ст. Тоны сердца ясные, ритмичные",
                    "Рекомендован оздоровительный курс: минеральные ванны, массаж спины, ЛФК в бассейне"
            ));
        }

        // 3. Consumables
        if (consumables.count() == 0) {
            consumables.save(new Consumable("MED-MUD-01", "Сакская лечебная грязь (очищенная)", "Бальнеология", 2, "Кабинет грязелечения №2", "кг", BigDecimal.valueOf(145), BigDecimal.valueOf(30)));
            consumables.save(new Consumable("MED-PAR-02", "Парафин медицинский П-2", "Физиотерапия", 1, "Кабинет парафинолечения №1", "кг", BigDecimal.valueOf(65), BigDecimal.valueOf(20)));
            consumables.save(new Consumable("MED-SALT-03", "Морская соль Сакского озера", "Бальнеология", 2, "Кабинет ванн №3", "кг", BigDecimal.valueOf(210), BigDecimal.valueOf(50)));
            consumables.save(new Consumable("MED-OIL-04", "Массажное масло натуральное пихтовое", "Массаж", 3, "Кабинет массажа №4", "л", BigDecimal.valueOf(18), BigDecimal.valueOf(5)));
            consumables.save(new Consumable("MED-HERB-05", "Фиточай сбор «Витаминный общеукрепляющий»", "Фитобар", null, "Фитобар главного корпуса", "упак", BigDecimal.valueOf(320), BigDecimal.valueOf(40)));
        }

        // 4. Staff
        if (staffMembers.count() == 0) {
            staffMembers.save(new StaffMember("Др. Воронова Светлана Михайловна", "Главный врач, терапевт", "Кабинет №101", "08:00 – 16:30", "ON_SHIFT", 8, 16, BigDecimal.valueOf(4.98)));
            staffMembers.save(new StaffMember("Виктор Сергеевич Мельников", "Массажист высшей категории", "Кабинет массажа №4", "08:30 – 17:00", "ON_SHIFT", 12, 14, BigDecimal.valueOf(4.95)));
            staffMembers.save(new StaffMember("Ирина Павловна Зайцева", "Медсестра бальнеотерапии", "Водолечебница (Ванны)", "08:00 – 16:00", "ON_SHIFT", 14, 18, BigDecimal.valueOf(4.88)));
            staffMembers.save(new StaffMember("Др. Ковалев Дмитрий Игоревич", "Врач-физиотерапевт", "Кабинет физиотерапии №1", "09:00 – 17:30", "BREAK", 6, 15, BigDecimal.valueOf(4.90)));
        }

        // 5. Packages
        if (packages.count() == 0) {
            packages.save(new SanatoriumPackage(
                    "Здоровое сердце и сосуды",
                    "Комплексный 14-дневный курс кардио-реабилитации: сухие углекислые ванны, спелеотерапия, массаж и диетстол №10",
                    1, "Стандарт",
                    1, "Нервная система",
                    14,
                    BigDecimal.valueOf(1680.00), BigDecimal.valueOf(1420.00),
                    "Хит сезона"
            ));
            packages.save(new SanatoriumPackage(
                    "Свободное движение (Здоровые суставы)",
                    "Интенсивная терапия опорно-двигательного аппарата: лечебные сакские грязи, подводный душ-массаж, озокеритолечение",
                    2, "Комфорт",
                    2, "Опорно-двигательный аппарат",
                    12,
                    BigDecimal.valueOf(1850.00), BigDecimal.valueOf(1580.00),
                    "Выбор врачей"
            ));
            packages.save(new SanatoriumPackage(
                    "Антистресс & Релакс Weekend",
                    "Экспресс-восстановление жизненных сил: фитованны, жемчужные ванны, аромамассаж и кислородные коктейли",
                    3, "Люкс",
                    1, "Нервная система",
                    7,
                    BigDecimal.valueOf(1350.00), BigDecimal.valueOf(1190.00),
                    "Премиум"
            ));
        }
    }
}
