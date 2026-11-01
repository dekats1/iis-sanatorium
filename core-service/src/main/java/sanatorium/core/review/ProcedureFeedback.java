package sanatorium.core.review;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;

@Entity
@Table(name = "procedure_feedback")
public class ProcedureFeedback {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(optional = false)
    @JoinColumn(name = "review_id", nullable = false)
    private GuestReview review;

    @Column(name = "procedure_name", nullable = false, length = 120)
    private String procedureName;

    @Column(name = "rating", nullable = false)
    private int rating;

    @Column(name = "comment")
    private String comment;

    public ProcedureFeedback() {
    }

    public ProcedureFeedback(GuestReview review, String procedureName, int rating, String comment) {
        this.review = review;
        this.procedureName = procedureName;
        this.rating = rating;
        this.comment = comment;
    }

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public GuestReview getReview() {
        return review;
    }

    public void setReview(GuestReview review) {
        this.review = review;
    }

    public String getProcedureName() {
        return procedureName;
    }

    public void setProcedureName(String procedureName) {
        this.procedureName = procedureName;
    }

    public int getRating() {
        return rating;
    }

    public void setRating(int rating) {
        this.rating = rating;
    }

    public String getComment() {
        return comment;
    }

    public void setComment(String comment) {
        this.comment = comment;
    }
}
