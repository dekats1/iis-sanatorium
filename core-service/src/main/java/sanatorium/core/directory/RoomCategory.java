package sanatorium.core.directory;

import com.fasterxml.jackson.annotation.JsonProperty;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

/** Категория номеров (Стандарт, Комфорт, Люкс). Вместимость — число мест в номере категории. */
@Entity
@Table(name = "room_categories")
public class RoomCategory implements DirectoryEntity<RoomCategory> {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @JsonProperty(access = JsonProperty.Access.READ_ONLY)
    private Integer id;

    @NotBlank @Size(max = 100)
    @Column(name = "name", nullable = false)
    private String name;

    @NotNull @Min(1)
    @Column(name = "capacity_total", nullable = false)
    private Integer capacityTotal;

    @Column(name = "description")
    private String description;

    protected RoomCategory() { }

    public RoomCategory(String name, int capacityTotal) {
        this.name = name;
        this.capacityTotal = capacityTotal;
    }

    @Override
    public void copyFrom(RoomCategory s) {
        this.name = s.name;
        this.capacityTotal = s.capacityTotal;
        this.description = s.description;
    }

    public Integer getId() { return id; }
    public String getName() { return name; }
    public void setName(String name) { this.name = name; }
    public Integer getCapacityTotal() { return capacityTotal; }
    public void setCapacityTotal(Integer capacityTotal) { this.capacityTotal = capacityTotal; }
    public String getDescription() { return description; }
    public void setDescription(String description) { this.description = description; }
}
