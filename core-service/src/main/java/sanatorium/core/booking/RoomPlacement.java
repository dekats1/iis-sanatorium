package sanatorium.core.booking;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

/**
 * Подбор номера под путёвку (СЦ-1). Чистая функция без обращения к БД.
 *
 * <p>Правило: все места одной брони размещаются в ОДНОМ номере (одна запись bookings = один room_id,
 * см. составной внешний ключ booking_places → bookings(id, room_id) в главе 2). Из подходящих номеров
 * берётся тот, где свободных мест меньше всего (best-fit), чтобы не дробить крупные номера и не
 * оставлять «одиночные» места, — ограничение метода: дробление брони по нескольким номерам не выполняется.
 * При равенстве выбирается номер с меньшим id (детерминированность).
 */
public final class RoomPlacement {

    private RoomPlacement() { }

    public static Optional<Placement> choose(List<FreePlace> free, int places) {
        if (places <= 0) {
            throw new IllegalArgumentException("places must be positive");
        }
        Map<Integer, List<Integer>> byRoom = new LinkedHashMap<>();
        for (FreePlace fp : free) {
            byRoom.computeIfAbsent(fp.roomId(), k -> new ArrayList<>()).add(fp.placeNo());
        }
        Integer bestRoom = null;
        int bestFree = Integer.MAX_VALUE;
        for (Map.Entry<Integer, List<Integer>> e : byRoom.entrySet()) {
            int n = e.getValue().size();
            if (n < places) {
                continue;
            }
            if (n < bestFree || (n == bestFree && e.getKey() < bestRoom)) {
                bestRoom = e.getKey();
                bestFree = n;
            }
        }
        if (bestRoom == null) {
            return Optional.empty();
        }
        List<Integer> nos = byRoom.get(bestRoom).stream().sorted().limit(places).toList();
        return Optional.of(new Placement(bestRoom, nos));
    }

    /** Наибольшее число свободных мест в одном номере — сколько человек можно поселить вместе. */
    public static int maxInOneRoom(List<FreePlace> free) {
        Map<Integer, Integer> counts = new LinkedHashMap<>();
        for (FreePlace fp : free) {
            counts.merge(fp.roomId(), 1, Integer::sum);
        }
        return counts.values().stream().mapToInt(Integer::intValue).max().orElse(0);
    }
}
