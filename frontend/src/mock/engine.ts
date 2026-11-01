// Бизнес-логика демо-бэкенда: сезонность, цены, наличие номеров, планировщик слотов, прогноз спроса.
import type { CategoryAvailability, ScheduleEntry, VoucherView } from '../types';
import { nextId, type Db, type RoomRec, type VoucherRec, type VoucherStatus } from './db';
import { addDays, clamp, daysBetween, dayOfYear, dn, ds, localToday, minskIso, r2 } from './util';

export const CURRENCY = 'BYN';
export const PREPAY_PERCENT = 30;
export const PAYMENT_DEADLINE_HOURS = 24;
export const MAX_NIGHTS = 60;
export const DAY_START_MIN = 8 * 60; // рабочий день процедур начинается в 08:00
export const DAY_MINUTES = 480;

export class ApiFail extends Error {
  constructor(public status: number, message: string, public warnings?: unknown[]) { super(message); }
}
export const notFound = (m: string) => new ApiFail(404, m);
export const conflict = (m: string) => new ApiFail(409, m);
export const badRequest = (m: string) => new ApiFail(400, m);

/** Статусы, при которых путёвка занимает места. */
export const ACTIVE_STATUSES: VoucherStatus[] = ['AWAITING_PAYMENT', 'CONFIRMED', 'CHECKED_IN', 'COMPLETED'];
export const PAID_STATUSES: VoucherStatus[] = ['CONFIRMED', 'CHECKED_IN', 'COMPLETED'];

// ---------- сезонность ----------
const MONTH_OCC = [0.7, 0.62, 0.56, 0.52, 0.64, 0.8, 0.93, 0.94, 0.74, 0.52, 0.43, 0.58]; // янв..дек (середина месяца)

/** Целевая загрузка (0..1) на дату: лето и Новый год — пики, осень и весна — спад. */
export function occModel(date: string): number {
  const doy = dayOfYear(date);
  const pos = (doy - 14.5) / 30.4; // 0 = середина января
  const i = Math.floor(pos);
  const frac = pos - i;
  const a = MONTH_OCC[((i % 12) + 12) % 12];
  const b = MONTH_OCC[(((i + 1) % 12) + 12) % 12];
  let occ = a + (b - a) * frac;
  const md = date.slice(5);
  if (md >= '12-26' || md <= '01-07') occ = Math.max(occ, 0.94);
  else if (md >= '12-22' || md <= '01-10') occ = Math.max(occ, 0.8);
  if ((md >= '03-06' && md <= '03-09') || (md >= '04-30' && md <= '05-03') || (md >= '05-08' && md <= '05-11')) occ += 0.07;
  return clamp(occ, 0.25, 0.97);
}

function hash(str: string): number {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) / 4294967296;
}
/** Детерминированный шум в диапазоне -1..1 по ключу. */
export function noise(key: string): number {
  return (hash(key) - 0.5) * 2;
}

// ---------- цены ----------
export interface PriceInfo {
  available: boolean;
  closed: boolean;
  minLos: number;
  base: number;
  recommended: number;
  applied: number;
  pMin: number | null;
  pMax: number | null;
}

export function seasonOf(db: Db, date: string) {
  return db.seasons.find((s) => s.date_from <= date && date <= s.date_to);
}
export function corridorOf(db: Db, categoryId: number, date: string) {
  return db.corridors.find((c) => c.category_id === categoryId && c.date_from <= date && date <= c.date_to);
}
export function predictedOcc(db: Db, categoryId: number, date: string): number {
  let best: { run_id: number; v: number } | null = null;
  for (const f of db.forecasts) {
    if (f.category_id === categoryId && f.stay_date === date && (!best || f.run_id > best.run_id)) best = { run_id: f.run_id, v: f.predicted_occ };
  }
  return best ? best.v / 100 : occModel(date);
}

export function priceInfo(db: Db, categoryId: number, date: string): PriceInfo {
  const season = seasonOf(db, date);
  const tariff = season ? db.tariffs.find((t) => t.season_id === season.id && t.category_id === categoryId) : undefined;
  const cor = corridorOf(db, categoryId, date);
  if (!season || !tariff) {
    return { available: false, closed: false, minLos: 1, base: 0, recommended: 0, applied: 0, pMin: cor?.p_min ?? null, pMax: cor?.p_max ?? null };
  }
  const occ = predictedOcc(db, categoryId, date);
  const recommended = r2(tariff.price_base * season.k_season * (1 + 0.45 * (occ - 0.62)));
  const applied = cor ? r2(clamp(recommended, cor.p_min, cor.p_max)) : recommended;
  return { available: true, closed: !!cor?.closed, minLos: cor?.min_los ?? 1, base: tariff.price_base, recommended, applied, pMin: cor?.p_min ?? null, pMax: cor?.p_max ?? null };
}

