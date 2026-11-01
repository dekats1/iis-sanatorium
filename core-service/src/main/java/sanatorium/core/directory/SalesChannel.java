package sanatorium.core.directory;

import com.fasterxml.jackson.annotation.JsonProperty;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.math.BigDecimal;

/** Канал продаж с комиссией в процентах и необязательной квотой мест. */
@Entity
@Table(name = "sales_channels")
public class SalesChannel implements DirectoryEntity<SalesChannel> {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @JsonProperty(access = JsonProperty.Access.READ_ONLY)
    private Integer id;

    @NotBlank @Size(max = 100)
    @Column(name = "name", nullable = false)
    private String name;

    @NotNull @DecimalMin("0") @DecimalMax("100")
    @Column(name = "commission_pct", nullable = false)
    private BigDecimal commissionPct = BigDecimal.ZERO;

    @Min(0)
    @Column(name = "quota_places")
    private Integer quotaPlaces;

    protected SalesChannel() { }

    public SalesChannel(String name, BigDecimal commissionPct) {
        this.name = name;
        this.commissionPct = commissionPct;
    }

    @Override
    public void copyFrom(SalesChannel s) {
        this.name = s.name;
        this.commissionPct = s.commissionPct;
        this.quotaPlaces = s.quotaPlaces;
    }

    public Integer getId() { return id; }
    public String getName() { return name; }
    public void setName(String name) { this.name = name; }
    public BigDecimal getCommissionPct() { return commissionPct; }
    public void setCommissionPct(BigDecimal commissionPct) { this.commissionPct = commissionPct; }
    public Integer getQuotaPlaces() { return quotaPlaces; }
    public void setQuotaPlaces(Integer quotaPlaces) { this.quotaPlaces = quotaPlaces; }
}
