package sanatorium.core.booking;

import java.time.LocalDate;

/** Категория, период и число мест брони — исходные данные события спроса для pricing-forecast. */
public record BookingStay(Integer categoryId, LocalDate checkIn, LocalDate checkOut, Integer places) { }
