package sanatorium.core.operations;

import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface StaffMemberRepository extends JpaRepository<StaffMember, Long> {
    List<StaffMember> findAllByOrderByFullNameAsc();
}