export function nightsOf(from: string, to: string): string[] {
  const out: string[] = [];
  for (let d = dn(from); d < dn(to); d++) out.push(ds(d));
  return out;
}

export function quote(db: Db, categoryId: number, from: string, to: string) {
  const nights = nightsOf(from, to);
  const infos = nights.map((n) => priceInfo(db, categoryId, n));
  if (infos.some((i) => !i.available)) return null;
  const total = r2(infos.reduce((s, i) => s + i.applied, 0));
  return {
    perDayAvg: r2(total / nights.length),
    total,
    closed: infos.some((i) => i.closed),
    minLos: Math.max(...infos.map((i) => i.minLos)),
    nights: nights.length,
  };
}

// ---------- наличие ----------
export function categoryRooms(db: Db, categoryId: number): RoomRec[] {
  return db.rooms.filter((r) => r.categoryId === categoryId);
}
export function capacityOf(db: Db, room: RoomRec): number {
  return db.categories.find((c) => c.id === room.categoryId)?.capacityTotal ?? 2;
}

function overlaps(v: { checkIn: string; checkOut: string }, from: string, to: string): boolean {
  return v.checkIn < to && from < v.checkOut;
}

/** Свободных мест в номере на весь период [from; to). */
export function roomFreePlaces(db: Db, room: RoomRec, from: string, to: string, ignoreVoucherId?: number): number {
  const cap = capacityOf(db, room);
  const vs = db.vouchers.filter((v) => v.roomId === room.id && ACTIVE_STATUSES.includes(v.status) && v.id !== ignoreVoucherId && overlaps(v, from, to));
  if (vs.length === 0) return cap;
  let maxUsed = 0;
  for (const night of nightsOf(from, to)) {
    let used = 0;
    for (const v of vs) if (v.checkIn <= night && night < v.checkOut) used += v.places;
    if (used > maxUsed) maxUsed = used;
    if (maxUsed >= cap) break;
  }
  return Math.max(0, cap - maxUsed);
}

export function availabilityOf(db: Db, categoryId: number, from: string, to: string) {
  let free = 0;
  let maxIn = 0;
  for (const room of categoryRooms(db, categoryId)) {
    const f = roomFreePlaces(db, room, from, to);
    free += f;
    if (f > maxIn) maxIn = f;
  }
  return { free, maxIn };
}

/** Подбор номера: плотная упаковка (наименьший остаток) — как RoomPlacement в core-service. */
export function findRoom(db: Db, categoryId: number, from: string, to: string, places: number, rnd?: () => number): RoomRec | null {
  let best: RoomRec | null = null;
  let bestFree = 99;
  const rooms = categoryRooms(db, categoryId);
  const start = rnd ? Math.floor(rnd() * rooms.length) : 0;
  for (let k = 0; k < rooms.length; k++) {
    const room = rooms[(k + start) % rooms.length];
    const f = roomFreePlaces(db, room, from, to);
    if (f >= places && f < bestFree) {
      best = room;
      bestFree = f;
    }
  }
  return best;
}

export function validateStay(from: string, to: string, places: number): void {
  if (!from || !to) throw badRequest('Укажите даты заезда и выезда');
  if (from < localToday()) throw badRequest('Дата заезда не может быть в прошлом');
  if (to <= from) throw badRequest('Дата выезда должна быть позже даты заезда');
  if (daysBetween(from, to) > MAX_NIGHTS) throw badRequest(`Срок проживания не более ${MAX_NIGHTS} суток`);
  if (!Number.isFinite(places) || places < 1 || places > 10) throw badRequest('Количество мест: от 1 до 10');
}

// фотографии подставляет сама страница (CATEGORY_MEDIA); сюда их можно передать из index.ts
const CATEGORY_PHOTOS: Record<number, { cover: string; photos: string[] } | undefined> = {};
export function setCategoryPhotos(map: Record<number, { cover: string; photos: string[] }>): void {
  Object.assign(CATEGORY_PHOTOS, map);
}

