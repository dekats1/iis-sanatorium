package sanatorium.core.booking;

import java.math.BigDecimal;
import java.time.LocalDate;
import org.junit.jupiter.api.Test;
import sanatorium.core.common.Money;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

class StayDatesAndMoneyTest {

    @Test
    void nightsAreHalfOpenInterval() {
        var nights = StayDates.nights(LocalDate.of(2027, 7, 1), LocalDate.of(2027, 7, 4));
        assertEquals(3, nights.size());
        assertEquals(LocalDate.of(2027, 7, 3), nights.get(2)); // день выезда в ночёвки не входит
    }

    @Test
    void zeroOrNegativeStayRejected() {
        var d = LocalDate.of(2027, 7, 1);
        assertThrows(IllegalArgumentException.class, () -> StayDates.nights(d, d));
        assertThrows(IllegalArgumentException.class, () -> StayDates.nights(d, d.minusDays(1)));
    }

    @Test
    void percentRoundsHalfUp() {
        assertEquals(new BigDecimal("300.00"), Money.percentOf(new BigDecimal("1000.00"), 30));
        assertEquals(new BigDecimal("100.00"), Money.percentOf(new BigDecimal("333.33"), 30)); // 99.999 -> 100.00
    }
}
