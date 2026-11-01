package sanatorium.core.demo;

import java.util.ArrayList;
import java.util.List;

/**
 * Статические справочники демо-санатория (Беларусь): категории, номера по корпусам, лечебные профили, кабинеты,
 * процедуры с противопоказаниями, диеты, каналы продаж, организации. Чистые данные без зависимостей — их используют
 * и загрузчик (вставка в БД), и генератор (согласованные ссылки), и тесты.
 */
public final class DemoCatalog {

    private DemoCatalog() { }

    public static final String BUILDING_A = "Главный спальный корпус";
    public static final String BUILDING_B = "Лечебно-оздоровительный корпус";
    public static final String BUILDING_C = "Корпус «Сосновый бор»";

    /** basePrice — тариф BYN за место-сутки (как в pricing-forecast cli seed); weight — относительный спрос. */
    public record Category(String name, int capacity, String description, double basePrice, double weight) { }

    /** Порядок = порядок id на чистой БД (V5 создаёт первые пять, «Студия» добавляется загрузчиком). */
    public static final List<Category> CATEGORIES = List.of(
            new Category("Стандарт", 2, "Уютный двухместный номер с душевой кабиной", 85, 1.0),
            new Category("Комфорт", 2, "Улучшенный двухместный номер с кондиционером и балконом или лоджией", 115, 1.0),
            new Category("Люкс", 3, "Просторный номер с гостиной зоной и панорамным видом", 165, 0.8),
            new Category("Семейный двухкомнатный", 4, "Просторный двухкомнатный номер для семейного отдыха с детьми", 130, 0.7),
            new Category("Президентский сюит", 3, "Премиальный номер высшей категории с персональной террасой и финской сауной", 260, 0.45),
            new Category("Студия", 2, "Номер-студия с кухонной зоной для длительного проживания", 105, 0.9));

    public static int categoryIndex(String name) {
        for (int i = 0; i < CATEGORIES.size(); i++) {
            if (CATEGORIES.get(i).name().equals(name)) {
                return i;
            }
        }
        throw new IllegalArgumentException(name);
    }

    public record RoomSpec(String number, int floor, String building, int category, String view, String amenities) { }

    private static final String[] VIEWS = {"Парковая аллея", "Сосновый бор", "Внутренний сад и фонтан", "Озеро Дикое", "Лесопарк"};

    private static final String[] AMENITIES = {
            "Wi-Fi, Телевизор, Холодильник, Душевая кабина",
            "Wi-Fi, Кондиционер, Телевизор, Сейф, Лоджия",
            "Wi-Fi 100 Мб/с, Кондиционер, Гостиная, Терраса, Халаты, Мини-бар",
            "Wi-Fi, Кондиционер, Две спальни, Балкон, Кухонный уголок, Детская кроватка по запросу",
            "Wi-Fi 100 Мб/с, Индивидуальный кондиционер, Терраса 25 кв.м, Сауна в номере, Джакузи",
            "Wi-Fi, Кондиционер, Кухонная зона, Рабочий стол, Стиральная машина"};

    /** 90 номеров: корпус А — 36, корпус Б — 30, корпус В — 24. Нумерация корпусов Б и В с буквенным префиксом. */
    public static final List<RoomSpec> ROOMS = buildRooms();

    private static List<RoomSpec> buildRooms() {
        List<RoomSpec> list = new ArrayList<>();
        // категории: 0 Стандарт, 1 Комфорт, 2 Люкс, 3 Семейный, 4 Президентский, 5 Студия
        addFloor(list, BUILDING_A, "", 1, 0, 12);
        addFloor(list, BUILDING_A, "", 2, 0, 6, 1, 6);
        addFloor(list, BUILDING_A, "", 3, 1, 12);
        addFloor(list, BUILDING_B, "Б", 1, 0, 6, 5, 4);
        addFloor(list, BUILDING_B, "Б", 2, 1, 6, 5, 4);
        addFloor(list, BUILDING_B, "Б", 3, 2, 6, 1, 4);
        addFloor(list, BUILDING_C, "В", 1, 3, 8, 1, 4);
        addFloor(list, BUILDING_C, "В", 2, 2, 6, 4, 4, 3, 2);
        return List.copyOf(list);
    }