export function searchAvailability(db: Db, from: string, to: string, places: number): CategoryAvailability[] {
  validateStay(from, to, places);
  const out: CategoryAvailability[] = [];
  for (const cat of db.categories) {
    const { free, maxIn } = availabilityOf(db, cat.id, from, to);
    if (free === 0) continue; // полностью занятая категория не показывается, как в настоящем сервисе
    const q = quote(db, cat.id, from, to);
    const media = CATEGORY_PHOTOS[cat.id];
    out.push({
      categoryId: cat.id,
      name: cat.name,
      freePlaces: free,
      maxPlacesInOneRoom: maxIn,
      pricePerPlaceDay: q && !q.closed ? q.perDayAvg : null,
      totalPerPlace: q && !q.closed ? q.total : null,
      priceFromSnapshot: false,
      priceAvailable: !!q && !q.closed,
      ...(media ? { coverUrl: media.cover, photos: media.photos } : {}),
    });
  }
  return out;
}

// ---------- представления ----------
export function voucherView(db: Db, v: VoucherRec): VoucherView {
  const room = db.rooms.find((r) => r.id === v.roomId);
  return {
    id: v.id,
    clientId: v.clientId,
    status: v.status,
    categoryId: v.categoryId,
    roomNumber: room?.roomNumber ?? null,
    checkIn: v.checkIn,
    checkOut: v.checkOut,
    places: v.places,
    pricePerPlaceDay: v.pricePerPlaceDay,
    totalPrice: v.totalPrice,
    currency: v.currency,
    paymentDeadline: v.paymentDeadline,
    paid: v.paid,
  };
}

export function clientName(db: Db, clientId: number): string {
  const c = db.clients.find((x) => x.id === clientId);
  return c ? `${c.lastName} ${c.firstName}${c.middleName ? ' ' + c.middleName : ''}` : 'Гость санатория';
}

// ---------- отмена ----------
export const CANCEL_TIERS = [
  { min: 14, pct: 0 }, { min: 7, pct: 25 }, { min: 3, pct: 50 }, { min: 0, pct: 100 },
];
export function cancellation(checkIn: string, cancelDate: string, total: number, paid: number) {
  const days = Math.max(0, daysBetween(cancelDate, checkIn));
  const pct = CANCEL_TIERS.find((t) => days >= t.min)!.pct;
  const retained = r2(Math.min(r2((total * pct) / 100), r2(paid)));
  return { retainPercent: pct, retained, refund: r2(paid - retained) };
}

// ---------- лояльность ----------
export function tierOf(spent: number) {
  if (spent >= 5000) return { tier: 'PLATINUM' as const, name: 'Платина', cashback: 10, discount: 7, next: null as number | null, privileges: ['Максимальный кэшбэк 10% бонусами', 'Персональный консьерж-сервис', 'Бесплатный трансфер от вокзала', 'Приоритетный ранний заезд и поздний выезд', 'Ежедневная корзина свежих фруктов'] };
  if (spent >= 2500) return { tier: 'GOLD' as const, name: 'Золото', cashback: 7, discount: 5, next: 5000, privileges: ['Повышенный кэшбэк 7% бонусами', 'Выбор любимого номера без доплаты', 'Скидка 15% на SPA-процедуры', 'Чайная церемония в фитобаре'] };
  if (spent >= 1000) return { tier: 'SILVER' as const, name: 'Серебро', cashback: 5, discount: 3, next: 2500, privileges: ['Кэшбэк 5% бонусами', '1 процедура спелеотерапии в подарок', 'Скидка 10% на дополнительные процедуры'] };
  return { tier: 'BRONZE' as const, name: 'Бронза', cashback: 3, discount: 0, next: 1000, privileges: ['Базовый кэшбэк 3% бонусами', 'Приветственные 100 баллов', 'Консультация врача-координатора'] };
}

// ---------- планировщик слотов (порт SlotPlanner.java) ----------
export interface PlanRequest { procedureId: number; cabinetId: number; slotsPerDay: number; sessions: number }
export interface PlanSlot { procedureId: number; cabinetId: number; date: string; slotIndex: number; startMinute: number }

/**
 * Жадный проход: процедуры в порядке запроса, дни по возрастанию; в день не более одного сеанса процедуры;
 * берётся первый слот кабинета, свободный и не пересекающийся с другими сеансами пациента.
 */
