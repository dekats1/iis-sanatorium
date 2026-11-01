package sanatorium.core.booking;

/** Статусы брони (CHECK-ограничение bookings.status). Смена на CANCELLED освобождает места триггером БД. */
public enum BookingStatus {
    ACTIVE, CONFIRMED, CHECKED_IN, COMPLETED, CANCELLED
}
