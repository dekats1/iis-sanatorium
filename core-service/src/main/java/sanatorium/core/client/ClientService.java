package sanatorium.core.client;

import java.util.List;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import sanatorium.core.common.ApiException;
import sanatorium.core.common.Dtos.ClientRequest;
import sanatorium.core.common.Dtos.ClientView;
import sanatorium.core.common.Dtos.ConditionView;

/** Карточки клиентов и состояния здоровья (ФТ-04). */
@Service
public class ClientService {

    private final ClientRepository clients;
    private final ClientConditionRepository conditions;

    public ClientService(ClientRepository clients, ClientConditionRepository conditions) {
        this.clients = clients;
        this.conditions = conditions;
    }

    @Transactional
    public ClientView create(ClientRequest r) {
        Client c = new Client(r.lastName(), r.firstName(), r.birthDate());
        apply(c, r);
        return view(clients.saveAndFlush(c));
    }

    @Transactional
    public ClientView update(long id, ClientRequest r) {
        Client c = clients.findById(id).orElseThrow(() -> ApiException.notFound("Клиент не найден"));
        c.setLastName(r.lastName());
        c.setFirstName(r.firstName());
        c.setBirthDate(r.birthDate());
        apply(c, r);
        return view(clients.saveAndFlush(c));
    }

    @Transactional(readOnly = true)
    public ClientView get(long id) {
        return view(clients.findById(id).orElseThrow(() -> ApiException.notFound("Клиент не найден")));
    }

    /** Поиск по началу фамилии без учёта регистра; служебные символы LIKE экранируются. page — с нуля. */
    @Transactional(readOnly = true)
    public List<ClientView> search(String lastNamePrefix, int page, int size) {
        String prefix = lastNamePrefix == null ? "" : lastNamePrefix.replace("!", "!!").replace("%", "!%").replace("_", "!_");
        return clients.searchByLastName(prefix + "%", PageRequest.of(page, size)).stream().map(ClientService::view).toList();
    }

    @Transactional(readOnly = true)
    public List<ConditionView> conditions(long clientId) {
        requireClient(clientId);
        return conditions.findRows(clientId).stream()
                .map(r -> new ConditionView(r.conditionId(), r.code(), r.name(), r.diagnosedAt())).toList();
    }

    /** Добавляет состояние или обновляет дату диагноза. Несуществующее состояние → нарушение FK (422 в обработчике). */
    @Transactional
    public void addCondition(long clientId, int conditionId, java.time.LocalDate diagnosedAt) {
        requireClient(clientId);
        var id = new ClientConditionId(clientId, conditionId);
        ClientCondition existing = conditions.findById(id).orElse(null);
        if (existing != null) {
            existing.setDiagnosedAt(diagnosedAt);
        } else {
            conditions.saveAndFlush(new ClientCondition(clientId, conditionId, diagnosedAt));
        }
    }

    @Transactional
    public void removeCondition(long clientId, int conditionId) {
        var id = new ClientConditionId(clientId, conditionId);
        if (!conditions.existsById(id)) {
            throw ApiException.notFound("Состояние у клиента не найдено");
        }
        conditions.deleteById(id);
    }

    private void requireClient(long id) {
        if (!clients.existsById(id)) {
            throw ApiException.notFound("Клиент не найден");
        }
    }

    private static void apply(Client c, ClientRequest r) {
        c.setMiddleName(blank(r.middleName()));
        c.setPhone(blank(r.phone()));
        c.setEmail(blank(r.email()));
        c.setCitizenship(blank(r.citizenship()));
    }

    private static ClientView view(Client c) {
        return new ClientView(c.getId(), c.getLastName(), c.getFirstName(), c.getMiddleName(), c.getBirthDate(),
                c.getPhone(), c.getEmail(), c.getCitizenship());
    }

    private static String blank(String s) {
        return s == null || s.isBlank() ? null : s;
    }
}