export function planSlots(
  days: string[],
  requests: PlanRequest[],
  dayMinutes: number,
  cabinetBusy: Map<string, Set<number>>, // ключ «кабинет|дата»
  patientBusy: Map<string, [number, number][]>,
): { slots: PlanSlot[]; unplaced: Map<number, number> } {
  const busy = new Map<string, Set<number>>();
  cabinetBusy.forEach((v, k) => busy.set(k, new Set(v)));
  const mine = new Map<string, [number, number][]>();
  patientBusy.forEach((v, k) => mine.set(k, [...v]));
  const slots: PlanSlot[] = [];
  const unplaced = new Map<number, number>();
  for (const req of requests) {
    const len = Math.floor(dayMinutes / req.slotsPerDay);
    if (req.slotsPerDay <= 0 || len <= 0) throw conflict(`Некорректная ёмкость кабинета ${req.cabinetId}`);
    let left = req.sessions;
    for (const day of days) {
      if (left === 0) break;
      const key = `${req.cabinetId}|${day}`;
      const cab = busy.get(key) ?? new Set<number>();
      busy.set(key, cab);
      const my = mine.get(day) ?? [];
      mine.set(day, my);
      for (let idx = 0; idx < req.slotsPerDay; idx++) {
        const start = idx * len;
        const end = start + len;
        if (cab.has(idx) || my.some(([s, e]) => s < end && start < e)) continue;
        cab.add(idx);
        my.push([start, end]);
        slots.push({ procedureId: req.procedureId, cabinetId: req.cabinetId, date: day, slotIndex: idx, startMinute: start });
        left--;
        break;
      }
    }
    if (left > 0) unplaced.set(req.procedureId, (unplaced.get(req.procedureId) ?? 0) + left);
  }
  return { slots, unplaced };
}

export function busyFromSlots(db: Db) {
  const m = new Map<string, Set<number>>();
  for (const s of db.slots) {
    const k = `${s.cabinetId}|${s.date}`;
    const set = m.get(k) ?? new Set<number>();
    set.add(s.slotIndex);
    m.set(k, set);
  }
  return m;
}

export function scheduleEntry(db: Db, s: Db['slots'][number]): ScheduleEntry {
  const a = db.assignments.find((x) => x.id === s.assignmentId);
  const v = a ? db.vouchers.find((x) => x.id === a.voucherId) : undefined;
  const proc = db.procedures.find((p) => p.id === s.procedureId);
  const cab = db.cabinets.find((c) => c.id === s.cabinetId);
  return {
    id: s.id,
    assignmentId: s.assignmentId,
    procedureId: s.procedureId,
    procedure: proc?.name ?? '—',
    cabinet: cab?.name ?? '—',
    slot: minskIso(s.date, DAY_START_MIN + s.startMinute),
    done: s.done,
    voucherId: a?.voucherId ?? 0,
    clientName: v ? clientName(db, v.clientId) : '—',
  };
}

/** Размещает сеансы назначения по дням проживания, начиная с fromDate. */
export function planAssignment(db: Db, assignmentId: number, fromDate: string): { added: number } {
  const a = db.assignments.find((x) => x.id === assignmentId);
  if (!a) throw notFound('Назначение не найдено');
  const v = db.vouchers.find((x) => x.id === a.voucherId)!;
  const start = fromDate > v.checkIn ? fromDate : v.checkIn;
  const days = nightsOf(start, v.checkOut);
  if (days.length === 0) throw conflict('Срок проживания по путёвке истёк, расписание сформировать нельзя');
  const reqs: PlanRequest[] = a.items.map((it) => {
    const p = db.procedures.find((x) => x.id === it.procedureId)!;
    const cab = db.cabinets.find((c) => c.id === p.cabinetId)!;
    return { procedureId: p.id, cabinetId: cab.id, slotsPerDay: cab.slotsPerDay, sessions: it.sessionsPlanned };
  });
  // сеансы пациента по другим назначениям этой путёвки
  const mine = new Map<string, [number, number][]>();
  for (const s of db.slots) {
    const other = db.assignments.find((x) => x.id === s.assignmentId);
    if (!other || other.voucherId !== v.id) continue;
    const cab = db.cabinets.find((c) => c.id === s.cabinetId)!;
    const len = Math.floor(DAY_MINUTES / cab.slotsPerDay);
    const list = mine.get(s.date) ?? [];
    list.push([s.startMinute, s.startMinute + len]);
    mine.set(s.date, list);
  }
  const { slots, unplaced } = planSlots(days, reqs, DAY_MINUTES, busyFromSlots(db), mine);
  if (unplaced.size > 0) {
    const detail = [...unplaced.entries()].map(([pid, n]) => `${db.procedures.find((p) => p.id === pid)?.name ?? pid}: не хватило ${n}`).join('; ');
    throw conflict(`Не хватает свободных слотов кабинетов в срок проживания (${detail})`);
  }
  for (const s of slots) {
    db.slots.push({ id: nextId('slot'), assignmentId, procedureId: s.procedureId, cabinetId: s.cabinetId, date: s.date, startMinute: s.startMinute, slotIndex: s.slotIndex, done: false });
  }
  a.planned = true;
  return { added: slots.length };
}

