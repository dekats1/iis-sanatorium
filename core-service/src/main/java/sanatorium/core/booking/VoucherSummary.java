package sanatorium.core.booking;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.OffsetDateTime;

/** Путёвка с данными брони и номера — результат JPQL-выборки (конструкторное выражение); оплата добавляется отдельно. */
public record VoucherSummary(Long id, Long clientId, VoucherStatus status, Integer categoryId, String roomNumber,
                             LocalDate checkIn, LocalDate checkOut, Integer places, BigDecimal pricePerPlaceDay,
                             BigDecimal totalPrice, String currency, OffsetDateTime paymentDeadline) { }