    /** runs: пары (категория, количество) подряд по этажу; номер = префикс + этаж*100 + порядковый. */
    private static void addFloor(List<RoomSpec> list, String building, String prefix, int floor, int... runs) {
        int k = 0;
        for (int r = 0; r + 1 < runs.length; r += 2) {
            for (int i = 0; i < runs[r + 1]; i++) {
                k++;
                int cat = runs[r];
                String view = VIEWS[(k + floor) % VIEWS.length];
                list.add(new RoomSpec(prefix + (floor * 100 + k), floor, building, cat, view, AMENITIES[cat]));
            }
        }
    }

    public record Profile(String code, String name) { }

    public static final List<Profile> PROFILES = List.of(
            new Profile("NERV", "Нервная система"),
            new Profile("MSK", "Опорно-двигательный аппарат"),
            new Profile("CARDIO", "Сердечно-сосудистая система"),
            new Profile("RESP", "Органы дыхания"),
            new Profile("GIT", "Органы пищеварения"),
            new Profile("ENDO", "Эндокринная система и обмен веществ"),
            new Profile("WELL", "Оздоровительный (велнес и антистресс)"),
            new Profile("REHAB", "Реабилитация после травм и операций"));

    public record Cabinet(String name, int slotsPerDay) { }

    public static final List<Cabinet> CABINETS = List.of(
            new Cabinet("Физиотерапия", 8),
            new Cabinet("Физиотерапия №2", 16),
            new Cabinet("Ванны", 12),
            new Cabinet("Ванны №2", 12),
            new Cabinet("Грязелечение", 10),
            new Cabinet("Массаж", 12),
            new Cabinet("Массаж №2", 12),
            new Cabinet("Массаж №3", 12),
            new Cabinet("Ингаляторий", 16),
            new Cabinet("Зал ЛФК", 8),
            new Cabinet("Спелеотерапия (соляная пещера)", 8),
            new Cabinet("Парафино-озокеритолечение", 12),
            new Cabinet("Фитобар", 16),
            new Cabinet("Иглорефлексотерапия", 8),
            new Cabinet("Бассейн", 12),
            new Cabinet("Кабинет релаксации", 8));

    public static int cabinetIndex(String name) {
        for (int i = 0; i < CABINETS.size(); i++) {
            if (CABINETS.get(i).name().equals(name)) {
                return i;
            }
        }
        throw new IllegalArgumentException(name);
    }

    public record Condition(String code, String name) { }

    public static final List<Condition> CONDITIONS = List.of(
            new Condition("HYPERTENSION", "Гипертоническая болезнь"),
            new Condition("DIABETES", "Сахарный диабет"),
            new Condition("ARRHYTHMIA", "Нарушения ритма сердца"),
            new Condition("HEART_FAIL", "Сердечная недостаточность II–III ст."),
            new Condition("THROMBO", "Тромбофлебит, склонность к тромбозам"),
            new Condition("ASTHMA", "Бронхиальная астма (тяжёлое течение)"),
            new Condition("TBC", "Туберкулёз (активная форма)"),
            new Condition("EPILEPSY", "Эпилепсия"),
            new Condition("ONCOLOGY", "Онкологические заболевания (менее 5 лет после лечения)"),
            new Condition("PREGNANCY", "Беременность"),
            new Condition("GLAUCOMA", "Глаукома"),
            new Condition("ULCER_ACUTE", "Язвенная болезнь в стадии обострения"),
            new Condition("KIDNEY_STONES", "Мочекаменная болезнь (крупные конкременты)"),
            new Condition("SKIN_ACUTE", "Острые кожные заболевания"),
            new Condition("FEVER", "Острые инфекционные заболевания, лихорадка"),
            new Condition("THYROID", "Гипертиреоз"));

