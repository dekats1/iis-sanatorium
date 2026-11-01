package sanatorium.core.client;

import java.util.List;
import java.util.Optional;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface ClientRepository extends JpaRepository<Client, Long> {

    @Query("select c.id from Client c where c.userId = :userId")
    Optional<Long> findIdByUserId(@Param("userId") Long userId);

    @Query("select c.userId from Client c where c.id = :id")
    Optional<Long> findUserIdById(@Param("id") Long id);

    /**
     * Поиск по началу фамилии без учёта регистра. Шаблон (с уже экранированными служебными символами LIKE)
     * передаётся параметром; символ экранирования — «!» (не обратная косая черта, у которой в строковых литералах
     * HQL особый смысл).
     */
    @Query("""
            select c from Client c
             where lower(c.lastName) like lower(:pattern) escape '!'
             order by c.lastName, c.firstName, c.id
            """)
    List<Client> searchByLastName(@Param("pattern") String pattern, Pageable pageable);
}
