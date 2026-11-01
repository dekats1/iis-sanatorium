package sanatorium.core.identity;

import jakarta.persistence.LockModeType;
import java.util.Optional;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface UserRepository extends JpaRepository<UserAccount, Long> {

    Optional<UserAccount> findByUsername(String username);

    /** Блокировка строки пользователя на время смены ролей (SELECT … FOR UPDATE). */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select u from UserAccount u where u.id = :id")
    Optional<UserAccount> lockById(@Param("id") Long id);

    @Query("select u from UserAccount u order by u.id")
    java.util.List<UserAccount> page(Pageable pageable);
}
