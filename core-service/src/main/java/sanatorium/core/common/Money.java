package sanatorium.core.common;

import java.math.BigDecimal;
import java.math.RoundingMode;

/** Денежные расчёты: BigDecimal, 2 знака, HALF_UP (как в pricing-forecast/pricing/engine.py). */
public final class Money {

    private Money() { }

    public static BigDecimal round(BigDecimal v) {
        return v.setScale(2, RoundingMode.HALF_UP);
    }

    public static BigDecimal percentOf(BigDecimal amount, int percent) {
        return round(amount.multiply(BigDecimal.valueOf(percent)).divide(BigDecimal.valueOf(100), 10, RoundingMode.HALF_UP));
    }
}
