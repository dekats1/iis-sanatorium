package sanatorium.core.operations;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.math.BigDecimal;
import java.time.OffsetDateTime;

@Entity
@Table(name = "consumables")
public class Consumable {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "sku", nullable = false, unique = true, length = 64)
    private String sku;

    @Column(name = "name", nullable = false)
    private String name;

    @Column(name = "category", nullable = false, length = 120)
    private String category;

    @Column(name = "cabinet_id")
    private Integer cabinetId;

    @Column(name = "cabinet_name", length = 120)
    private String cabinetName;

    @Column(name = "unit", nullable = false, length = 32)
    private String unit;

    @Column(name = "stock_quantity", nullable = false, precision = 10, scale = 2)
    private BigDecimal stockQuantity = BigDecimal.ZERO;

    @Column(name = "min_threshold", nullable = false, precision = 10, scale = 2)
    private BigDecimal minThreshold = BigDecimal.valueOf(10);

    @Column(name = "last_restocked_at", nullable = false)
    private OffsetDateTime lastRestockedAt = OffsetDateTime.now();

    public Consumable() {
    }

    public Consumable(String sku, String name, String category, Integer cabinetId, String cabinetName,
                      String unit, BigDecimal stockQuantity, BigDecimal minThreshold) {
        this.sku = sku;
        this.name = name;
        this.category = category;
        this.cabinetId = cabinetId;
        this.cabinetName = cabinetName;
        this.unit = unit;
        this.stockQuantity = stockQuantity;
        this.minThreshold = minThreshold;
    }

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public String getSku() {
        return sku;
    }

    public void setSku(String sku) {
        this.sku = sku;
    }

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }

    public String getCategory() {
        return category;
    }

    public void setCategory(String category) {
        this.category = category;
    }

    public Integer getCabinetId() {
        return cabinetId;
    }

    public void setCabinetId(Integer cabinetId) {
        this.cabinetId = cabinetId;
    }

    public String getCabinetName() {
        return cabinetName;
    }

    public void setCabinetName(String cabinetName) {
        this.cabinetName = cabinetName;
    }

    public String getUnit() {
        return unit;
    }

    public void setUnit(String unit) {
        this.unit = unit;
    }

    public BigDecimal getStockQuantity() {
        return stockQuantity;
    }

    public void setStockQuantity(BigDecimal stockQuantity) {
        this.stockQuantity = stockQuantity;
    }

    public BigDecimal getMinThreshold() {
        return minThreshold;
    }

    public void setMinThreshold(BigDecimal minThreshold) {
        this.minThreshold = minThreshold;
    }

    public OffsetDateTime getLastRestockedAt() {
        return lastRestockedAt;
    }

    public void setLastRestockedAt(OffsetDateTime lastRestockedAt) {
        this.lastRestockedAt = lastRestockedAt;
    }
}
