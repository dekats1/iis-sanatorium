package sanatorium.core.demo;

import java.util.Random;

/** Правдоподобные белорусские ФИО, телефоны (+375) и e-mail для демо-клиентов. Детерминированно от переданного Random. */
public final class DemoNames {

    private DemoNames() { }

    public record Person(String last, String first, String middle, boolean female) {
        public String fullName() {
            return last + " " + first + " " + middle;
        }

        /** «Иванова М.П.» */
        public String shortName() {
            return last + " " + first.charAt(0) + "." + middle.charAt(0) + ".";
        }
    }

    private static final String[] SURNAMES = {
            "Иванов", "Смирнов", "Кузнецов", "Попов", "Васильев", "Петров", "Соколов", "Михайлов", "Новиков", "Фёдоров",
            "Морозов", "Волков", "Алексеев", "Лебедев", "Семёнов", "Егоров", "Павлов", "Козлов", "Степанов", "Николаев",
            "Орлов", "Андреев", "Макаров", "Никитин", "Захаров", "Зайцев", "Соловьёв", "Борисов", "Яковлев", "Григорьев",
            "Романов", "Воробьёв", "Сергеев", "Кузьмин", "Фролов", "Александров", "Дмитриев", "Королёв", "Гусев", "Киселёв",
            "Ильин", "Максимов", "Поляков", "Сорокин", "Виноградов", "Белов", "Медведев", "Антонов", "Тарасов", "Жуков",
            "Баранов", "Филиппов", "Комаров", "Давыдов", "Беляев", "Герасимов", "Богданов", "Осипов", "Сидоров", "Матвеев",
            "Титов", "Марков", "Миронов", "Крылов", "Куликов", "Карпов", "Власов", "Мельников", "Денисов", "Гаврилов",
            "Тихонов", "Казаков", "Афанасьев", "Данилов", "Савельев", "Тимофеев", "Фомин", "Чернов", "Абрамов", "Ефимов",
            "Ковалевский", "Савицкий", "Козловский", "Романовский", "Жилинский", "Лисовский", "Рудковский", "Станкевич",
            "Лукашевич", "Мацкевич", "Ковалевич", "Адамович", "Гринкевич", "Прокопович", "Мартинович", "Климович",
            "Ярошевич", "Тишкевич", "Бондаренко", "Левченко", "Шевченко", "Кравченко", "Войтенко", "Кондратенко",
            "Петрушенко", "Сушко", "Мельник", "Шпак", "Цыбульский", "Борисевич", "Зубрицкий", "Хоружий"};

    private static final String[] MALE_FIRST = {
            "Александр", "Сергей", "Андрей", "Дмитрий", "Алексей", "Владимир", "Николай", "Виктор", "Игорь", "Олег",
            "Михаил", "Юрий", "Анатолий", "Павел", "Евгений", "Иван", "Василий", "Пётр", "Геннадий", "Леонид",
            "Валерий", "Роман", "Станислав", "Артём", "Максим", "Константин", "Григорий", "Фёдор", "Вячеслав", "Борис"};

    private static final String[] MALE_PATRONYMIC = {
            "Александрович", "Сергеевич", "Андреевич", "Дмитриевич", "Алексеевич", "Владимирович", "Николаевич", "Викторович",
            "Игоревич", "Олегович", "Михайлович", "Юрьевич", "Анатольевич", "Павлович", "Евгеньевич", "Иванович",
            "Васильевич", "Петрович", "Геннадьевич", "Леонидович", "Валерьевич", "Романович", "Станиславович", "Артёмович",
            "Максимович", "Константинович", "Григорьевич", "Фёдорович", "Вячеславович", "Борисович"};

    private static final String[] FEMALE_FIRST = {
            "Елена", "Ольга", "Татьяна", "Наталья", "Ирина", "Светлана", "Галина", "Людмила", "Марина", "Анна",
            "Мария", "Екатерина", "Валентина", "Нина", "Инна", "Лариса", "Оксана", "Алла", "Вера", "Надежда",
            "Юлия", "Любовь", "Зинаида", "Тамара", "Анжела", "Виктория", "Жанна", "Дарья", "Софья", "Полина"};

    public static Person person(Random rng, boolean female) {
        String base = SURNAMES[rng.nextInt(SURNAMES.length)];
        String patr = MALE_PATRONYMIC[rng.nextInt(MALE_PATRONYMIC.length)];
        if (female) {
            return new Person(feminize(base), FEMALE_FIRST[rng.nextInt(FEMALE_FIRST.length)], femalePatronymic(patr), true);
        }
        return new Person(base, MALE_FIRST[rng.nextInt(MALE_FIRST.length)], patr, false);
    }

    static String feminize(String surname) {
        if (surname.endsWith("ский") || surname.endsWith("цкий") || surname.endsWith("жий")) {
            return surname.substring(0, surname.length() - 2) + "ая";
        }
        if (surname.endsWith("ов") || surname.endsWith("ев") || surname.endsWith("ёв") || surname.endsWith("ин")) {
            return surname + "а";
        }
        return surname; // Лукашевич, Бондаренко, Мельник, Сушко — не изменяются
    }

    static String femalePatronymic(String male) {
        return male.substring(0, male.length() - 2) + "на";
    }

    public static String phone(Random rng) {
        String[] codes = {"29", "33", "44", "25"};
        return String.format("+375 %s %03d-%02d-%02d", codes[rng.nextInt(codes.length)], rng.nextInt(1000), rng.nextInt(100), rng.nextInt(100));
    }

    public static String email(Person p, Random rng) {
        String[] domains = {"gmail.com", "mail.ru", "yandex.by", "tut.by", "bk.ru", "inbox.ru"};
        String local = translit(p.first().substring(0, 1)).toLowerCase() + "." + translit(p.last()).toLowerCase();
        if (rng.nextInt(3) == 0) {
            local += rng.nextInt(90) + 10;
        }
        return local + "@" + domains[rng.nextInt(domains.length)];
    }

    static String translit(String s) {
        String[] map = {"а", "a", "б", "b", "в", "v", "г", "g", "д", "d", "е", "e", "ё", "e", "ж", "zh", "з", "z", "и", "i",
                "й", "y", "к", "k", "л", "l", "м", "m", "н", "n", "о", "o", "п", "p", "р", "r", "с", "s", "т", "t", "у", "u",
                "ф", "f", "х", "h", "ц", "ts", "ч", "ch", "ш", "sh", "щ", "sch", "ъ", "", "ы", "y", "ь", "", "э", "e", "ю", "yu", "я", "ya"};
        StringBuilder sb = new StringBuilder();
        for (char ch : s.toLowerCase().toCharArray()) {
            boolean found = false;
            for (int i = 0; i < map.length; i += 2) {
                if (map[i].charAt(0) == ch) {
                    sb.append(map[i + 1]);
                    found = true;
                    break;
                }
            }
            if (!found) {
                sb.append(ch);
            }
        }
        String r = sb.toString();
        return r.isEmpty() ? r : Character.toUpperCase(r.charAt(0)) + r.substring(1);
    }
}
