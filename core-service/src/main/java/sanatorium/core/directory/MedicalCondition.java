package sanatorium.core.directory;

import com.fasterxml.jackson.annotation.JsonProperty;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/** Состояние здоровья (диагноз), по которому проверяются противопоказания процедур. */
@Entity
@Table(name = "medical_conditions")
public class MedicalCondition implements DirectoryEntity<MedicalCondition> {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @JsonProperty(access = JsonProperty.Access.READ_ONLY)
    private Integer id;

    @NotBlank @Size(max = 30)
    @Column(name = "code", nullable = false)
    private String code;

    @NotBlank @Size(max = 200)
    @Column(name = "name", nullable = false)
    private String name;

    protected MedicalCondition() { }

    public MedicalCondition(String code, String name) {
        this.code = code;
        this.name = name;
    }

    @Override
    public void copyFrom(MedicalCondition s) {
        this.code = s.code;
        this.name = s.name;
    }

    public Integer getId() { return id; }
    public String getCode() { return code; }
    public void setCode(String code) { this.code = code; }
    public String getName() { return name; }
    public void setName(String name) { this.name = name; }
}
