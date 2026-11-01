package sanatorium.core.booking;



/** Свободное койко-место: номер (rooms.id) и порядковый номер места в нём. */
public record FreePlace(int roomId, int placeNo) { }
