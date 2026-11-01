package sanatorium.core.report;

import java.util.Collection;
import java.util.List;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.Repository;
import org.springframework.data.repository.query.Param;
import sanatorium.core.booking.VoucherStatus;
import sanatorium.core.directory.TreatmentProfile;

public interface ProfileReportRepository extends Repository<TreatmentProfile, Integer> {

    @Query("""
            select new sanatorium.core.report.ProfilePopularityRow(tp.id, tp.name, count(v.id), coalesce(sum(v.totalPrice), 0))
              from TreatmentProfile tp
              left join Voucher v on v.profileId = tp.id and v.status in :statuses
             group by tp.id, tp.name
             order by count(v.id) desc, tp.id
            """)
    List<ProfilePopularityRow> popularityByProfile(@Param("statuses") Collection<VoucherStatus> statuses);
}
