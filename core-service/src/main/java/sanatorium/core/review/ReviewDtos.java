package sanatorium.core.review;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Map;

public final class ReviewDtos {

    private ReviewDtos() {
    }

    public record CategoryRatingsDto(
            @Min(1) @Max(5) int room,
            @Min(1) @Max(5) int treatment,
            @Min(1) @Max(5) int food,
            @Min(1) @Max(5) int service
    ) {
    }

    public record ProcedureFeedbackItem(
            @NotBlank String procedureName,
            @Min(1) @Max(5) int rating,
            String comment
    ) {
    }

    public record CreateReviewRequest(
            Long voucherId,
            Long clientId,
            String clientName,
            String categoryName,
            String roomNumber,
            String stayDates,
            @Min(1) @Max(5) int overallRating,
            @Min(0) @Max(10) int npsScore,
            @NotNull CategoryRatingsDto categoriesRating,
            List<ProcedureFeedbackItem> procedureFeedback,
            @NotBlank String comment
    ) {
    }

    public record ManagementResponseView(
            String replyText,
            OffsetDateTime repliedAt,
            String replierName
    ) {
    }

    public record GuestReviewView(
            long id,
            Long voucherId,
            long clientId,
            String clientName,
            String categoryName,
            String roomNumber,
            String stayDates,
            int overallRating,
            int npsScore,
            CategoryRatingsDto categoriesRating,
            List<ProcedureFeedbackItem> procedureFeedback,
            String comment,
            OffsetDateTime createdAt,
            String status,
            ManagementResponseView managementResponse
    ) {
    }

    public record CategoryAveragesView(
            double room,
            double treatment,
            double food,
            double service
    ) {
    }

    public record TopRatedProcedureView(
            String name,
            double avgRating,
            long reviewCount
    ) {
    }

    public record ReviewQualityStatsView(
            double averageOverall,
            int npsIndex,
            long totalReviews,
            long promotersCount,
            long passivesCount,
            long detractorsCount,
            CategoryAveragesView categoryAverages,
            Map<Integer, Long> ratingsDistribution,
            List<TopRatedProcedureView> topRatedProcedures
    ) {
    }

    public record ReplyRequest(
            @NotBlank String replyText,
            String replierName
    ) {
    }
}
