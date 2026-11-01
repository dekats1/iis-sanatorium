package sanatorium.core.operations;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import sanatorium.core.operations.OperationsDtos.AmountRequest;
import sanatorium.core.operations.OperationsDtos.ConsumableItemView;
import sanatorium.core.operations.OperationsDtos.CreateConsumableRequest;
import sanatorium.core.operations.OperationsDtos.CreatePackageRequest;
import sanatorium.core.operations.OperationsDtos.CreateStaffRequest;
import sanatorium.core.operations.OperationsDtos.PackageView;
import sanatorium.core.operations.OperationsDtos.StaffMemberView;
import sanatorium.core.operations.OperationsDtos.StatusUpdateRequest;

@RestController
@Tag(name = "operations", description = "Склад, персонал и пакетные предложения")
public class OperationsController {

    private final OperationsService operations;

    public OperationsController(OperationsService operations) {
        this.operations = operations;
    }

    // --- Consumables / Inventory ---
    @GetMapping("/api/inventory")
    @Operation(summary = "Список расходных материалов склада")
    public List<ConsumableItemView> listInventory() {
        return operations.listConsumables();
    }

    @PostMapping("/api/inventory")
    @ResponseStatus(HttpStatus.CREATED)
    @Operation(summary = "Добавить материал на склад")
    public ConsumableItemView createInventory(@Valid @RequestBody CreateConsumableRequest req) {
        return operations.createConsumable(req);
    }

    @PostMapping("/api/inventory/{id}/restock")
    @Operation(summary = "Пополнить остаток материала")
    public ConsumableItemView restock(@PathVariable long id, @Valid @RequestBody AmountRequest req) {
        return operations.restock(id, req.amount());
    }

    @PostMapping("/api/inventory/{id}/write-off")
    @Operation(summary = "Списать расходный материал на процедуры")
    public ConsumableItemView writeOff(@PathVariable long id, @Valid @RequestBody AmountRequest req) {
        return operations.writeOff(id, req.amount());
    }

    // --- Staff ---
    @GetMapping("/api/staff")
    @Operation(summary = "Список сотрудников и график смен")
    public List<StaffMemberView> listStaff() {
        return operations.listStaff();
    }

    @PostMapping("/api/staff")
    @ResponseStatus(HttpStatus.CREATED)
    @Operation(summary = "Добавить сотрудника в график")
    public StaffMemberView createStaff(@Valid @RequestBody CreateStaffRequest req) {
        return operations.createStaff(req);
    }

    @PutMapping("/api/staff/{id}/status")
    @Operation(summary = "Изменить статус сотрудника (на смене, перерыв, выходной)")
    public StaffMemberView updateStaffStatus(@PathVariable long id, @Valid @RequestBody StatusUpdateRequest req) {
        return operations.updateStaffStatus(id, req.status());
    }

    // --- Packages ---
    @GetMapping("/api/packages")
    @Operation(summary = "Список активных пакетных предложений")
    public List<PackageView> listPackages() {
        return operations.listPackages();
    }

    @PostMapping("/api/packages")
    @ResponseStatus(HttpStatus.CREATED)
    @Operation(summary = "Создать новое пакетное предложение")
    public PackageView createPackage(@Valid @RequestBody CreatePackageRequest req) {
        return operations.createPackage(req);
    }

    @PutMapping("/api/packages/{id}/toggle")
    @Operation(summary = "Переключить активность пакетного предложения")
    public PackageView togglePackage(@PathVariable long id) {
        return operations.togglePackage(id);
    }

    @DeleteMapping("/api/packages/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @Operation(summary = "Архивировать пакетное предложение")
    public void deletePackage(@PathVariable long id) {
        operations.deletePackage(id);
    }
}
