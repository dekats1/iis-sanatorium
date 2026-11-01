package sanatorium.core.directory;

import java.util.List;
import java.util.Set;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import sanatorium.core.common.ApiException;

/**
 * Универсальные операции справочников (ФТ-03) поверх Spring Data JPA: один сервис обслуживает все репозитории,
 * поэтому CRUD не дублируется. Ограничения предметной области проверяются Bean Validation на входе и
 * ограничениями БД (UNIQUE, CHECK, FK) — нарушения сопоставляются с кодами HTTP в GlobalExceptionHandler.
 */
@Service
public class DirectoryService {

    private final MedicalProcedureRepository procedures;

    public DirectoryService(MedicalProcedureRepository procedures) {
        this.procedures = procedures;
    }

    @Transactional(readOnly = true)
    public <E, ID> List<E> list(JpaRepository<E, ID> repo, Sort sort) {
        return repo.findAll(sort);
    }

    @Transactional(readOnly = true)
    public <E, ID> E get(JpaRepository<E, ID> repo, ID id) {
        return repo.findById(id).orElseThrow(() -> ApiException.notFound("Запись не найдена"));
    }

    @Transactional
    public <E extends DirectoryEntity<E>, ID> E create(JpaRepository<E, ID> repo, E body) {
        return repo.saveAndFlush(body); // flush: нарушение UNIQUE/FK выявляется здесь, а не при коммите
    }

    /** Полная замена изменяемых полей (семантика PUT); идентификатор берётся из пути. */
    @Transactional
    public <E extends DirectoryEntity<E>, ID> E update(JpaRepository<E, ID> repo, ID id, E body) {
        E current = repo.findById(id).orElseThrow(() -> ApiException.notFound("Запись не найдена"));
        current.copyFrom(body);
        return repo.saveAndFlush(current);
    }

    @Transactional
    public <E, ID> void delete(JpaRepository<E, ID> repo, ID id) {
        E current = repo.findById(id).orElseThrow(() -> ApiException.notFound("Запись не найдена"));
        try {
            repo.delete(current);
            repo.flush();
        } catch (DataIntegrityViolationException ex) {
            // ON DELETE RESTRICT: запись используется (номера, путёвки, процедуры…)
            throw ApiException.conflict("Запись используется в других данных и не может быть удалена");
        }
    }

    // ---------- связи процедуры: лечебные профили и противопоказания ----------

    @Transactional(readOnly = true)
    public List<Integer> procedureProfiles(int procedureId) {
        return procedure(procedureId).getProfileIds().stream().sorted().toList();
    }

    @Transactional(readOnly = true)
    public List<Integer> procedureContraindications(int procedureId) {
        return procedure(procedureId).getContraindicationIds().stream().sorted().toList();
    }

    @Transactional
    public void replaceProcedureProfiles(int procedureId, Set<Integer> profileIds) {
        MedicalProcedure p = procedure(procedureId);
        p.getProfileIds().clear();
        p.getProfileIds().addAll(profileIds);
        procedures.flush(); // FK на несуществующий профиль → 422 в обработчике ошибок
    }

    @Transactional
    public void replaceProcedureContraindications(int procedureId, Set<Integer> conditionIds) {
        MedicalProcedure p = procedure(procedureId);
        p.getContraindicationIds().clear();
        p.getContraindicationIds().addAll(conditionIds);
        procedures.flush();
    }

    private MedicalProcedure procedure(int id) {
        return procedures.findById(id).orElseThrow(() -> ApiException.notFound("Процедура не найдена"));
    }
}
