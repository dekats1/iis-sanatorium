package sanatorium.core.review;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import sanatorium.core.booking.Voucher;
import sanatorium.core.booking.VoucherRepository;
import sanatorium.core.client.Client;
import sanatorium.core.client.ClientRepository;
import sanatorium.core.common.ApiException;
import sanatorium.core.review.ReviewDtos.CategoryAveragesView;
import sanatorium.core.review.ReviewDtos.CategoryRatingsDto;
import sanatorium.core.review.ReviewDtos.CreateReviewRequest;
import sanatorium.core.review.ReviewDtos.GuestReviewView;
import sanatorium.core.review.ReviewDtos.ManagementResponseView;
import sanatorium.core.review.ReviewDtos.ProcedureFeedbackItem;
import sanatorium.core.review.ReviewDtos.ReviewQualityStatsView;
import sanatorium.core.review.ReviewDtos.TopRatedProcedureView;

@Service
public class ReviewService {

    private final GuestReviewRepository reviewRepository;
    private final ProcedureFeedbackRepository feedbackRepository;
    private final VoucherRepository voucherRepository;
    private final ClientRepository clientRepository;

    public ReviewService(GuestReviewRepository reviewRepository,
                         ProcedureFeedbackRepository feedbackRepository,
                         VoucherRepository voucherRepository,
                         ClientRepository clientRepository) {
        this.reviewRepository = reviewRepository;
        this.feedbackRepository = feedbackRepository;
        this.voucherRepository = voucherRepository;
        this.clientRepository = clientRepository;
    }

    @Transactional
    public GuestReviewView createReview(Long clientId, CreateReviewRequest req) {
        if (req.voucherId() != null && reviewRepository.existsByVoucherId(req.voucherId())) {
            throw ApiException.conflict("Отзыв по данной путёвке уже был оставлен ранее");
        }

        Long actualClientId = clientId != null ? clientId : req.clientId();
        if (actualClientId == null) {
            throw ApiException.badRequest("Не указан идентификатор клиента (clientId)");
        }

        String clientName = req.clientName();
        if (clientName == null || clientName.isBlank()) {
            Client c = clientRepository.findById(actualClientId).orElse(null);
            if (c != null) {
                clientName = c.getLastName() + " " + c.getFirstName() + (c.getMiddleName() != null ? " " + c.getMiddleName() : "");
            } else {
                clientName = "Гость санатория";
            }
        }

        GuestReview review = new GuestReview();
        review.setVoucherId(req.voucherId());
        review.setClientId(actualClientId);
        review.setClientName(clientName);
        review.setCategoryName(req.categoryName() != null ? req.categoryName() : "Номер санатория");
        review.setRoomNumber(req.roomNumber());
        review.setStayDates(req.stayDates() != null ? req.stayDates() : "Сезон 2026");
        review.setOverallRating(Math.max(1, Math.min(5, req.overallRating())));
        review.setNpsScore(Math.max(0, Math.min(10, req.npsScore())));

        CategoryRatingsDto cats = req.categoriesRating();
        if (cats != null) {
            review.setRoomRating(Math.max(1, Math.min(5, cats.room())));
            review.setTreatmentRating(Math.max(1, Math.min(5, cats.treatment())));
            review.setFoodRating(Math.max(1, Math.min(5, cats.food())));
            review.setServiceRating(Math.max(1, Math.min(5, cats.service())));
        } else {
            review.setRoomRating(review.getOverallRating());
            review.setTreatmentRating(review.getOverallRating());
            review.setFoodRating(review.getOverallRating());
            review.setServiceRating(review.getOverallRating());
        }

        review.setComment(req.comment().trim());
        review.setStatus(ReviewStatus.PUBLISHED);
        review.setCreatedAt(OffsetDateTime.now());

        if (req.procedureFeedback() != null) {
            for (ProcedureFeedbackItem item : req.procedureFeedback()) {
                if (item.procedureName() != null && !item.procedureName().isBlank()) {
                    ProcedureFeedback pf = new ProcedureFeedback(
                            review,
                            item.procedureName().trim(),
                            Math.max(1, Math.min(5, item.rating())),
                            item.comment() != null ? item.comment().trim() : null
                    );
                    review.getProcedureFeedbacks().add(pf);
                }
            }
        }

        GuestReview saved = reviewRepository.save(review);
        return toView(saved);
    }