    /** Процедура: профили и противопоказания — коды. */
    public record Procedure(String name, int minutes, String cabinet, String[] profiles, String[] contra) { }

    private static Procedure p(String name, int min, String cabinet, String profiles, String contra) {
        return new Procedure(name, min, cabinet, profiles.isBlank() ? new String[0] : profiles.split(","),
                contra.isBlank() ? new String[0] : contra.split(","));
    }

    public static final List<Procedure> PROCEDURES = List.of(
            // четыре исходные процедуры сохраняют названия прежнего демо
            p("Жемчужные ванны", 20, "Ванны", "NERV,MSK,CARDIO,WELL,REHAB", "HEART_FAIL,FEVER"),
            p("Лечебный массаж", 30, "Массаж", "NERV,MSK,WELL,REHAB,CARDIO", "FEVER,THROMBO,SKIN_ACUTE"),
            p("Электрофорез", 15, "Физиотерапия", "NERV,MSK,GIT,REHAB", "SKIN_ACUTE"),
            p("Парафинолечение", 25, "Парафино-озокеритолечение", "NERV,MSK,REHAB", "HYPERTENSION,SKIN_ACUTE,THROMBO"),
            p("Хвойные ванны", 20, "Ванны №2", "NERV,CARDIO,WELL", "HEART_FAIL,FEVER,SKIN_ACUTE"),
            p("Углекислые ванны", 15, "Ванны", "CARDIO,MSK,ENDO", "HEART_FAIL,ARRHYTHMIA,ASTHMA"),
            p("Сероводородные ванны", 15, "Ванны №2", "MSK,ENDO,REHAB", "HYPERTENSION,HEART_FAIL,ASTHMA,PREGNANCY"),
            p("Йодобромные ванны", 20, "Ванны №2", "ENDO,MSK,NERV", "THYROID,PREGNANCY,TBC"),
            p("Подводный душ-массаж", 20, "Ванны", "MSK,ENDO,WELL,REHAB", "THROMBO,HEART_FAIL,PREGNANCY"),
            p("Душ Шарко", 10, "Ванны №2", "NERV,ENDO,WELL", "HYPERTENSION,HEART_FAIL,PREGNANCY"),
            p("Грязевые аппликации", 25, "Грязелечение", "MSK,GIT,REHAB", "HYPERTENSION,ONCOLOGY,HEART_FAIL,PREGNANCY,THYROID"),
            p("Озокеритолечение", 25, "Парафино-озокеритолечение", "MSK,NERV,REHAB", "HYPERTENSION,SKIN_ACUTE,ONCOLOGY"),
            p("Магнитотерапия", 20, "Физиотерапия", "MSK,NERV,CARDIO,REHAB", "PREGNANCY,ONCOLOGY"),
            p("Лазеротерапия", 15, "Физиотерапия №2", "MSK,NERV,REHAB", "ONCOLOGY,PREGNANCY,THYROID"),
            p("Ультразвуковая терапия", 15, "Физиотерапия №2", "MSK,GIT,REHAB", "ONCOLOGY,PREGNANCY"),
            p("Диадинамотерапия", 15, "Физиотерапия", "MSK,NERV,REHAB", "PREGNANCY,EPILEPSY"),
            p("Амплипульс-терапия", 15, "Физиотерапия №2", "MSK,GIT,NERV", "PREGNANCY,ARRHYTHMIA"),
            p("Дарсонвализация", 10, "Физиотерапия №2", "NERV,MSK,WELL", "EPILEPSY,ONCOLOGY"),
            p("УФО-облучение", 10, "Физиотерапия №2", "RESP,WELL,MSK", "ONCOLOGY,SKIN_ACUTE,TBC,THYROID"),
            p("Щелочные ингаляции", 15, "Ингаляторий", "RESP,WELL", "FEVER"),
            p("Галоингаляции", 20, "Ингаляторий", "RESP", "TBC,ASTHMA"),
            p("Спелеотерапия", 40, "Спелеотерапия (соляная пещера)", "RESP,WELL", "TBC,FEVER,ASTHMA"),
            p("Кислородный коктейль", 10, "Фитобар", "WELL,CARDIO,RESP,GIT", ""),
            p("Фитотерапия (травяной чай)", 10, "Фитобар", "WELL,GIT,NERV", ""),
            p("Питьевое лечение минеральной водой", 10, "Фитобар", "GIT,ENDO", "ULCER_ACUTE,KIDNEY_STONES"),
            p("Лечебная физкультура (группа)", 40, "Зал ЛФК", "MSK,CARDIO,NERV,ENDO,REHAB", "HEART_FAIL"),
            p("Скандинавская ходьба", 40, "Зал ЛФК", "CARDIO,WELL,ENDO", "HEART_FAIL,ARRHYTHMIA"),
            p("Механотерапия", 30, "Зал ЛФК", "MSK,REHAB", "THROMBO"),
            p("Аквааэробика в бассейне", 30, "Бассейн", "MSK,CARDIO,WELL,NERV,REHAB", "SKIN_ACUTE,FEVER,EPILEPSY"),
            p("Иглорефлексотерапия", 30, "Иглорефлексотерапия", "NERV,MSK,WELL", "ONCOLOGY,PREGNANCY,EPILEPSY"),
            p("Мануальная терапия", 30, "Массаж №3", "MSK,REHAB", "ONCOLOGY,THROMBO"),
            p("Аромамассаж", 40, "Массаж №2", "WELL,NERV", "FEVER,SKIN_ACUTE"),
            p("Массаж воротниковой зоны", 20, "Массаж №2", "NERV,MSK,CARDIO", "FEVER,THROMBO"),
            p("Лимфодренажный массаж ног", 30, "Массаж №3", "CARDIO,ENDO,WELL", "THROMBO,FEVER"),
            p("Сухие углекислые ванны", 20, "Ванны", "CARDIO,RESP,ENDO", "ASTHMA,TBC"),
            p("Релаксация в сенсорной комнате", 30, "Кабинет релаксации", "NERV,WELL", "EPILEPSY"));

