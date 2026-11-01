package sanatorium.core.booking;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.Comparator;
import java.util.List;
import sanatorium.core.common.Money;

/**
 * Расчёт удержаний при отмене путёвки (ФТ-09, специализированная операция). Чистая функция.
 *
 * <p>Удержание — доля стоимости путёвки, зависящая от числа суток до заезда. Шкала по умолчанию —
 * проектное допущение автора (реальные правила конкретного санатория не известны, раздел 1.3 главы 1):
 * ≥ 14 суток — 0 %, 7–13 — 25 %, 3–6 — 50 %, менее 3 суток, день заезда и позже — 100 % стоимости.
 * Удержание не может превышать уплаченную сумму: долг клиента за позднюю отмену не создаётся
 * (при неоплаченной путёвке удерживать нечего). К возврату — уплаченное за вычетом удержания.
 */
public final class CancellationCalculator {

    /** @param minDaysBefore шкала действует, если до заезда осталось не менее стольких суток */
    public record Tier(int minDaysBefore, int retainPercent) {
        public Tier {
            if (retainPercent < 0 || retainPercent > 100) {
                throw new IllegalArgumentException("retainPercent must be within 0..100");
            }
        }
    }

    public record Result(int retainPercent, BigDecimal retained, BigDecimal refund) { }

    public static final List<Tier> DEFAULT_TIERS = List.of(new Tier(14, 0), new Tier(7, 25), new Tier(3, 50), new Tier(0, 100));

    private final List<Tier> tiers;

    public CancellationCalculator() {
        this(DEFAULT_TIERS);
    }

    public CancellationCalculator(List<Tier> tiers) {
        List<Tier> sorted = tiers.stream().sorted(Comparator.comparingInt(Tier::minDaysBefore).reversed()).toList();
        if (sorted.isEmpty() || sorted.get(sorted.size() - 1).minDaysBefore() != 0) {
            throw new IllegalArgumentException("Нужна шкала с minDaysBefore = 0, иначе часть дат не покрыта");
        }
        this.tiers = sorted;
    }

    public Result calculate(LocalDate checkIn, LocalDate cancelDate, BigDecimal total, BigDecimal paid) {
        long days = Math.max(0, ChronoUnit.DAYS.between(cancelDate, checkIn));
        int percent = tiers.stream().filter(t -> days >= t.minDaysBefore()).findFirst().orElseThrow().retainPercent();
        BigDecimal byRule = Money.percentOf(total, percent);
        BigDecimal retained = Money.round(byRule.min(Money.round(paid)));
        return new Result(percent, retained, Money.round(paid.subtract(retained)));
    }
}
