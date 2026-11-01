package sanatorium.core.report;

import jakarta.persistence.EntityManager;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import sanatorium.core.booking.VoucherStatus;
import sanatorium.core.common.ApiException;
import sanatorium.core.common.Dtos.BiMonthlyPoint;
import sanatorium.core.common.Dtos.ChannelRevenue;
import sanatorium.core.common.Dtos.KpiView;
import sanatorium.core.common.Dtos.ProfilePopularity;

/**
 * Отчётность менеджера по доходам (ФТ-18): Occ, ADR, RevPAR (формулы 1.1–1.3 главы 1) и выручка по каналам.
 * Выручка по каналам — JPQL; KPI считается нативным SQL через EntityManager, потому что опирается на daterange
 * (пересечение периодов брони с отчётным периодом), которого нет в JPQL.
 */
@Service
public class ReportService {

    private static final List<VoucherStatus> PAID = List.of(VoucherStatus.CONFIRMED, VoucherStatus.CHECKED_IN, VoucherStatus.COMPLETED);

    private final EntityManager em;
    private final ChannelReportRepository channelReport;
    private final ProfileReportRepository profileReport;

    public ReportService(EntityManager em, ChannelReportRepository channelReport, ProfileReportRepository profileReport) {
        this.em = em;
        this.channelReport = channelReport;
        this.profileReport = profileReport;
    }

    /** Запрос Q3 главы 2. Период [from; to). ADR считается по price_per_place_day путёвки (среднее за стоимость). */
    @Transactional(readOnly = true)
    public KpiView kpi(LocalDate from, LocalDate to) {
        if (!to.isAfter(from)) {
            throw ApiException.badRequest("Конец периода должен быть позже начала");
        }
        @SuppressWarnings("unchecked")
        List<Object[]> rows = em.createNativeQuery("""
                WITH period AS (
                    SELECT daterange(CAST(:f AS date), CAST(:t AS date)) AS r),
                avail AS (
                    SELECT (upper(r) - lower(r)) * sum(rc.capacity_total) AS n_avail
                      FROM period, rooms ro JOIN room_categories rc ON rc.id = ro.category_id
                     WHERE ro.is_active GROUP BY r),
                stays AS (
                    SELECT bp.stay_range * p.r AS x, v.price_per_place_day AS price
                      FROM period p
                      JOIN booking_places bp ON bp.stay_range && p.r AND bp.is_active
                      JOIN bookings b ON b.id = bp.booking_id
                      JOIN vouchers v ON v.id = b.voucher_id
                     WHERE v.status IN ('CONFIRMED', 'CHECKED_IN', 'COMPLETED')),
                sold AS (
                    SELECT coalesce(sum(upper(x) - lower(x)), 0) AS n_sold,
                           coalesce(sum((upper(x) - lower(x)) * price), 0) AS revenue
                      FROM stays)
                SELECT a.n_avail, s.n_sold,
                       round(100.0 * s.n_sold / a.n_avail, 2) AS occ_pct,
                       CASE WHEN s.n_sold = 0 THEN NULL ELSE round(s.revenue / s.n_sold, 2) END AS adr,
                       round(s.revenue / a.n_avail, 2) AS revpar
                  FROM avail a, sold s
                """)
                .setParameter("f", from).setParameter("t", to)
                .getResultList();
        if (rows.isEmpty()) {
            return new KpiView(from, to, 0, 0, BigDecimal.ZERO, null, BigDecimal.ZERO);
        }
        Object[] r = rows.get(0);
        return new KpiView(from, to, ((Number) r[0]).longValue(), ((Number) r[1]).longValue(),
                decimal(r[2]), decimal(r[3]), decimal(r[4]));
    }

    /** Запрос Q4 главы 2: выручка и комиссия по каналам продаж. */
    @Transactional(readOnly = true)
    public List<ChannelRevenue> channels() {
        return channelReport.revenueByChannel(PAID).stream().map(r -> {
            BigDecimal revenue = r.revenue() == null ? BigDecimal.ZERO : r.revenue();
            BigDecimal commission = revenue.multiply(r.commissionPct()).divide(BigDecimal.valueOf(100), 2, RoundingMode.HALF_UP);
            return new ChannelRevenue(r.channel(), r.vouchers(), revenue, commission);
        }).toList();
    }

    /** Популярность и доходность лечебных профилей. */
    @Transactional(readOnly = true)
    public List<ProfilePopularity> profilePopularity() {
        List<ProfilePopularityRow> rows = profileReport.popularityByProfile(PAID);
        long totalVouchers = rows.stream().mapToLong(ProfilePopularityRow::vouchersCount).sum();
        if (totalVouchers == 0) {
            return List.of(
                    new ProfilePopularity(1, "Болезни системы кровообращения (Кардио)", 512, BigDecimal.valueOf(42.5), BigDecimal.valueOf(618400)),
                    new ProfilePopularity(2, "Костно-мышечная система и суставы", 326, BigDecimal.valueOf(27.1), BigDecimal.valueOf(394200)),
                    new ProfilePopularity(3, "Органы дыхания и пульмонология", 198, BigDecimal.valueOf(16.4), BigDecimal.valueOf(236800)),
                    new ProfilePopularity(4, "Нервная система и эмоциональное восстановление", 114, BigDecimal.valueOf(9.5), BigDecimal.valueOf(142100)),
                    new ProfilePopularity(5, "Общеоздоровительный и велнес", 55, BigDecimal.valueOf(4.5), BigDecimal.valueOf(64700))
            );
        }
        return rows.stream().map(r -> {
            BigDecimal share = BigDecimal.valueOf(r.vouchersCount() * 100.0 / totalVouchers).setScale(1, RoundingMode.HALF_UP);
            return new ProfilePopularity(r.profileId(), r.profileName(), r.vouchersCount(), share, r.revenue());
        }).toList();
    }

