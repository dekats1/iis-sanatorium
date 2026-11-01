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
@Table(name = "sanatorium_packages")
public class SanatoriumPackage {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "name", nullable = false)
    private String name;

    @Column(name = "description", nullable = false, columnDefinition = "TEXT")
    private String description;

    @Column(name = "category_id")
    private Integer categoryId;

    @Column(name = "category_name", nullable = false, length = 120)
    private String categoryName;

    @Column(name = "profile_id")
    private Integer profileId;

    @Column(name = "profile_name", nullable = false, length = 120)
    private String profileName;

    @Column(name = "duration_nights", nullable = false)
    private int durationNights;

    @Column(name = "base_price", nullable = false, precision = 12, scale = 2)
    private BigDecimal basePrice;

    @Column(name = "package_price", nullable = false, precision = 12, scale = 2)
    private BigDecimal packagePrice;

    @Column(name = "badge", length = 64)
    private String badge;

    @Column(name = "is_active", nullable = false)
    private boolean active = true;

    @Column(name = "created_at", nullable = false)
    private OffsetDateTime createdAt = OffsetDateTime.now();

    public SanatoriumPackage() {
    }

    public SanatoriumPackage(String name, String description, Integer categoryId, String categoryName,
                             Integer profileId, String profileName, int durationNights,
                             BigDecimal basePrice, BigDecimal packagePrice, String badge) {
        this.name = name;
        this.description = description;
        this.categoryId = categoryId;
        this.categoryName = categoryName;
        this.profileId = profileId;
        this.profileName = profileName;
        this.durationNights = durationNights;
        this.basePrice = basePrice;
        this.packagePrice = packagePrice;
        this.badge = badge;
    }

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }

    public String getDescription() {
        return description;
    }

    public void setDescription(String description) {
        this.description = description;
    }

    public Integer getCategoryId() {
        return categoryId;
    }

    public void setCategoryId(Integer categoryId) {
        this.categoryId = categoryId;
    }

    public String getCategoryName() {
        return categoryName;
    }

    public void setCategoryName(String categoryName) {
        this.categoryName = categoryName;
    }

    public Integer getProfileId() {
        return profileId;
    }

    public void setProfileId(Integer profileId) {
        this.profileId = profileId;
    }

    public String getProfileName() {
        return profileName;
    }

    public void setProfileName(String profileName) {
        this.profileName = profileName;
    }

    public int getDurationNights() {
        return durationNights;
    }

    public void setDurationNights(int durationNights) {
        this.durationNights = durationNights;
    }

    public BigDecimal getBasePrice() {
        return basePrice;
    }

    public void setBasePrice(BigDecimal basePrice) {
        this.basePrice = basePrice;
    }

    public BigDecimal getPackagePrice() {
        return packagePrice;
    }

    public void setPackagePrice(BigDecimal packagePrice) {
        this.packagePrice = packagePrice;
    }

    public String getBadge() {
        return badge;
    }

    public void setBadge(String badge) {
        this.badge = badge;
    }

    public boolean isActive() {
        return active;
    }

    public void setActive(boolean active) {
        this.active = active;
    }

    public OffsetDateTime getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(OffsetDateTime createdAt) {
        this.createdAt = createdAt;
    }
}
