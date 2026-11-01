package sanatorium.core.operations;

import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface ConsumableRepository extends JpaRepository<Consumable, Long> {
    Optional<Consumable> findBySku(String sku);
    List<Consumable> findAllByOrderByNameAsc();
}
