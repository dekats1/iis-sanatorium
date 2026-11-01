package sanatorium.core.medical;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.time.LocalDate;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.junit.jupiter.api.Test;
import sanatorium.core.medical.SlotPlanner.Interval;
import sanatorium.core.medical.SlotPlanner.Request;

class SlotPlannerTest {

    private final List<LocalDate> days = LocalDate.of(2027, 7, 1).datesUntil(LocalDate.of(2027, 7, 5)).toList();

    @Test
    void placesOneSessionPerDayFromTheFirstDay() {
        var plan = SlotPlanner.plan(days, List.of(new Request(1, 10, 2, 3)), 480, Map.of(), Map.of());
        assertEquals(3, plan.slots().size());
        assertTrue(plan.unplaced().isEmpty());
        assertEquals(3, plan.slots().stream().map(SlotPlanner.Slot::date).distinct().count());
        assertEquals(days.get(0), plan.slots().get(0).date());
        assertEquals(0, plan.slots().get(0).startMinute());
    }

    @Test
    void fullCabinetDaysAreSkippedAndShortfallIsReported() {
        Map<Integer, Map<LocalDate, Set<Integer>>> busy = new HashMap<>();
        busy.put(10, new HashMap<>(Map.of(days.get(0), Set.of(0, 1), days.get(1), Set.of(0, 1))));
        var plan = SlotPlanner.plan(days, List.of(new Request(1, 10, 2, 3)), 480, busy, Map.of());
        assertEquals(2, plan.slots().size());
        assertEquals(1, plan.unplaced().get(1));
        assertEquals(days.get(2), plan.slots().get(0).date());
        assertNull(busy.get(10).get(days.get(2)), "входные структуры не изменяются");
    }

    @Test
    void patientCannotBeInTwoPlacesAtTheSameTime() {
        var plan = SlotPlanner.plan(days.subList(0, 2), List.of(new Request(1, 10, 1, 1), new Request(2, 20, 1, 1)),
                480, Map.of(), Map.of());
        assertEquals(2, plan.slots().size());
        assertTrue(!plan.slots().get(0).date().equals(plan.slots().get(1).date()));
    }

    @Test
    void existingPatientIntervalsAcrossCabinetsWithDifferentSlotLengthsAreRespected() {
        var plan = SlotPlanner.plan(days.subList(0, 1), List.of(new Request(2, 20, 4, 1)), 480, Map.of(),
                Map.of(days.get(0), List.of(new Interval(0, 200))));
        assertEquals(1, plan.slots().size());
        assertEquals(240, plan.slots().get(0).startMinute()); // слоты 0–120 и 120–240 пересекают занятость 0–200
    }

    @Test
    void rejectsCabinetWithoutCapacity() {
        assertThrows(IllegalArgumentException.class,
                () -> SlotPlanner.plan(days, List.of(new Request(1, 10, 0, 1)), 480, Map.of(), Map.of()));
    }
}
