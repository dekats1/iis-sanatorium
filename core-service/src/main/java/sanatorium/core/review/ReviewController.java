package sanatorium.core.review;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import sanatorium.core.client.ClientRepository;
import sanatorium.core.common.ApiException;
import sanatorium.core.identity.Access;
import sanatorium.core.review.ReviewDtos.CreateReviewRequest;
import sanatorium.core.review.ReviewDtos.GuestReviewView;
import sanatorium.core.review.ReviewDtos.ReplyRequest;
import sanatorium.core.review.ReviewDtos.ReviewQualityStatsView;

@RestController
@RequestMapping("/api/reviews")
@Tag(name = "reviews", description = "Отзывы гостей и контроль качества (NPS)")
public class ReviewController {

    private final ReviewService reviewService;
    private final ClientRepository clientRepository;

    public ReviewController(ReviewService reviewService, ClientRepository clientRepository) {
        this.reviewService = reviewService;
        this.clientRepository = clientRepository;
    }

    @GetMapping
    @Operation(summary = "Получить список отзывов с фильтрацией")
    public List<GuestReviewView> list(
            @RequestParam(required = false) String filter,
            @RequestParam(required = false) Long voucherId,
            @RequestParam(required = false) Long clientId,
            @RequestParam(required = false) Integer minRating,
            @RequestParam(required = false) Integer maxRating
    ) {
        return reviewService.listReviews(filter, voucherId, clientId, minRating, maxRating);
    }

    @GetMapping("/stats")
    @Operation(summary = "Статистика качества, CSAT, NPS индекс и распределение звёзд")
    public ReviewQualityStatsView stats() {
        return reviewService.getQualityStats();
    }

    @GetMapping("/check-voucher/{voucherId}")
    @Operation(summary = "Проверить, оставлен ли уже отзыв по данной путёвке")
    public boolean checkVoucher(@PathVariable long voucherId) {
        return reviewService.hasReviewForVoucher(voucherId);
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    @Operation(summary = "Оставить отзыв об отдыхе и медицинских процедурах")
    public GuestReviewView create(
            @Valid @RequestBody CreateReviewRequest req,
            @AuthenticationPrincipal Jwt jwt
    ) {
        Long clientId;
        if (jwt != null && !Access.isAdmin(jwt)) {
            clientId = clientRepository.findIdByUserId(Access.userId(jwt))
                    .orElse(req.clientId());
        } else {
            clientId = req.clientId();
        }

        return reviewService.createReview(clientId, req);
    }

    @PostMapping("/{id}/reply")
    @Operation(summary = "Официальный ответ администрации санатория на отзыв гостя")
    public GuestReviewView reply(
            @PathVariable long id,
            @Valid @RequestBody ReplyRequest req,
            @AuthenticationPrincipal Jwt jwt
    ) {
        String replier = req.replierName();
        if (replier == null || replier.isBlank()) {
            replier = jwt != null ? jwt.getClaimAsString("sub") : "Администрация санатория";
        }
        return reviewService.reply(id, req.replyText(), replier);
    }
}
