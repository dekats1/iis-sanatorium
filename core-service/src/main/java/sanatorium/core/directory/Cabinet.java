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

/** Процедурный кабинет; slotsPerDay — число сеансов в день (ёмкость кабинета для планировщика). */
@Entity
@Table(name = "cabinets")
public class Cabinet implements DirectoryEntity<Cabinet> {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @JsonProperty(access = JsonProperty.Access.READ_ONLY)
    private Integer id;

    @NotBlank @Size(max = 100)
    @Column(name = "name", nullable = false)
    private String name;

    @NotNull @Min(1)
    @Column(name = "slots_per_day", nullable = false)
    private Integer slotsPerDay;

    protected Cabinet() { }

    public Cabinet(String name, int slotsPerDay) {
        this.name = name;
        this.slotsPerDay = slotsPerDay;
    }

    @Override
    public void copyFrom(Cabinet s) {
        this.name = s.name;
        this.slotsPerDay = s.slotsPerDay;
    }

    public Integer getId() { return id; }
    public String getName() { return name; }
    public void setName(String name) { this.name = name; }
    public Integer getSlotsPerDay() { return slotsPerDay; }
    public void setSlotsPerDay(Integer slotsPerDay) { this.slotsPerDay = slotsPerDay; }
}
