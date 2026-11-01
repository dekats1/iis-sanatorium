package sanatorium.core.common;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.List;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Past;
import jakarta.validation.constraints.Size;

/** DTO REST API core-service (описание контракта — OpenAPI, раздел 3.4 главы 3). */
public final class Dtos {

    private Dtos() { }

    public record LoginRequest(@NotBlank String username, @NotBlank String password) { }

    public record TokenResponse(String token, String tokenType, int expiresInMinutes, List<String> roles) { }

    public record RegisterRequest(
            @NotBlank @Size(min = 3, max = 50) String username,
            @NotBlank @Size(min = 8, max = 72) String password, // 72 байта — предел BCrypt
            @NotBlank @Size(max = 80) String lastName,
            @NotBlank @Size(max = 80) String firstName,
            @Size(max = 80) String middleName,
            @NotNull @Past LocalDate birthDate,
            @Email @Size(max = 150) String email,
            @Size(max = 30) String phone) { }

    public record CategoryAvailability(int categoryId, String name, int freePlaces, int maxPlacesInOneRoom,
                                       BigDecimal pricePerPlaceDay, BigDecimal totalPerPlace,
                                       boolean priceFromSnapshot, boolean priceAvailable) { }

    public record CreateVoucherRequest(
            Long clientId, // обязателен для BOOKING_ADMIN; для CLIENT игнорируется
            @NotNull Integer categoryId,
            @NotNull LocalDate checkIn,
            @NotNull LocalDate checkOut,
            @Min(1) @Max(10) int places,
            @NotNull Integer profileId,
            @NotNull Integer channelId,
            Integer dietId,
            Long customerId) { }

    public record VoucherView(long id, long clientId, String status, Integer categoryId, String roomNumber,
                              LocalDate checkIn, LocalDate checkOut, Integer places,
                              BigDecimal pricePerPlaceDay, BigDecimal totalPrice, String currency,
                              OffsetDateTime paymentDeadline, BigDecimal paid) { }

    public record PayResponse(long paymentId, long invoiceId, BigDecimal amount, String currency, String payUrl) { }

    /** Тело вебхука платёжного сервиса. externalId — идентификатор путёвки, переданный при выставлении счёта. */
    public record CallbackRequest(@NotNull Long externalId, @NotNull Long invoiceId,
                                  @NotBlank String status, @NotNull BigDecimal amount) { }

    public record KpiView(LocalDate from, LocalDate to, long availablePlaceDays, long soldPlaceDays,
                          BigDecimal occPct, BigDecimal adr, BigDecimal revpar) { }

    public record ChannelRevenue(String channel, long vouchers, BigDecimal revenue, BigDecimal commission) { }

    public record BiMonthlyPoint(String month, BigDecimal revenue, BigDecimal targetRevenue, BigDecimal occupancyPct, int vouchersCount) { }

    public record ProfilePopularity(int profileId, String profileName, long vouchersCount, BigDecimal sharePercent, BigDecimal revenue) { }

    public record CancelResponse(VoucherView voucher, int retainPercent, BigDecimal retained, BigDecimal refund) { }

    public record WaitlistRequest(
            Long clientId, // обязателен для BOOKING_ADMIN; для CLIENT игнорируется
            @NotNull Integer categoryId,
            @NotNull LocalDate dateFrom,
            @NotNull LocalDate dateTo,
            @Min(1) @Max(10) int places) { }

    public record WaitlistEntry(long id, long clientId, int categoryId, LocalDate dateFrom, LocalDate dateTo,
                                int places, String status, OffsetDateTime createdAt) { }

    // ----- клиенты и состояния здоровья -----
    public record ClientRequest(
            @NotBlank @Size(max = 80) String lastName,
            @NotBlank @Size(max = 80) String firstName,
            @Size(max = 80) String middleName,
            @NotNull @Past LocalDate birthDate,
            @Size(max = 30) String phone,
            @Email @Size(max = 150) String email,
            @Size(max = 60) String citizenship) { }

    public record ClientView(long id, String lastName, String firstName, String middleName, LocalDate birthDate,
                             String phone, String email, String citizenship) { }

    public record ConditionRequest(@NotNull Integer conditionId, LocalDate diagnosedAt) { }

    public record ConditionView(int conditionId, String code, String name, LocalDate diagnosedAt) { }

    // ----- лечение (ФТ-12–14) -----
    public record AssignmentItem(@NotNull Integer procedureId, @Min(1) @Max(30) int sessions) { }

    public record AssignmentRequest(@NotNull Long voucherId, @NotNull @Size(min = 1, max = 20) List<@jakarta.validation.Valid AssignmentItem> items,
                                    boolean confirmContraindications) { }

    public record ContraindicationWarning(int procedureId, String procedure, int conditionId, String condition) { }

    public record AssignmentView(long id, long voucherId, long doctorId, OffsetDateTime createdAt, List<AssignmentItemView> items) { }

    public record AssignmentItemView(int procedureId, String procedure, int sessionsPlanned) { }

    public record ScheduleEntry(long id, long assignmentId, int procedureId, String procedure, String cabinet,
                                OffsetDateTime slot, boolean done, long voucherId, String clientName) { }
}
