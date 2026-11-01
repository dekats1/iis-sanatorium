package sanatorium.core.report;

import java.util.Collection;
import java.util.List;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.Repository;
import org.springframework.data.repository.query.Param;
import sanatorium.core.booking.VoucherStatus;
import sanatorium.core.directory.SalesChannel;

/** Отчётные запросы по каналам продаж (только чтение). */
public interface ChannelReportRepository extends Repository<SalesChannel, Integer> {

    /** Запрос Q4 главы 2: путёвки и выручка по каналам; каналы без продаж попадают в результат (LEFT JOIN). */
    @Query("""
            select new sanatorium.core.report.ChannelRevenueRow(sc.name, count(v.id), sum(v.totalPrice), sc.commissionPct)
              from SalesChannel sc
              left join Voucher v on v.channelId = sc.id and v.status in :statuses
             group by sc.id, sc.name, sc.commissionPct
             order by sc.id
            """)
    List<ChannelRevenueRow> revenueByChannel(@Param("statuses") Collection<VoucherStatus> statuses);
}
