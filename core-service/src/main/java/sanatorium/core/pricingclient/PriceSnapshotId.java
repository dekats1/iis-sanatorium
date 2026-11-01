package sanatorium.core.pricingclient;

import jakarta.persistence.Column;
import jakarta.persistence.Embeddable;
import java.io.Serializable;
import java.time.LocalDate;
import java.util.Objects;

/** Составной ключ price_snapshot (category_id, stay_date). */
@Embeddable
public class PriceSnapshotId implements Serializable {

    @Column(name = "category_id")
    private Integer categoryId;

    @Column(name = "stay_date")
    private LocalDate stayDate;

    protected PriceSnapshotId() { }

    public PriceSnapshotId(Integer categoryId, LocalDate stayDate) {
        this.categoryId = categoryId;
        this.stayDate = stayDate;
    }

    public Integer getCategoryId() { return categoryId; }
    public LocalDate getStayDate() { return stayDate; }

    @Override
    public boolean equals(Object o) {
        return o instanceof PriceSnapshotId other
                && Objects.equals(categoryId, other.categoryId) && Objects.equals(stayDate, other.stayDate);
    }

    @Override
    public int hashCode() {
        return Objects.hash(categoryId, stayDate);
    }
}
