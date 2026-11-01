package sanatorium.core.review;

import jakarta.persistence.CascadeType;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.OneToMany;
import jakarta.persistence.Table;
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.List;

@Entity
@Table(name = "guest_reviews")
public class GuestReview {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "voucher_id", unique = true)
    private Long voucherId;

    @Column(name = "client_id", nullable = false)
    private Long clientId;

    @Column(name = "client_name", nullable = false, length = 120)
    private String clientName;

    @Column(name = "category_name", nullable = false, length = 100)
    private String categoryName;

    @Column(name = "room_number", length = 32)
    private String roomNumber;

    @Column(name = "stay_dates", nullable = false, length = 120)
    private String stayDates;

    @Column(name = "overall_rating", nullable = false)
    private int overallRating;

    @Column(name = "nps_score", nullable = false)
    private int npsScore;

    @Column(name = "room_rating", nullable = false)
    private int roomRating;

    @Column(name = "treatment_rating", nullable = false)
    private int treatmentRating;

    @Column(name = "food_rating", nullable = false)
    private int foodRating;

    @Column(name = "service_rating", nullable = false)
    private int serviceRating;

    @Column(name = "comment", nullable = false, columnDefinition = "TEXT")
    private String comment;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 20)
    private ReviewStatus status = ReviewStatus.PUBLISHED;

    @Column(name = "reply_text", columnDefinition = "TEXT")
    private String replyText;

    @Column(name = "replied_at")
    private OffsetDateTime repliedAt;

    @Column(name = "replier_name", length = 120)
    private String replierName;

    @Column(name = "created_at", nullable = false)
    private OffsetDateTime createdAt = OffsetDateTime.now();

    @OneToMany(mappedBy = "review", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<ProcedureFeedback> procedureFeedbacks = new ArrayList<>();

    public GuestReview() {
    }

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public Long getVoucherId() {
        return voucherId;
    }

    public void setVoucherId(Long voucherId) {
        this.voucherId = voucherId;
    }

    public Long getClientId() {
        return clientId;
    }

    public void setClientId(Long clientId) {
        this.clientId = clientId;
    }

    public String getClientName() {
        return clientName;
    }

    public void setClientName(String clientName) {
        this.clientName = clientName;
    }

    public String getCategoryName() {
        return categoryName;
    }

    public void setCategoryName(String categoryName) {
        this.categoryName = categoryName;
    }

    public String getRoomNumber() {
        return roomNumber;
    }

    public void setRoomNumber(String roomNumber) {
        this.roomNumber = roomNumber;
    }

    public String getStayDates() {
        return stayDates;
    }

    public void setStayDates(String stayDates) {
        this.stayDates = stayDates;
    }

    public int getOverallRating() {
        return overallRating;
    }

    public void setOverallRating(int overallRating) {
        this.overallRating = overallRating;
    }

    public int getNpsScore() {
        return npsScore;
    }

    public void setNpsScore(int npsScore) {
        this.npsScore = npsScore;
    }

    public int getRoomRating() {
        return roomRating;
    }

    public void setRoomRating(int roomRating) {
        this.roomRating = roomRating;
    }

    public int getTreatmentRating() {
        return treatmentRating;
    }

    public void setTreatmentRating(int treatmentRating) {
        this.treatmentRating = treatmentRating;
    }

    public int getFoodRating() {
        return foodRating;
    }

    public void setFoodRating(int foodRating) {
        this.foodRating = foodRating;
    }

    public int getServiceRating() {
        return serviceRating;
    }

    public void setServiceRating(int serviceRating) {
        this.serviceRating = serviceRating;
    }

    public String getComment() {
        return comment;
    }

    public void setComment(String comment) {
        this.comment = comment;
    }

    public ReviewStatus getStatus() {
        return status;
    }

    public void setStatus(ReviewStatus status) {
        this.status = status;
    }

    public String getReplyText() {
        return replyText;
    }

    public void setReplyText(String replyText) {
        this.replyText = replyText;
    }

    public OffsetDateTime getRepliedAt() {
        return repliedAt;
    }

    public void setRepliedAt(OffsetDateTime repliedAt) {
        this.repliedAt = repliedAt;
    }

    public String getReplierName() {
        return replierName;
    }

    public void setReplierName(String replierName) {
        this.replierName = replierName;
    }

    public OffsetDateTime getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(OffsetDateTime createdAt) {
        this.createdAt = createdAt;
    }

    public List<ProcedureFeedback> getProcedureFeedbacks() {
        return procedureFeedbacks;
    }

    public void setProcedureFeedbacks(List<ProcedureFeedback> procedureFeedbacks) {
        this.procedureFeedbacks = procedureFeedbacks;
    }
}
