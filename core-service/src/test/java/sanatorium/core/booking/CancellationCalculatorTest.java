package sanatorium.core.booking;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import org.junit.jupiter.api.Test;
import sanatorium.core.booking.CancellationCalculator.Tier;

class CancellationCalculatorTest {

    private final CancellationCalculator calc = new CancellationCalculator();
    private final LocalDate checkIn = LocalDate.of(2027, 7, 20);

    private static BigDecimal b(String s) {
        return new BigDecimal(s);
    }

    @Test
    void earlyCancellationRefundsEverything() {
        var r = calc.calculate(checkIn, checkIn.minusDays(20), b("1000"), b("300"));
        assertEquals(0, r.retainPercent());
        assertEquals(b("300.00"), r.refund());
    }

    @Test
    void tierBoundaryBelongsToTheEarlierTier() {
        assertEquals(0, calc.calculate(checkIn, checkIn.minusDays(14), b("1000"), b("300")).retainPercent());
        assertEquals(25, calc.calculate(checkIn, checkIn.minusDays(13), b("1000"), b("300")).retainPercent());
        assertEquals(50, calc.calculate(checkIn, checkIn.minusDays(6), b("1000"), b("300")).retainPercent());
        assertEquals(100, calc.calculate(checkIn, checkIn.minusDays(2), b("1000"), b("300")).retainPercent());
    }

    @Test
    void percentIsTakenFromTotalButCappedAtPaid() {
        var mid = calc.calculate(checkIn, checkIn.minusDays(10), b("1000"), b("300"));
        assertEquals(b("250.00"), mid.retained());
        assertEquals(b("50.00"), mid.refund());

        var late = calc.calculate(checkIn, checkIn.minusDays(5), b("1000"), b("300")); // 50 % = 500 > 300
        assertEquals(b("300.00"), late.retained());
        assertEquals(b("0.00"), late.refund());
    }

    @Test
    void cancellationOnOrAfterCheckInDateRetainsAll() {
        assertEquals(100, calc.calculate(checkIn, checkIn, b("1000"), b("300")).retainPercent());
        assertEquals(100, calc.calculate(checkIn, checkIn.plusDays(3), b("1000"), b("300")).retainPercent());
    }

    @Test
    void unpaidVoucherHasNothingToRetainOrRefund() {
        var r = calc.calculate(checkIn, checkIn.minusDays(1), b("1000"), BigDecimal.ZERO);
        assertEquals(0, r.retained().signum());
        assertEquals(0, r.refund().signum());
    }

    @Test
    void scaleMustCoverAllDates() {
        assertThrows(IllegalArgumentException.class, () -> new CancellationCalculator(List.of(new Tier(5, 10))));
        assertThrows(IllegalArgumentException.class, () -> new Tier(0, 101));
    }
}
