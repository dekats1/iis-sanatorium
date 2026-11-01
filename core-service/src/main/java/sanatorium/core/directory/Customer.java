package sanatorium.core.directory;

import com.fasterxml.jackson.annotation.JsonProperty;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

/** Заказчик путёвки: организация (ORG, договор) или физическое лицо (PERSON). Читают только сотрудники. */
@Entity
@Table(name = "customers")
public class Customer implements DirectoryEntity<Customer> {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @JsonProperty(access = JsonProperty.Access.READ_ONLY)
    private Long id;

    @NotBlank @Pattern(regexp = "ORG|PERSON")
    @Column(name = "type", nullable = false)
    private String type;

    @NotBlank @Size(max = 200)
    @Column(name = "name", nullable = false)
    private String name;

    @Size(max = 50)
    @Column(name = "contract_no")
    private String contractNo;

    protected Customer() { }

    public Customer(String type, String name) {
        this.type = type;
        this.name = name;
    }

    @Override
    public void copyFrom(Customer s) {
        this.type = s.type;
        this.name = s.name;
        this.contractNo = s.contractNo;
    }

    public Long getId() { return id; }
    public String getType() { return type; }
    public void setType(String type) { this.type = type; }
    public String getName() { return name; }
    public void setName(String name) { this.name = name; }
    public String getContractNo() { return contractNo; }
    public void setContractNo(String contractNo) { this.contractNo = contractNo; }
}
