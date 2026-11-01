// Типы соответствуют DTO core-service (Dtos.java) и схемам pricing-forecast. Деньги приходят числами JSON.

export type Role = 'CLIENT' | 'BOOKING_ADMIN' | 'DOCTOR' | 'MANAGER' | 'SYSADMIN';

export interface TokenResponse {
  token: string;
  tokenType: string;
  expiresInMinutes: number;
  roles: Role[];
}

export interface RegisterRequest {
  username: string;
  password: string;
  lastName: string;
  firstName: string;
  middleName?: string;
  birthDate: string;
  email?: string;
  phone?: string;
}

export interface CategoryAvailability {
  categoryId: number;
  name: string;
  freePlaces: number;
  maxPlacesInOneRoom: number;
  pricePerPlaceDay: number | null;
  totalPerPlace: number | null;
  priceFromSnapshot: boolean;
  priceAvailable: boolean;
  photos?: string[];
  coverUrl?: string;
}

export interface CreateVoucherRequest {
  clientId?: number;
  categoryId: number;
  checkIn: string;
  checkOut: string;
  places: number;
  profileId: number;
  channelId: number;
  dietId?: number;
  customerId?: number;
}

export interface VoucherView {
  id: number;
  clientId: number;
  status: string;
  categoryId: number | null;
  roomNumber: string | null;
  checkIn: string | null;
  checkOut: string | null;
  places: number | null;
  pricePerPlaceDay: number | null;
  totalPrice: number | null;
  currency: string | null;
  paymentDeadline: string | null;
  paid: number | null;
}

export interface PayResponse {
  paymentId: number;
  invoiceId: number;
  amount: number;
  currency: string;
  payUrl: string;
}

export interface CancelResponse {
  voucher: VoucherView;
  retainPercent: number;
  retained: number;
  refund: number;
}

export interface WaitlistRequest {
  clientId?: number;
  categoryId: number;
  dateFrom: string;
  dateTo: string;
  places: number;
}

export interface WaitlistEntry {
  id: number;
  clientId: number;
  categoryId: number;
  dateFrom: string;
  dateTo: string;
  places: number;
  status: string;
  createdAt: string;
}

export interface ClientRequest {
  lastName: string;
  firstName: string;
  middleName?: string;
  birthDate: string;
  phone?: string;
  email?: string;
  citizenship?: string;
}

export interface ClientView extends ClientRequest {
  id: number;
}

export interface ConditionView {
  conditionId: number;
  code: string;
  name: string;
  diagnosedAt: string | null;
}

export interface AssignmentItem {
  procedureId: number;
  sessions: number;
}

export interface AssignmentRequest {
  voucherId: number;
  items: AssignmentItem[];
  confirmContraindications: boolean;
}

export interface ContraindicationWarning {
  procedureId: number;
  procedure: string;
  conditionId: number;
  condition: string;
}

export interface AssignmentView {
  id: number;
  voucherId: number;
  doctorId: number;
  createdAt: string;
  items: { procedureId: number; procedure: string; sessionsPlanned: number }[];
}

export interface ScheduleEntry {
  id: number;
  assignmentId: number;
  procedureId: number;
  procedure: string;
  cabinet: string;
  slot: string;
  done: boolean;
  voucherId: number;
  clientName: string;
}

export interface KpiView {
  from: string;
  to: string;
  availablePlaceDays: number;
  soldPlaceDays: number;
  occPct: number;
  adr: number;
  revpar: number;
}

export interface ChannelRevenue {
  channel: string;
  vouchers: number;
  revenue: number;
  commission: number;
}

export interface UserRow {
  id: number;
  username: string;
  fullName: string;
  email: string | null;
  active: boolean;
  roles: Role[];
}

export interface AuditRow {
  id: number;
  createdAt: string;
  userId: number | null;
  username: string | null;
  action: string;
  entity: string;
  details: string | null;
}

// ----- личный профиль (ФТ-21) -----
export interface MeView {
  id: number;
  username: string;
  fullName: string;
  email: string | null;
  active: boolean;
  roles: string[];
  avatarUrl?: string | null;
}

