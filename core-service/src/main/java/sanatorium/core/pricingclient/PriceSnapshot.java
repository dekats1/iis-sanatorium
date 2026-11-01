package sanatorium.core.pricingclient;

import jakarta.persistence.Column;
import jakarta.persistence.EmbeddedId;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import java.math.BigDecimal;
import java.time.OffsetDateTime;

/** Резервный снимок последней успешно полученной цены на сутки (используется, если pricing-forecast недоступен). */
@Entity
@Table(name = "price_snapshot")
public class PriceSnapshot {

    @EmbeddedId
    private PriceSnapshotId id;

    @Column(name = "price", nullable = false)
    private BigDecimal price;

    @Column(name = "fetched_at", nullable = false)
    private OffsetDateTime fetchedAt;

    protected PriceSnapshot() { }

    public PriceSnapshotId getId() { return id; }
    public BigDecimal getPrice() { return price; }
    public OffsetDateTime getFetchedAt() { return fetchedAt; }
}
