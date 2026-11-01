package sanatorium.core.loyalty;

import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface LoyaltyAccountRepository extends JpaRepository<LoyaltyAccount, Long> {
    Optional<LoyaltyAccount> findByClientId(Long clientId);
}
