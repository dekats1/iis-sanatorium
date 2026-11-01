package sanatorium.core.identity;

import java.util.Collection;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface RoleRepository extends JpaRepository<Role, Integer> {

    Optional<Role> findByCode(String code);

    List<Role> findAllByCodeIn(Collection<String> codes);
}
