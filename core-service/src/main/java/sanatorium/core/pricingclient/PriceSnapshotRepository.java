package sanatorium.core.pricingclient;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.transaction.annotation.Transactional;

/** Резервный снимок цен (таблица price_snapshot). */
public interface PriceSnapshotRepository extends JpaRepository<PriceSnapshot, PriceSnapshotId> {

    /**
     * Атомарный UPSERT нативным запросом: параллельные запросы цены для одной (категория, дата) не конфликтуют,
     * чего не гарантирует схема «прочитать — изменить — сохранить» через сущность.
     */
    @Modifying
    @Transactional
    @Query(value = """
            INSERT INTO price_snapshot (category_id, stay_date, price, fetched_at)
            VALUES (:categoryId, :stayDate, :price, now())
            ON CONFLICT (category_id, stay_date)
            DO UPDATE SET price = EXCLUDED.price, fetched_at = EXCLUDED.fetched_at
            """, nativeQuery = true)
    int upsert(@Param("categoryId") int categoryId, @Param("stayDate") LocalDate stayDate, @Param("price") BigDecimal price);

    @Query("""
            select s.price from PriceSnapshot s
             where s.id.categoryId = :categoryId and s.id.stayDate = :stayDate and s.fetchedAt >= :notOlderThan
            """)
    Optional<BigDecimal> findFresh(@Param("categoryId") int categoryId, @Param("stayDate") LocalDate stayDate,
                                   @Param("notOlderThan") OffsetDateTime notOlderThan);
}
