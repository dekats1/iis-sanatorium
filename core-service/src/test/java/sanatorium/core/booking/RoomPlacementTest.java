package sanatorium.core.booking;

import java.util.List;
import org.junit.jupiter.api.Test;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

class RoomPlacementTest {

    private final List<FreePlace> free = List.of(
            new FreePlace(3, 1), new FreePlace(3, 2), new FreePlace(3, 3),
            new FreePlace(1, 2),
            new FreePlace(2, 1), new FreePlace(2, 2));

    @Test
    void picksSmallestRoomThatFits() {
        var p = RoomPlacement.choose(free, 2).orElseThrow();
        assertEquals(2, p.roomId());            // в номере 1 свободно одно место — не подходит; номер 3 — больше нужного
        assertEquals(List.of(1, 2), p.placeNos());
    }

    @Test
    void emptyWhenNoSingleRoomFits() {
        assertTrue(RoomPlacement.choose(free, 4).isEmpty());
        assertTrue(RoomPlacement.choose(List.of(), 1).isEmpty());
    }

    @Test
    void tieBrokenByLowerRoomId() {
        var p = RoomPlacement.choose(List.of(new FreePlace(5, 1), new FreePlace(4, 1)), 1).orElseThrow();
        assertEquals(4, p.roomId());
    }

    @Test
    void rejectsNonPositivePlaces() {
        assertThrows(IllegalArgumentException.class, () -> RoomPlacement.choose(free, 0));
    }

    @Test
    void maxInOneRoomCountsPerRoom() {
        assertEquals(3, RoomPlacement.maxInOneRoom(free));
        assertEquals(0, RoomPlacement.maxInOneRoom(List.of()));
    }
}