    @Transactional(readOnly = true)
    public List<GuestReviewView> listReviews(String filter, Long voucherId, Long clientId, Integer minRating, Integer maxRating) {
        List<GuestReview> reviews;

        if ("ATTENTION".equalsIgnoreCase(filter)) {
            reviews = reviewRepository.findNeedingAttention();
        } else if (clientId != null) {
            reviews = reviewRepository.findByClientIdOrderByCreatedAtDesc(clientId);
        } else if (voucherId != null) {
            reviews = reviewRepository.findByVoucherId(voucherId).map(List::of).orElseGet(List::of);
        } else if (minRating != null) {
            reviews = reviewRepository.findByMinRating(minRating);
        } else if (maxRating != null) {
            reviews = reviewRepository.findByMaxRating(maxRating);
        } else {
            reviews = reviewRepository.findAllByOrderByCreatedAtDesc();
        }

        return reviews.stream().map(this::toView).collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public boolean hasReviewForVoucher(long voucherId) {
        return reviewRepository.existsByVoucherId(voucherId);
    }

    @Transactional
    public GuestReviewView reply(long reviewId, String replyText, String replierName) {
        GuestReview review = reviewRepository.findById(reviewId)
                .orElseThrow(() -> ApiException.notFound("Отзыв не найден"));

        review.setReplyText(replyText.trim());
        review.setRepliedAt(OffsetDateTime.now());
        review.setReplierName(replierName != null && !replierName.isBlank() ? replierName.trim() : "Администрация санатория");

        return toView(reviewRepository.save(review));
    }

    @Transactional(readOnly = true)
    public ReviewQualityStatsView getQualityStats() {
        List<GuestReview> all = reviewRepository.findAll();
        long total = all.size();

        if (total == 0) {
            return new ReviewQualityStatsView(
                    0.0,
                    0,
                    0,
                    0,
                    0,
                    0,
                    new CategoryAveragesView(0.0, 0.0, 0.0, 0.0),
                    Map.of(5, 0L, 4, 0L, 3, 0L, 2, 0L, 1, 0L),
                    List.of()
            );
        }

        double sumOverall = 0;
        double sumRoom = 0;
        double sumTreatment = 0;
        double sumFood = 0;
        double sumService = 0;

        long promoters = 0;
        long passives = 0;
        long detractors = 0;

        Map<Integer, Long> distribution = new HashMap<>();
        for (int i = 1; i <= 5; i++) distribution.put(i, 0L);

        for (GuestReview r : all) {
            sumOverall += r.getOverallRating();
            sumRoom += r.getRoomRating();
            sumTreatment += r.getTreatmentRating();
            sumFood += r.getFoodRating();
            sumService += r.getServiceRating();

            distribution.put(r.getOverallRating(), distribution.getOrDefault(r.getOverallRating(), 0L) + 1);

            int nps = r.getNpsScore();
            if (nps >= 9) promoters++;
            else if (nps >= 7) passives++;
            else detractors++;
        }

        double avgOverall = round(sumOverall / total);
        double avgRoom = round(sumRoom / total);
        double avgTreatment = round(sumTreatment / total);
        double avgFood = round(sumFood / total);
        double avgService = round(sumService / total);

        int npsIndex = (int) Math.round(((double) (promoters - detractors) / total) * 100);

        List<ProcedureFeedbackRepository.ProcedureAvgRating> topRaw = feedbackRepository.findTopProcedures();
        List<TopRatedProcedureView> topProcedures = topRaw.stream()
                .map(p -> new TopRatedProcedureView(
                        p.getProcedureName(),
                        round(p.getAvgRating() != null ? p.getAvgRating() : 0.0),
                        p.getReviewCount() != null ? p.getReviewCount() : 0L
                ))
                .limit(10)
                .collect(Collectors.toList());

        return new ReviewQualityStatsView(
                avgOverall,
                npsIndex,
                total,
                promoters,
                passives,
                detractors,
                new CategoryAveragesView(avgRoom, avgTreatment, avgFood, avgService),
                distribution,
                topProcedures
        );
    }

    private double round(double val) {
        return BigDecimal.valueOf(val).setScale(2, RoundingMode.HALF_UP).doubleValue();
    }

    public GuestReviewView toView(GuestReview r) {
        List<ProcedureFeedbackItem> feedbackItems = r.getProcedureFeedbacks().stream()
                .map(pf -> new ProcedureFeedbackItem(pf.getProcedureName(), pf.getRating(), pf.getComment()))
                .collect(Collectors.toList());

        ManagementResponseView resp = null;
        if (r.getReplyText() != null) {
            resp = new ManagementResponseView(r.getReplyText(), r.getRepliedAt(), r.getReplierName());
        }

        return new GuestReviewView(
                r.getId(),
                r.getVoucherId(),
                r.getClientId(),
                r.getClientName(),
                r.getCategoryName(),
                r.getRoomNumber(),
                r.getStayDates(),
                r.getOverallRating(),
                r.getNpsScore(),
                new CategoryRatingsDto(r.getRoomRating(), r.getTreatmentRating(), r.getFoodRating(), r.getServiceRating()),
                feedbackItems,
                r.getComment(),
                r.getCreatedAt(),
                r.getStatus().name(),
                resp
        );
    }
}
