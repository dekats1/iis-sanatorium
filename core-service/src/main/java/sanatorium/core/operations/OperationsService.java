package sanatorium.core.operations;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.stream.Collectors;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import sanatorium.core.common.ApiException;
import sanatorium.core.directory.RoomCategory;
import sanatorium.core.directory.RoomCategoryRepository;
import sanatorium.core.directory.TreatmentProfile;
import sanatorium.core.directory.TreatmentProfileRepository;
import sanatorium.core.operations.OperationsDtos.ConsumableItemView;
import sanatorium.core.operations.OperationsDtos.CreateConsumableRequest;
import sanatorium.core.operations.OperationsDtos.CreatePackageRequest;
import sanatorium.core.operations.OperationsDtos.CreateStaffRequest;
import sanatorium.core.operations.OperationsDtos.PackageView;
import sanatorium.core.operations.OperationsDtos.StaffMemberView;

@Service
public class OperationsService {

    private final ConsumableRepository consumableRepository;
    private final StaffMemberRepository staffRepository;
    private final SanatoriumPackageRepository packageRepository;
    private final RoomCategoryRepository categoryRepository;
    private final TreatmentProfileRepository profileRepository;

    public OperationsService(ConsumableRepository consumableRepository,
                             StaffMemberRepository staffRepository,
                             SanatoriumPackageRepository packageRepository,
                             RoomCategoryRepository categoryRepository,
                             TreatmentProfileRepository profileRepository) {
        this.consumableRepository = consumableRepository;
        this.staffRepository = staffRepository;
        this.packageRepository = packageRepository;
        this.categoryRepository = categoryRepository;
        this.profileRepository = profileRepository;
    }

    // --- Consumables ---
    @Transactional(readOnly = true)
    public List<ConsumableItemView> listConsumables() {
        return consumableRepository.findAllByOrderByNameAsc().stream()
                .map(this::toConsumableView)
                .collect(Collectors.toList());
    }

    @Transactional
    public ConsumableItemView createConsumable(CreateConsumableRequest req) {
        if (consumableRepository.findBySku(req.sku()).isPresent()) {
            throw ApiException.conflict("Материал с артикулом " + req.sku() + " уже существует");
        }

        Consumable c = new Consumable(
                req.sku().trim(),
                req.name().trim(),
                req.category().trim(),
                req.cabinetId(),
                req.cabinetName() != null ? req.cabinetName().trim() : "Кабинет процедур",
                req.unit().trim(),
                req.stockQuantity(),
                req.minThreshold()
        );
        return toConsumableView(consumableRepository.save(c));
    }

    @Transactional
    public ConsumableItemView restock(long id, BigDecimal amount) {
        Consumable c = consumableRepository.findById(id)
                .orElseThrow(() -> ApiException.notFound("Материал не найден"));
        c.setStockQuantity(c.getStockQuantity().add(amount));
        c.setLastRestockedAt(OffsetDateTime.now());
        return toConsumableView(consumableRepository.save(c));
    }

    @Transactional
    public ConsumableItemView writeOff(long id, BigDecimal amount) {
        Consumable c = consumableRepository.findById(id)
                .orElseThrow(() -> ApiException.notFound("Материал не найден"));
        BigDecimal newQty = c.getStockQuantity().subtract(amount);
        c.setStockQuantity(newQty.compareTo(BigDecimal.ZERO) < 0 ? BigDecimal.ZERO : newQty);
        return toConsumableView(consumableRepository.save(c));
    }

    // --- Staff ---
    @Transactional(readOnly = true)
    public List<StaffMemberView> listStaff() {
        return staffRepository.findAllByOrderByFullNameAsc().stream()
                .map(this::toStaffView)
                .collect(Collectors.toList());
    }

    @Transactional
    public StaffMemberView createStaff(CreateStaffRequest req) {
        StaffMember s = new StaffMember(
                req.fullName().trim(),
                req.role().trim(),
                req.cabinetName() != null ? req.cabinetName().trim() : "Кабинет №1",
                req.shiftHours().trim(),
                req.status() != null ? req.status().trim() : "ON_SHIFT",
                req.assignedSlotsToday(),
                req.maxSlotsPerDay() > 0 ? req.maxSlotsPerDay() : 15,
                req.rating() != null ? req.rating() : BigDecimal.valueOf(4.90)
        );
        return toStaffView(staffRepository.save(s));
    }

    @Transactional
    public StaffMemberView updateStaffStatus(long id, String status) {
        StaffMember s = staffRepository.findById(id)
                .orElseThrow(() -> ApiException.notFound("Сотрудник не найден"));
        s.setStatus(status.trim());
        return toStaffView(staffRepository.save(s));
    }

    // --- Packages ---
    @Transactional(readOnly = true)
    public List<PackageView> listPackages() {
        return packageRepository.findByActiveTrueOrderByCreatedAtDesc().stream()
                .map(this::toPackageView)
                .collect(Collectors.toList());
    }

    @Transactional
    public PackageView createPackage(CreatePackageRequest req) {
        RoomCategory cat = categoryRepository.findById(req.categoryId()).orElse(null);
        String catName = cat != null ? cat.getName() : "Категория #" + req.categoryId();

        TreatmentProfile prof = profileRepository.findById(req.profileId()).orElse(null);
        String profName = prof != null ? prof.getName() : "Профиль #" + req.profileId();

        SanatoriumPackage p = new SanatoriumPackage(
                req.name().trim(),
                req.description().trim(),
                req.categoryId(),
                catName,
                req.profileId(),
                profName,
                req.durationNights(),
                req.basePrice(),
                req.packagePrice(),
                req.badge() != null ? req.badge().trim() : "Хит"
        );
        return toPackageView(packageRepository.save(p));
    }

    @Transactional
    public void deletePackage(long id) {
        SanatoriumPackage p = packageRepository.findById(id)
                .orElseThrow(() -> ApiException.notFound("Пакет не найден"));
        p.setActive(false);
        packageRepository.save(p);
    }

    @Transactional
    public PackageView togglePackage(long id) {
        SanatoriumPackage p = packageRepository.findById(id)
                .orElseThrow(() -> ApiException.notFound("Пакет не найден"));
        p.setActive(!p.isActive());
        return toPackageView(packageRepository.save(p));
    }

    // --- Mappers ---
    private ConsumableItemView toConsumableView(Consumable c) {
        return new ConsumableItemView(
                c.getId(),
                c.getSku(),
                c.getName(),
                c.getCategory(),
                c.getCabinetId(),
                c.getCabinetName(),
                c.getUnit(),
                c.getStockQuantity(),
                c.getMinThreshold(),
                c.getLastRestockedAt()
        );
    }

    private StaffMemberView toStaffView(StaffMember s) {
        return new StaffMemberView(
                s.getId(),
                s.getFullName(),
                s.getRole(),
                s.getCabinetName(),
                s.getShiftHours(),
                s.getStatus(),
                s.getAssignedSlotsToday(),
                s.getMaxSlotsPerDay(),
                s.getRating()
        );
    }

    private PackageView toPackageView(SanatoriumPackage p) {
        return new PackageView(
                p.getId(),
                p.getName(),
                p.getDescription(),
                p.getCategoryId(),
                p.getCategoryName(),
                p.getProfileId(),
                p.getProfileName(),
                p.getDurationNights(),
                p.getBasePrice(),
                p.getPackagePrice(),
                p.getBadge(),
                p.isActive()
        );
    }
}
