package sanatorium.core.directory;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface RoomRepository extends JpaRepository<Room, Integer> {

    /** Число активных мест в категории (знаменатель Occ и параметр «available» в событиях спроса); null, если номеров нет. */
    @Query("""
            select sum(rc.capacityTotal) from Room r join RoomCategory rc on rc.id = r.categoryId
             where r.categoryId = :categoryId and r.active = true
            """)
    Long activePlaces(@Param("categoryId") Integer categoryId);
}
