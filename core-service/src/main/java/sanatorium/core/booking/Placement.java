package sanatorium.core.booking;

import java.util.List;

/** Результат подбора: один номер и конкретные места в нём. */
public record Placement(int roomId, List<Integer> placeNos) { }
