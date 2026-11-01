package sanatorium.core.review;

import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

@Repository
public interface GuestReviewRepository extends JpaRepository<GuestReview, Long> {

    List<GuestReview> findAllByOrderByCreatedAtDesc();

    List<GuestReview> findByClientIdOrderByCreatedAtDesc(Long clientId);

    Optional<GuestReview> findByVoucherId(Long voucherId);

    boolean existsByVoucherId(Long voucherId);

    @Query("SELECT r FROM GuestReview r WHERE r.overallRating <= :maxRating ORDER BY r.createdAt DESC")
    List<GuestReview> findByMaxRating(int maxRating);

    @Query("SELECT r FROM GuestReview r WHERE r.overallRating >= :minRating ORDER BY r.createdAt DESC")
    List<GuestReview> findByMinRating(int minRating);

    @Query("SELECT r FROM GuestReview r WHERE r.overallRating <= 3 OR r.npsScore <= 6 OR r.replyText IS NULL ORDER BY r.createdAt DESC")
    List<GuestReview> findNeedingAttention();
}
