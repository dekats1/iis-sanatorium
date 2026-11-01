package sanatorium.core.medical;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * Планирование расписания процедур с учётом пропускной способности кабинетов (ФТ-13, алгоритм раздела 3.7).
 * Чистая функция: данные о занятости передаются параметрами, БД не используется.
 *
 * <p>Модель: рабочий день длится dayMinutes минут и делится на slotsPerDay равных слотов кабинета
 * (длина слота = dayMinutes / slotsPerDay, целочисленно). Жадный проход: процедуры в порядке запроса, дни по возрастанию;
 * в день — не более одного сеанса одной процедуры; берётся первый слот, свободный в кабинете, и не пересекающийся
 * по времени с другими сеансами этого пациента (в том числе в других кабинетах).
 * Сеансы, которым не нашлось места в срок пребывания, возвращаются в unplaced — решение остаётся за врачом.
 */
public final class SlotPlanner {

    private SlotPlanner() { }

    /** Запрос: сколько сеансов процедуры нужно разместить и в каком кабинете. */
    public record Request(int procedureId, int cabinetId, int slotsPerDay, int sessions) { }

    /** Размещённый сеанс; startMinute — минуты от начала рабочего дня. */
    public record Slot(int procedureId, int cabinetId, LocalDate date, int slotIndex, int startMinute) { }

    public record Plan(List<Slot> slots, Map<Integer, Integer> unplaced) { }

    /** Занятый интервал времени пациента [start; end) в минутах от начала рабочего дня. */
    public record Interval(int start, int end) {
        boolean overlaps(int s, int e) {
            return s < end && start < e;
        }
    }

    public static Plan plan(List<LocalDate> days, List<Request> requests, int dayMinutes,
                            Map<Integer, Map<LocalDate, Set<Integer>>> cabinetBusy,
                            Map<LocalDate, List<Interval>> patientBusy) {
        // копии: вызывающий код не должен видеть изменения
        Map<Integer, Map<LocalDate, Set<Integer>>> busy = new HashMap<>();
        cabinetBusy.forEach((c, byDay) -> {
            Map<LocalDate, Set<Integer>> copy = new HashMap<>();
            byDay.forEach((d, s) -> copy.put(d, new HashSet<>(s)));
            busy.put(c, copy);
        });
        Map<LocalDate, List<Interval>> mine = new HashMap<>();
        patientBusy.forEach((d, l) -> mine.put(d, new ArrayList<>(l)));

        List<Slot> slots = new ArrayList<>();
        Map<Integer, Integer> unplaced = new LinkedHashMap<>();

        for (Request req : requests) {
            if (req.slotsPerDay() <= 0 || dayMinutes / req.slotsPerDay() <= 0) {
                throw new IllegalArgumentException("Некорректная ёмкость кабинета " + req.cabinetId());
            }
            int len = dayMinutes / req.slotsPerDay();
            int left = req.sessions();
            for (LocalDate day : days) {
                if (left == 0) {
                    break;
                }
                Set<Integer> cab = busy.computeIfAbsent(req.cabinetId(), k -> new HashMap<>())
                        .computeIfAbsent(day, k -> new HashSet<>());
                List<Interval> my = mine.computeIfAbsent(day, k -> new ArrayList<>());
                for (int idx = 0; idx < req.slotsPerDay(); idx++) {
                    int start = idx * len;
                    int end = start + len;
                    if (cab.contains(idx) || my.stream().anyMatch(i -> i.overlaps(start, end))) {
                        continue;
                    }
                    cab.add(idx);
                    my.add(new Interval(start, end));
                    slots.add(new Slot(req.procedureId(), req.cabinetId(), day, idx, start));
                    left--;
                    break; // не более одного сеанса процедуры в день
                }
            }
            if (left > 0) {
                unplaced.merge(req.procedureId(), left, Integer::sum);
            }
        }
        return new Plan(slots, unplaced);
    }
}