// ---------- прогноз спроса ----------
export interface FcPoint { stay_date: string; predicted_occ: number; lower: number; upper: number }

function smooth7(y: number[], i: number): number {
  let s = 0, n = 0;
  for (let k = -3; k <= 3; k++) {
    const v = y[i + k];
    if (v !== undefined) { s += v; n++; }
  }
  return n ? s / n : y[Math.max(0, Math.min(y.length - 1, i))];
}

/** Годовая сезонная модель: профиль прошлого года × поправка уровня (затухающая). */
function annualForecast(y: number[], horizon: number): number[] | null {
  const n = y.length;
  if (n < 365 + 28) return null;
  const cur = y.slice(n - 28).reduce((a, b) => a + b, 0) / 28;
  let prev = 0;
  for (let i = n - 28; i < n; i++) prev += smooth7(y, i - 364);
  prev /= 28;
  const ratio = prev > 1 ? clamp(cur / prev, 0.7, 1.3) : 1;
  const out: number[] = [];
  for (let h = 1; h <= horizon; h++) {
    const idx = n - 1 + h - 364; // тот же день прошлого года
    if (idx >= n) return null;
    const adj = 1 + (ratio - 1) * Math.exp(-h / 45);
    out.push(smooth7(y, idx) * adj);
  }
  return out;
}

/** Аддитивный Хольт–Винтерс с недельной сезонностью (запасной вариант при короткой истории). */
function holtWinters(y: number[], horizon: number, m = 7): number[] {
  const alpha = 0.3, beta = 0.05, gamma = 0.2;
  const n = y.length;
  const sum = (a: number[]) => a.reduce((s, v) => s + v, 0);
  let level = sum(y.slice(0, m)) / m;
  let trend = (sum(y.slice(m, 2 * m)) - sum(y.slice(0, m))) / (m * m);
  const season = y.slice(0, m).map((v) => v - level);
  for (let t = m; t < n; t++) {
    const s = season[t % m];
    const last = level;
    level = alpha * (y[t] - s) + (1 - alpha) * (level + trend);
    trend = beta * (level - last) + (1 - beta) * trend;
    season[t % m] = gamma * (y[t] - level) + (1 - gamma) * s;
  }
  const out: number[] = [];
  for (let h = 1; h <= horizon; h++) out.push(level + h * trend * Math.exp(-h / 30) + season[(n + h - 1) % m]);
  return out;
}

function predict(y: number[], horizon: number): number[] {
  return annualForecast(y, horizon) ?? holtWinters(y, horizon);
}

/** Прогноз загрузки (%) с 95%-м доверительным интервалом; MAPE — по контрольным последним 28 суткам. */
export function forecastOccupancy(history: { stay_date: string; sold: number; available: number }[], horizon: number, startDate: string): { points: FcPoint[]; mape: number | null } {
  const sorted = [...history].sort((a, b) => (a.stay_date < b.stay_date ? -1 : 1));
  const y = sorted.map((p) => (p.available > 0 ? (p.sold / p.available) * 100 : 0));
  const hold = 28;
  let mape: number | null = null;
  let sigma = 4;
  if (y.length >= hold + 28) {
    const pred = predict(y.slice(0, -hold), hold);
    const actual = y.slice(-hold);
    let ape = 0, cnt = 0, sq = 0;
    for (let i = 0; i < hold; i++) {
      if (actual[i] > 1) { ape += Math.abs((actual[i] - pred[i]) / actual[i]); cnt++; }
      sq += (actual[i] - pred[i]) ** 2;
    }
    mape = cnt ? r2((ape / cnt) * 100) : null;
    sigma = Math.max(2.5, Math.sqrt(sq / hold));
  }
  const lastDate = sorted[sorted.length - 1].stay_date;
  const gap = Math.max(0, daysBetween(lastDate, startDate) - 1);
  const raw = predict(y, horizon + gap).slice(gap);
  const points = raw.map((v, i) => {
    const w = 1.96 * sigma * Math.sqrt(1 + (i + gap) / 45);
    const p = clamp(v, 0, 100);
    return { stay_date: addDays(startDate, i), predicted_occ: r2(p), lower: r2(clamp(p - w, 0, 100)), upper: r2(clamp(p + w, 0, 100)) };
  });
  return { points, mape };
}
