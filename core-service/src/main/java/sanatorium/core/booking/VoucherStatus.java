package sanatorium.core.booking;

/** Статусы путёвки (CHECK-ограничение vouchers.status в схеме БД). */
public enum VoucherStatus {
    DRAFT, AWAITING_PAYMENT, CONFIRMED, CHECKED_IN, COMPLETED, CANCELLED, EXPIRED
}
