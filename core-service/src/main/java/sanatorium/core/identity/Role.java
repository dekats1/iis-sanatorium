package sanatorium.core.identity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

/** Роль пользователя. Код роли = authority ROLE_&lt;code&gt; в Spring Security. */
@Entity
@Table(name = "roles")
public class Role {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Integer id;

    @Column(name = "code", nullable = false)
    private String code;

    @Column(name = "name", nullable = false)
    private String name;

    protected Role() { }

    public Integer getId() { return id; }
    public String getCode() { return code; }
    public String getName() { return name; }
}
