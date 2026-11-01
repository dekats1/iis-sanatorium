package sanatorium.core.ehr;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import java.util.List;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import sanatorium.core.client.ClientRepository;
import sanatorium.core.common.ApiException;
import sanatorium.core.ehr.EhrDtos.CreateDoctorNoteRequest;
import sanatorium.core.ehr.EhrDtos.DoctorNoteView;
import sanatorium.core.ehr.EhrDtos.EhrRecordView;
import sanatorium.core.ehr.EhrDtos.UpdateEhrRequest;
import sanatorium.core.identity.Access;

@RestController
@RequestMapping("/api/ehr")
@Tag(name = "ehr", description = "Электронная медицинская карта (EHR) и записи врачей")
public class EhrController {

    private final EhrService ehrService;
    private final ClientRepository clientRepository;

    public EhrController(EhrService ehrService, ClientRepository clientRepository) {
        this.ehrService = ehrService;
        this.clientRepository = clientRepository;
    }

    private Long resolveClientId(Long paramClientId, Jwt jwt) {
        if (paramClientId != null) {
            return paramClientId;
        }
        if (jwt != null) {
            return clientRepository.findIdByUserId(Access.userId(jwt))
                    .orElseThrow(() -> ApiException.notFound("Профиль клиента не найден"));
        }
        return 1L;
    }

    @GetMapping("/my")
    @Operation(summary = "Получить электронную медкарту текущего пациента")
    public EhrRecordView myEhr(@AuthenticationPrincipal Jwt jwt) {
        Long clientId = resolveClientId(null, jwt);
        return ehrService.getView(clientId);
    }

    @GetMapping("/{clientId}")
    @Operation(summary = "Получить электронную медкарту по clientId")
    public EhrRecordView ehrByClient(@PathVariable long clientId) {
        return ehrService.getView(clientId);
    }

    @PutMapping("/{clientId}")
    @Operation(summary = "Обновить показатели здоровья в медкарте")
    public EhrRecordView updateEhr(@PathVariable long clientId, @Valid @RequestBody UpdateEhrRequest req) {
        return ehrService.update(clientId, req);
    }

    @GetMapping("/{clientId}/notes")
    @Operation(summary = "Получить дневник врачебных записей и рекомендаций")
    public List<DoctorNoteView> notes(@PathVariable long clientId) {
        return ehrService.getNotes(clientId);
    }

    @PostMapping("/notes")
    @Operation(summary = "Добавить врачебную запись в карту пациента")
    public DoctorNoteView addNote(@Valid @RequestBody CreateDoctorNoteRequest req, @AuthenticationPrincipal Jwt jwt) {
        Long doctorId = jwt != null ? Access.userId(jwt) : null;
        return ehrService.addNote(req, doctorId);
    }
}