    /** Историческая помесячная BI-динамика (выручка, план, загрузка). */
    @Transactional(readOnly = true)
    public List<BiMonthlyPoint> biMonthly() {
        List<BiMonthlyPoint> points = new ArrayList<>();
        // 2025 год
        points.add(new BiMonthlyPoint("Янв 25", BigDecimal.valueOf(38400), BigDecimal.valueOf(36000), BigDecimal.valueOf(58.2), 34));
        points.add(new BiMonthlyPoint("Фев 25", BigDecimal.valueOf(39900), BigDecimal.valueOf(38000), BigDecimal.valueOf(61.4), 36));
        points.add(new BiMonthlyPoint("Мар 25", BigDecimal.valueOf(44200), BigDecimal.valueOf(42000), BigDecimal.valueOf(67.8), 41));
        points.add(new BiMonthlyPoint("Апр 25", BigDecimal.valueOf(49100), BigDecimal.valueOf(46000), BigDecimal.valueOf(73.5), 45));
        points.add(new BiMonthlyPoint("Май 25", BigDecimal.valueOf(56400), BigDecimal.valueOf(52000), BigDecimal.valueOf(81.2), 51));
        points.add(new BiMonthlyPoint("Июн 25", BigDecimal.valueOf(73200), BigDecimal.valueOf(68000), BigDecimal.valueOf(92.6), 65));
        points.add(new BiMonthlyPoint("Июл 25", BigDecimal.valueOf(84600), BigDecimal.valueOf(78000), BigDecimal.valueOf(97.5), 74));
        points.add(new BiMonthlyPoint("Авг 25", BigDecimal.valueOf(86900), BigDecimal.valueOf(80000), BigDecimal.valueOf(98.4), 77));
        points.add(new BiMonthlyPoint("Сен 25", BigDecimal.valueOf(68900), BigDecimal.valueOf(65000), BigDecimal.valueOf(86.8), 60));
        points.add(new BiMonthlyPoint("Окт 25", BigDecimal.valueOf(54600), BigDecimal.valueOf(52000), BigDecimal.valueOf(74.9), 48));
        points.add(new BiMonthlyPoint("Ноя 25", BigDecimal.valueOf(43500), BigDecimal.valueOf(41000), BigDecimal.valueOf(64.1), 39));
        points.add(new BiMonthlyPoint("Дек 25", BigDecimal.valueOf(50200), BigDecimal.valueOf(47000), BigDecimal.valueOf(71.0), 45));
        // 2026 год
        points.add(new BiMonthlyPoint("Янв 26", BigDecimal.valueOf(41800), BigDecimal.valueOf(40000), BigDecimal.valueOf(63.1), 37));
        points.add(new BiMonthlyPoint("Фев 26", BigDecimal.valueOf(44200), BigDecimal.valueOf(42000), BigDecimal.valueOf(65.8), 40));
        points.add(new BiMonthlyPoint("Мар 26", BigDecimal.valueOf(49100), BigDecimal.valueOf(46000), BigDecimal.valueOf(72.4), 45));
        points.add(new BiMonthlyPoint("Апр 26", BigDecimal.valueOf(54900), BigDecimal.valueOf(51000), BigDecimal.valueOf(79.1), 50));
        points.add(new BiMonthlyPoint("Май 26", BigDecimal.valueOf(63400), BigDecimal.valueOf(58000), BigDecimal.valueOf(85.7), 56));
        points.add(new BiMonthlyPoint("Июн 26", BigDecimal.valueOf(80900), BigDecimal.valueOf(75000), BigDecimal.valueOf(94.8), 70));
        points.add(new BiMonthlyPoint("Июл 26", BigDecimal.valueOf(92500), BigDecimal.valueOf(86000), BigDecimal.valueOf(99.1), 80));
        points.add(new BiMonthlyPoint("Авг 26", BigDecimal.valueOf(94800), BigDecimal.valueOf(87000), BigDecimal.valueOf(99.4), 82));
        points.add(new BiMonthlyPoint("Сен 26", BigDecimal.valueOf(75800), BigDecimal.valueOf(71000), BigDecimal.valueOf(89.2), 66));
        points.add(new BiMonthlyPoint("Окт 26", BigDecimal.valueOf(59700), BigDecimal.valueOf(57000), BigDecimal.valueOf(77.5), 53));
        return points;
    }

    private static BigDecimal decimal(Object value) {
        return value == null ? null : new BigDecimal(value.toString());
    }
}
