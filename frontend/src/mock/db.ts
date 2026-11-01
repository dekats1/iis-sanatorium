import type {
  AppNotification, AuditRow, BonusTransaction, Cabinet, ClientView, Coded, ConsumableItem, Customer, DoctorNote,
  EhrRecord, GuestReview, PriceReview, Procedure, Role, SalesChannel, SanatoriumPackage, StaffMember,
} from '../types';
import { localToday } from './util';

export const DB_VERSION = 3;
export const STORAGE_KEY = `sanatorium_demo_db_v${DB_VERSION}`;

export interface UserRec {
  id: number;
  username: string;
  password: string;
  fullName: string;
  email: string | null;
  active: boolean;
  roles: Role[];
  clientId?: number;
}

export interface CategoryRec { id: number; name: string; capacityTotal: number; description: string | null }
export interface RoomRec {
  id: number; categoryId: number; roomNumber: string; floor: number; building: string;
  windowView: string; amenities: string[]; statusOverride?: 'CLEANING' | 'VACANT' | 'RESERVED' | 'OCCUPIED'; notes?: string;
}

export type VoucherStatus = 'DRAFT' | 'AWAITING_PAYMENT' | 'CONFIRMED' | 'CHECKED_IN' | 'COMPLETED' | 'CANCELLED' | 'EXPIRED';

export interface VoucherRec {
  id: number; clientId: number; status: VoucherStatus; categoryId: number; roomId: number;
  checkIn: string; checkOut: string; places: number;
  pricePerPlaceDay: number; totalPrice: number; currency: string; paymentDeadline: string | null; paid: number;
  profileId: number; channelId: number; dietId: number | null; customerId: number | null;
  createdAt: string; createdBy: number | null; refunded?: number; retained?: number;
}

export interface WaitlistRec {
  id: number; clientId: number; categoryId: number; dateFrom: string; dateTo: string; places: number;
  status: 'OPEN' | 'NOTIFIED' | 'CLOSED'; createdAt: string;
}

export interface AssignmentRec {
  id: number; voucherId: number; doctorId: number; createdAt: string;
  items: { procedureId: number; sessionsPlanned: number }[]; planned: boolean;
}
export interface SlotRec {
  id: number; assignmentId: number; procedureId: number; cabinetId: number; date: string; startMinute: number; slotIndex: number; done: boolean;
}

export interface SeasonRec { id: number; name: string; date_from: string; date_to: string; k_season: number }
export interface TariffRec { id: number; season_id: number; category_id: number; price_base: number }
export interface CorridorRec { id: number; category_id: number; date_from: string; date_to: string; p_min: number; p_max: number; min_los: number; closed: boolean }
export interface HistoryRec { stay_date: string; sold: number; available: number }
export interface ForecastRec { run_id: number; category_id: number; stay_date: string; predicted_occ: number; lower: number; upper: number; created_at: string }

export interface NotificationRec extends AppNotification { userId: number }
export interface LoyaltyAcc { balance: number; spentMoney: number }
export interface RefundRec { id: number; voucherId: number; reason: string; comments?: string; amount: number; createdAt: string }

export interface Db {
  seedDate: string;
  windowStart: string;
  seq: Record<string, number>;
  users: UserRec[];
  categories: CategoryRec[];
  rooms: RoomRec[];
  profiles: Coded[];
  diets: Coded[];
  conditions: Coded[];
  channels: SalesChannel[];
  procedures: Procedure[];
  cabinets: Cabinet[];
  customers: Customer[];
  procProfile: [number, number][]; // [profileId, procedureId]
  contra: [number, number][]; // [procedureId, conditionId]
  clients: ClientView[];
  clientConditions: { clientId: number; conditionId: number; diagnosedAt: string | null }[];
  vouchers: VoucherRec[];
  waitlist: WaitlistRec[];
  assignments: AssignmentRec[];
  slots: SlotRec[];
  seasons: SeasonRec[];
  tariffs: TariffRec[];
  corridors: CorridorRec[];
  priceReviews: PriceReview[];
  history: Record<number, HistoryRec[]>;
  forecasts: ForecastRec[];
  forecastRuns: { id: number; mape: number | null; created_at: string; category_id: number }[];
  loyalty: Record<number, LoyaltyAcc>;
  bonusTx: BonusTransaction[];
  ehr: Record<number, EhrRecord>;
  notes: DoctorNote[];
  notifications: NotificationRec[];
  guestReviews: GuestReview[];
  packages: SanatoriumPackage[];
  inventory: ConsumableItem[];
  staff: StaffMember[];
  audit: AuditRow[];
  refunds: RefundRec[];
}

let db: Db | null = null;
let builder: (() => Db) | null = null;

export function setBuilder(fn: () => Db): void { builder = fn; }
export function getDb(): Db {
  if (!db) throw new Error('Демо-база не инициализирована');
  return db;
}
export function setDb(next: Db): void { db = next; }

export function nextId(key: string): number {
  const d = getDb();
  d.seq[key] = (d.seq[key] ?? 0) + 1;
  return d.seq[key];
}

let saveTimer: ReturnType<typeof setTimeout> | null = null;
export function persist(): void {
  if (!db) return;
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => persistNow(), 150);
}
export function persistNow(): void {
  if (!db) return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
  } catch {
    // хранилище недоступно или переполнено — демо продолжает работать в памяти
  }
}

export function loadOrCreate(): Db {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Db;
      // даты данных относительны «сегодня»: на следующий день набор пересоздаётся
      if (parsed.seedDate === localToday()) {
        db = parsed;
        return parsed;
      }
    }
  } catch {
    // повреждённое состояние — создаём заново
  }
  return resetDb();
}

export function resetDb(): Db {
  if (!builder) throw new Error('Не задан генератор данных');
  db = builder();
  persistNow();
  return db;
}

export function dropStored(): void {
  try {
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const k = localStorage.key(i);
      if (k && k.startsWith('sanatorium_demo_db_')) localStorage.removeItem(k);
    }
  } catch {
    // ignore
  }
}
