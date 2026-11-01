package sanatorium.core.loyalty;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import java.util.List;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import sanatorium.core.client.ClientRepository;
import sanatorium.core.common.ApiException;
import sanatorium.core.identity.Access;
import sanatorium.core.loyalty.LoyaltyDtos.AddBonusRequest;
import sanatorium.core.loyalty.LoyaltyDtos.ApplyBonusesRequest;
import sanatorium.core.loyalty.LoyaltyDtos.ApplyBonusesResult;
import sanatorium.core.loyalty.LoyaltyDtos.BonusTransactionView;
import sanatorium.core.loyalty.LoyaltyDtos.LoyaltyAccountView;

@RestController
@RequestMapping("/api/loyalty")
@Tag(name = "loyalty", description = "Программа лояльности и бонусы гостей")
public class LoyaltyController {

    private final LoyaltyService loyaltyService;
    private final ClientRepository clientRepository;

    public LoyaltyController(LoyaltyService loyaltyService, ClientRepository clientRepository) {
        this.loyaltyService = loyaltyService;
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

    @GetMapping("/account")
    @Operation(summary = "Получить данные программы лояльности текущего клиента")
    public LoyaltyAccountView myAccount(@org.springframework.web.bind.annotation.RequestParam(required = false) Long clientId,
                                        @AuthenticationPrincipal Jwt jwt) {
        Long resolved = resolveClientId(clientId, jwt);
        return loyaltyService.getAccountView(resolved);
    }

    @GetMapping("/account/{clientId}")
    @Operation(summary = "Получить данные программы лояльности по clientId")
    public LoyaltyAccountView accountByClient(@PathVariable long clientId) {
        return loyaltyService.getAccountView(clientId);
    }

    @GetMapping("/transactions")
    @Operation(summary = "История бонусных операций текущего клиента")
    public List<BonusTransactionView> myTransactions(@org.springframework.web.bind.annotation.RequestParam(required = false) Long clientId,
                                                     @AuthenticationPrincipal Jwt jwt) {
        Long resolved = resolveClientId(clientId, jwt);
        return loyaltyService.getTransactions(resolved);
    }

    @GetMapping("/transactions/{clientId}")
    @Operation(summary = "История бонусных операций по clientId")
    public List<BonusTransactionView> transactionsByClient(@PathVariable long clientId) {
        return loyaltyService.getTransactions(clientId);
    }

    @PostMapping("/add-bonus")
    @Operation(summary = "Начислить или скорректировать бонусы клиента")
    public LoyaltyAccountView addBonus(@Valid @RequestBody AddBonusRequest req) {
        return loyaltyService.addBonus(req.clientId(), req.amount(), req.description(), null, BonusTransactionType.ADJUSTMENT);
    }

    @PostMapping("/apply")
    @Operation(summary = "Списать бонусы в счёт оплаты путёвки")
    public ApplyBonusesResult apply(@Valid @RequestBody ApplyBonusesRequest req) {
        return loyaltyService.applyBonuses(req.clientId(), req.voucherId(), req.bonusPoints());
    }
}
