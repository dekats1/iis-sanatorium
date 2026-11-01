package sanatorium.core.demo;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.List;

/** Результат работы {@link DemoGenerator}: строки таблиц с уже назначенными идентификаторами. Чистые данные. */
public final class DemoDataset {

    public record ClientRow(long id, String last, String first, String middle, LocalDate birth, String phone, String email,
                            String citizenship) { }

    public record ClientConditionRow(long clientId, String conditionCode, LocalDate diagnosedAt) { }

    public record VoucherRow(long id, long clientId, Long customerId, long channelId, long profileId, Long dietId, long createdBy,
                             String status, BigDecimal pricePerDay, BigDecimal total, OffsetDateTime deadline,
                             OffsetDateTime createdAt) { }

    public record BookingRow(long id, long voucherId, long roomId, LocalDate checkIn, LocalDate checkOut, int places, String status) { }

    public record PlaceRow(long bookingId, long roomId, int placeNo, LocalDate from, LocalDate to, boolean active) { }

    public record PaymentRow(long id, long voucherId, String kind, BigDecimal amount, String status, Long invoiceId,
                             OffsetDateTime createdAt) { }

    public record AssignmentRow(long id, long voucherId, long doctorId, OffsetDateTime createdAt) { }

    public record AssignmentItemRow(long assignmentId, long procedureId, int sessions) { }

    public record SlotRow(long assignmentId, long procedureId, long cabinetId, OffsetDateTime slotDt, boolean done) { }

    public record EhrRow(long clientId, String cardNumber, String bloodType, String allergies, String chronic, int heightCm,
                         BigDecimal weightKg, int systolic, int diastolic, int pulse, OffsetDateTime updatedAt) { }

    public record NoteRow(long clientId, long doctorId, String doctorName, String visitType, String complaints, String objective,
                          String recommendations, OffsetDateTime createdAt) { }

    public record LoyaltyRow(long clientId, int balance, BigDecimal spentMoney, OffsetDateTime createdAt) { }

    public record BonusRow(long clientId, int amount, String type, String description, Long voucherId, OffsetDateTime createdAt) { }

    public record ReviewRow(long id, long voucherId, long clientId, String clientName, String categoryName, String roomNumber,
                            String stayDates, int overall, int nps, int room, int treatment, int food, int service, String comment,
                            String status, String replyText, OffsetDateTime repliedAt, String replierName, OffsetDateTime createdAt) { }

    public record FeedbackRow(long reviewId, String procedureName, int rating, String comment) { }

    public record WaitRow(long clientId, long categoryId, LocalDate from, LocalDate to, int places, String status, OffsetDateTime createdAt) { }

    public record RoomState(long roomId, String status, String notes) { }

    public record NotificationRow(Long userId, String type, String title, String message, String link, boolean read, OffsetDateTime createdAt) { }

    public record AuditRow(Long userId, String action, String entity, String details, OffsetDateTime createdAt) { }

    public final List<ClientRow> clients = new ArrayList<>();
    public final List<ClientConditionRow> clientConditions = new ArrayList<>();
    public final List<VoucherRow> vouchers = new ArrayList<>();
    public final List<BookingRow> bookings = new ArrayList<>();
    public final List<PlaceRow> places = new ArrayList<>();
    public final List<PaymentRow> payments = new ArrayList<>();
    public final List<AssignmentRow> assignments = new ArrayList<>();
    public final List<AssignmentItemRow> assignmentItems = new ArrayList<>();
    public final List<SlotRow> slots = new ArrayList<>();
    public final List<EhrRow> ehr = new ArrayList<>();
    public final List<NoteRow> notes = new ArrayList<>();
    public final List<LoyaltyRow> loyalty = new ArrayList<>();
    public final List<BonusRow> bonuses = new ArrayList<>();
    public final List<ReviewRow> reviews = new ArrayList<>();
    public final List<FeedbackRow> feedbacks = new ArrayList<>();
    public final List<WaitRow> waitlist = new ArrayList<>();
    public final List<RoomState> roomStates = new ArrayList<>();
    public final List<NotificationRow> notifications = new ArrayList<>();
    public final List<AuditRow> audit = new ArrayList<>();
}