// ----- справочники -----
export interface RoomCategory { id: number; name: string; capacityTotal: number; description: string | null }
export interface Coded { id: number; code: string; name: string }
export interface SalesChannel { id: number; name: string; commissionPct: number; quotaPlaces: number | null }
export interface Procedure { id: number; name: string; durationMin: number; cabinetId: number }
export interface Room { id: number; categoryId: number; roomNumber: string; floor: number }
export interface Cabinet { id: number; name: string; slotsPerDay: number }
export interface Customer { id: number; type: 'ORG' | 'PERSON'; name: string; contractNo: string | null }

/** Универсальная запись справочника; конкретные поля дают интерфейсы выше. */
export type DirectoryRecord = { id: number } & Record<string, unknown>;

// ----- pricing-forecast -----
export interface PriceReview {
  id: number;
  quote_id: string;
  category_id: number;
  stay_date: string;
  price_recommended: number;
  price_applied: number;
  p_min: number;
  p_max: number;
  status: string;
  created_at: string;
  decided_by: string | null;
  decided_at: string | null;
}

export interface ForecastPoint {
  stay_date: string;
  predicted_occ: number;
}

export interface ForecastRunResult {
  run_id: number;
  mape: number | null;
  points: number;
}

/** Точка истории спроса: продано/доступно мест за дату заезда (ФТ-15). */
export interface HistoryPoint {
  stay_date: string;
  sold: number;
  available: number;
}

// ----- Программа лояльности & Бонусная система (Идея 1) -----
export type LoyaltyTier = 'BRONZE' | 'SILVER' | 'GOLD' | 'PLATINUM';

export interface LoyaltyAccount {
  clientId: number;
  tier: LoyaltyTier;
  tierName: string;
  balance: number;
  totalEarned: number;
  totalSpent: number;
  spentMoneyTotal: number;
  nextTierThreshold: number | null;
  cashbackPercent: number;
  discountPercent: number;
  privileges: string[];
}

export type BonusTransactionType = 'ACCRUAL' | 'REDEMPTION' | 'WELCOME' | 'PROMO' | 'ADJUSTMENT';

export interface BonusTransaction {
  id: number;
  clientId: number;
  amount: number;
  type: BonusTransactionType;
  description: string;
  createdAt: string;
  voucherId?: number;
}

// ----- Электронная медицинская карта (EHR - Идея 4) -----
export interface EhrRecord {
  clientId: number;
  sanatoriumCardNumber?: string;
  cardIssuedDate?: string;
  mainDiagnosis?: string;
  bloodType?: string;
  heightCm?: number;
  weightKg?: number;
  bmi?: number;
  systolicBp?: number;
  diastolicBp?: number;
  pulseBpm?: number;
  allergies: string[];
  contraindications: string[];
  dietCode?: string;
  updatedAt: string;
}

export type VisitType = 'INITIAL' | 'CONTROL' | 'DISCHARGE';

export interface DoctorNote {
  id: number;
  clientId: number;
  voucherId?: number;
  doctorId: number;
  doctorName: string;
  visitType: VisitType;
  complaints: string;
  objectiveStatus: string;
  recommendations: string;
  createdAt: string;
}

// ----- Система уведомлений (Идея 5) -----
export type NotificationType = 'INFO' | 'PAYMENT' | 'MEDICAL' | 'WAITLIST' | 'LOYALTY';

export interface AppNotification {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  createdAt: string;
  read: boolean;
  link?: string;
}

// ----- Логика возвратов (Идея 11) -----
export interface RefundCalculation {
  voucherId: number;
  totalPrice: number;
  paidAmount: number;
  daysBeforeCheckIn: number;
  retainPercent: number;
  retainedAmount: number;
  refundAmount: number;
  policyDescription: string;
}

export interface RefundRequest {
  voucherId: number;
  reason: string;
  comments?: string;
  bankAccountOrCard?: string;
}

// ----- Бизнес-аналитика & BI (Идея 9) -----
export interface BiMonthlyPoint {
  month: string;
  revenue: number;
  targetRevenue: number;
  occupancyPct: number;
  vouchersCount: number;
}

export interface ProfilePopularity {
  profileId: number;
  profileName: string;
  vouchersCount: number;
  sharePercent: number;
  revenue: number;
}

// ----- Конструктор пакетов (Идея 10) -----
export interface PackageProcedureItem {
  procedureId: number;
  procedureName: string;
  sessions: number;
}

export interface SanatoriumPackage {
  id: number;
  name: string;
  description: string;
  categoryId: number;
  categoryName: string;
  profileId: number;
  profileName: string;
  dietId?: number;
  dietName?: string;
  durationNights: number;
  includedProcedures: PackageProcedureItem[];
  basePrice: number;
  packagePrice: number;
  discountPercent: number;
  isActive: boolean;
  badge?: string;
}

