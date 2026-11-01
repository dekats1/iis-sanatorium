package sanatorium.core.booking;

import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.List;

/** Даты проживания: ночёвки [checkIn; checkOut), единица учёта — место-сутки (формула 1.1 главы 1). */
public final class StayDates {

    private StayDates() { }

    public static List<LocalDate> nights(LocalDate checkIn, LocalDate checkOut) {
        if (!checkOut.isAfter(checkIn)) {
            throw new IllegalArgumentException("check_out должен быть позже check_in");
        }
        return checkIn.datesUntil(checkOut).toList();
    }

    public static long nightsCount(LocalDate checkIn, LocalDate checkOut) {
        return ChronoUnit.DAYS.between(checkIn, checkOut);
    }
}