    public record Diet(String code, String name) { }

    public static final List<Diet> DIETS = List.of(
            new Diet("D9", "Стол № 9"),
            new Diet("D5", "Стол № 5"),
            new Diet("D1", "Стол № 1"),
            new Diet("D10", "Стол № 10"),
            new Diet("D8", "Стол № 8"),
            new Diet("D15", "Общий стол № 15"),
            new Diet("VEG", "Вегетарианское питание"));

    /** weight — доля продаж в генераторе. */
    public record Channel(String name, double commissionPct, Integer quota, double weight) { }

    public static final List<Channel> CHANNELS = List.of(
            new Channel("Прямые продажи", 0, null, 20),
            new Channel("Туроператор", 10, 40, 14),
            new Channel("Официальный сайт", 0, null, 27),
            new Channel("Колл-центр", 0, null, 12),
            new Channel("Турагентства", 12, 30, 10),
            new Channel("Корпоративные клиенты", 7, 24, 9),
            new Channel("Онлайн-агрегаторы", 15, 20, 8));

    public record Org(String name, String contractNo) { }

    public static final List<Org> ORGS = List.of(
            new Org("ОАО «Гомельстройдеталь»", "Д-2025/014"),
            new Org("ЗАО «Минскмебель Групп»", "Д-2025/021"),
            new Org("ООО «Полесье-Агро»", "Д-2025/033"),
            new Org("ТУП «Белтурсервис-Брест»", "Д-2024/102"),
            new Org("Профсоюз работников образования Минской области", "Д-2025/047"),
            new Org("ОАО «Могилёвлифтмаш-сервис»", "Д-2025/058"),
            new Org("Брестское областное объединение профсоюзов", "Д-2024/119"),
            new Org("ЧУП «Новополоцкая энергетическая компания»", "Д-2026/006"));
}
