package sanatorium.core.roommap;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import java.util.List;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import sanatorium.core.identity.Access;
import sanatorium.core.roommap.RoomMapDtos.InteractiveRoomView;
import sanatorium.core.roommap.RoomMapDtos.RoomMapStats;
import sanatorium.core.roommap.RoomMapDtos.UpdateRoomStatusRequest;

@RestController
@RequestMapping("/api/interactive-rooms")
@Tag(name = "room-map", description = "Интерактивная карта номеров санатория")
public class RoomMapController {

    private final RoomMapService roomMapService;

    public RoomMapController(RoomMapService roomMapService) {
        this.roomMapService = roomMapService;
    }

    private boolean isStaffUser(Jwt jwt) {
        if (jwt == null) return false;
        List<String> roles = jwt.getClaimAsStringList("roles");
        if (roles == null) return false;
        return roles.stream().anyMatch(r -> r.equalsIgnoreCase("BOOKING_ADMIN") 
                || r.equalsIgnoreCase("MANAGER") 
                || r.equalsIgnoreCase("SYSADMIN") 
                || r.equalsIgnoreCase("DOCTOR"));
    }

    @GetMapping
    @Operation(summary = "Получить схему номеров этажа")
    public List<InteractiveRoomView> list(
            @RequestParam(required = false) Integer floor,
            @RequestParam(required = false) String status,
            @RequestParam(required = false) Integer categoryId,
            @AuthenticationPrincipal Jwt jwt
    ) {
        return roomMapService.listRooms(floor, status, categoryId, isStaffUser(jwt));
    }

    @GetMapping("/{id}")
    @Operation(summary = "Получить данные конкретного номера")
    public InteractiveRoomView get(@PathVariable int id, @AuthenticationPrincipal Jwt jwt) {
        return roomMapService.getRoom(id, isStaffUser(jwt));
    }

    @PutMapping("/{id}/status")
    @Operation(summary = "Изменить статус номера (уборка, свободен, занят)")
    public InteractiveRoomView updateStatus(
            @PathVariable int id,
            @Valid @RequestBody UpdateRoomStatusRequest req,
            @AuthenticationPrincipal Jwt jwt
    ) {
        return roomMapService.updateStatus(id, req, isStaffUser(jwt));
    }

    @GetMapping("/stats")
    @Operation(summary = "Статистика загрузки и статусов номерного фонда")
    public RoomMapStats stats() {
        return roomMapService.getStats();
    }
}