// ----- Учёт расходников и медикаментов (Идея 8) -----
export type StockStatus = 'IN_STOCK' | 'LOW_STOCK' | 'CRITICAL';

export interface ConsumableItem {
  id: number;
  sku: string;
  name: string;
  category: string;
  cabinetId: number;
  cabinetName: string;
  unit: string;
  stockQuantity: number;
  minThreshold: number;
  status: StockStatus;
  lastRestockedAt: string;
}

// ----- Управление персоналом (Идея 7) -----
export type StaffStatus = 'ON_SHIFT' | 'VACATION' | 'SICK_LEAVE';

export interface StaffMember {
  id: number;
  fullName: string;
  role: string;
  cabinetName: string;
  shiftHours: string;
  status: StaffStatus;
  assignedSlotsToday: number;
  maxSlotsPerDay: number;
  utilizationPercent: number;
  rating: number;
}

// ----- Интерактивная карта номеров (Идея 13) -----
export type RoomStatus = 'VACANT' | 'OCCUPIED' | 'CLEANING' | 'RESERVED';

export interface InteractiveRoom {
  id: number;
  roomNumber: string;
  categoryId: number;
  categoryName: string;
  floor: number;
  building: string;
  capacity: number;
  status: RoomStatus;
  pricePerDay: number;
  windowView: string;
  amenities: string[];
  photos?: string[];
  currentGuestName?: string;
  voucherCode?: string;
  checkInDate?: string;
  checkOutDate?: string;
  notes?: string;
}

// ----- Умные рекомендации оздоровительных программ и процедур (Идея 3) -----
export interface HealthGoalOption {
  id: string;
  title: string;
  icon: string;
  description: string;
  recommendedProfileId: number;
  recommendedProfileName: string;
  recommendedDietId: number;
  recommendedDietName: string;
  recommendedDurationDays: number;
  matchingPackageId?: number;
  recommendedProcedures: { name: string; benefit: string; durationMin?: number }[];
  cautions: string[];
  lifestyleAdvice: string;
}

export interface HealthRecommendationResult {
  goal: HealthGoalOption;
  profileId: number;
  profileName: string;
  dietId: number;
  dietName: string;
  recommendedFloorNote: string;
  procedures: { name: string; benefit: string }[];
  contraindicationsAlert: string[];
  suggestedDurationNights: number;
  matchScore: number;
  packageSuggestion?: SanatoriumPackage;
}

// ----- Система отзывов и контроля качества (Идея 6) -----
export interface ProcedureFeedback {
  procedureName: string;
  rating: number; // 1-5
  comment?: string;
}

export interface GuestReview {
  id: number;
  voucherId: number;
  clientId: number;
  clientName: string;
  categoryName: string;
  roomNumber?: string;
  stayDates: string;
  overallRating: number; // 1-5 stars
  npsScore: number; // 0-10 Net Promoter Score
  categoriesRating: {
    room: number;
    treatment: number;
    food: number;
    service: number;
  };
  procedureFeedback?: ProcedureFeedback[];
  comment: string;
  createdAt: string;
  status: 'PUBLISHED' | 'PENDING' | 'REJECTED';
  managementResponse?: {
    replyText: string;
    repliedAt: string;
    replierName: string;
  };
}

export interface CreateReviewRequest {
  voucherId: number;
  clientId: number;
  clientName: string;
  categoryName: string;
  roomNumber?: string;
  stayDates: string;
  overallRating: number;
  npsScore: number;
  categoriesRating: {
    room: number;
    treatment: number;
    food: number;
    service: number;
  };
  procedureFeedback?: ProcedureFeedback[];
  comment: string;
}

export interface ReviewQualityStats {
  averageOverall: number;
  npsIndex: number; // NPS % = (Promoters - Detractors) / Total * 100
  totalReviews: number;
  promotersCount: number;
  passivesCount: number;
  detractorsCount: number;
  categoryAverages: {
    room: number;
    treatment: number;
    food: number;
    service: number;
  };
  ratingsDistribution: {
    5: number;
    4: number;
    3: number;
    2: number;
    1: number;
  };
  topRatedProcedures: Array<{
    name: string;
    avgRating: number;
    reviewCount: number;
  }>;
}



