package sanatorium.core.directory;

import com.fasterxml.jackson.annotation.JsonIgnore;
import com.fasterxml.jackson.annotation.JsonProperty;
import jakarta.persistence.CollectionTable;
import jakarta.persistence.Column;
import jakarta.persistence.ElementCollection;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.Table;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.util.HashSet;
import java.util.Set;

/**
 * Лечебная процедура. Допустимые лечебные профили и противопоказания — связи N:M (таблицы procedure_profiles и
 * procedure_contraindications) — хранятся как коллекции идентификаторов и в JSON справочника не попадают:
 * ими управляют отдельные эндпоинты. Класс назван MedicalProcedure, чтобы не пересекаться с ключевыми словами JPQL.
 */
@Entity
@Table(name = "procedures")
public class MedicalProcedure implements DirectoryEntity<MedicalProcedure> {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @JsonProperty(access = JsonProperty.Access.READ_ONLY)
    private Integer id;

    @NotBlank @Size(max = 150)
    @Column(name = "name", nullable = false)
    private String name;

    @NotNull @Min(1)
    @Column(name = "duration_min", nullable = false)
    private Integer durationMin;

    @NotNull
    @Column(name = "cabinet_id", nullable = false)
    private Integer cabinetId;

    @JsonIgnore
    @ElementCollection
    @CollectionTable(name = "procedure_profiles", joinColumns = @JoinColumn(name = "procedure_id"))
    @Column(name = "profile_id")
    private Set<Integer> profileIds = new HashSet<>();

    @JsonIgnore
    @ElementCollection
    @CollectionTable(name = "procedure_contraindications", joinColumns = @JoinColumn(name = "procedure_id"))
    @Column(name = "condition_id")
    private Set<Integer> contraindicationIds = new HashSet<>();

    protected MedicalProcedure() { }

    public MedicalProcedure(String name, int durationMin, int cabinetId) {
        this.name = name;
        this.durationMin = durationMin;
        this.cabinetId = cabinetId;
    }

    @Override
    public void copyFrom(MedicalProcedure s) {
        this.name = s.name;
        this.durationMin = s.durationMin;
        this.cabinetId = s.cabinetId;
    }

    public Integer getId() { return id; }
    public String getName() { return name; }
    public void setName(String name) { this.name = name; }
    public Integer getDurationMin() { return durationMin; }
    public void setDurationMin(Integer durationMin) { this.durationMin = durationMin; }
    public Integer getCabinetId() { return cabinetId; }
    public void setCabinetId(Integer cabinetId) { this.cabinetId = cabinetId; }
    public Set<Integer> getProfileIds() { return profileIds; }
    public Set<Integer> getContraindicationIds() { return contraindicationIds; }
}
