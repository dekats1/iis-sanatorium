/* eslint-disable @typescript-eslint/no-explicit-any */
// Таблица маршрутов демо-бэкенда: повторяет REST API core-service и pricing-forecast (права — как в SecurityConfig.java).
import type { AssignmentView, Role } from '../types';
import { nextId, type Db, type UserRec, type VoucherRec } from './db';
import {
  ACTIVE_STATUSES, ApiFail, CURRENCY, PAYMENT_DEADLINE_HOURS, PREPAY_PERCENT, availabilityOf, badRequest,
  cancellation, clientName, conflict, findRoom, forecastOccupancy, notFound, planAssignment, priceInfo, quote,
  scheduleEntry, searchAvailability, tierOf, validateStay, voucherView,
} from './engine';
import { notify, notifyRole, notifyClient, accrueBonus } from './effects';
import { addDays, clamp, localToday, r2 } from './util';
import { buildReports } from './reports';

export interface Ctx {
  db: Db;
  method: string;
  path: string;
  params: Record<string, string>;
  query: URLSearchParams;
  body: any;
  user: UserRec | null;
}
type Handler = (c: Ctx) => unknown;
interface Route { method: string; re: RegExp; keys: string[]; access: 'public' | 'auth' | Role[]; handler: Handler; status?: number }

/** Результат с нестандартным кодом (201/204). */
export class Reply {
  constructor(public status: number, public body?: unknown) {}
}

const routes: Route[] = [];
function add(method: string, pattern: string, access: Route['access'], handler: Handler): void {
  const keys: string[] = [];
  const re = new RegExp('^' + pattern.replace(/:(\w+)/g, (_m, k: string) => { keys.push(k); return '([^/]+)'; }) + '/?$');
  routes.push({ method, re, keys, access, handler });
}

export function matchRoute(method: string, path: string) {
  let pathMatched = false;
  for (const r of routes) {
    const m = r.re.exec(path);
    if (!m) continue;
    pathMatched = true;
    if (r.method !== method) continue;
    const params: Record<string, string> = {};
    r.keys.forEach((k, i) => { params[k] = decodeURIComponent(m[i + 1]); });
    return { route: r, params, pathMatched };
  }
  return { route: null, params: {}, pathMatched };
}

export function checkAccess(r: Route, user: UserRec | null): void {
  if (r.access === 'public') return;
  if (!user) throw new ApiFail(401, 'Требуется вход в систему');
  if (r.access === 'auth') return;
  if (!r.access.some((role) => user.roles.includes(role))) throw new ApiFail(403, 'Недостаточно прав для этого действия');
}

// ---------- вспомогательные ----------
const ALL_STAFF: Role[] = ['BOOKING_ADMIN', 'DOCTOR', 'MANAGER', 'SYSADMIN'];
const isAdmin = (u: UserRec) => u.roles.includes('BOOKING_ADMIN') || u.roles.includes('SYSADMIN');
const num = (v: unknown): number | null => (v === undefined || v === null || v === '' ? null : Number.isFinite(Number(v)) ? Number(v) : null);
const str = (v: unknown): string => (typeof v === 'string' ? v.trim() : '');
const iso = () => new Date().toISOString();
const isDate = (s: unknown): s is string => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(s));
const unprocessable = (m: string) => new ApiFail(422, m);

function clientOf(db: Db, user: UserRec): number {
  if (!user.clientId) throw notFound('Профиль клиента не найден');
  void db;
  return user.clientId;
}
/** Клиент видит только свои данные: идентификатор в пути (id пользователя или клиента) заменяется на собственный. */
function resolveClientId(c: Ctx, raw: string | number | undefined): number {
  const u = c.user!;
  if (u.roles.includes('CLIENT') && !isAdmin(u)) return clientOf(c.db, u);
  const id = num(raw);
  if (id === null) {
    if (u.clientId) return u.clientId;
    throw notFound('Профиль клиента не найден');
  }
  return id;
}

function voucherFor(c: Ctx, id: number): VoucherRec {
  const v = c.db.vouchers.find((x) => x.id === id);
  if (!v) throw notFound('Путёвка не найдена');
  const u = c.user!;
  if (!isAdmin(u) && v.clientId !== u.clientId) throw notFound('Путёвка не найдена'); // чужие не раскрываем
  return v;
}

export function sweepExpired(db: Db): void {
  const now = Date.now();
  for (const v of db.vouchers) {
    if (v.status === 'AWAITING_PAYMENT' && v.paymentDeadline && Date.parse(v.paymentDeadline) < now) {
      v.status = 'EXPIRED';
      notifyWaitlist(db, v.categoryId);
      notifyClient(db, v.clientId, 'PAYMENT', 'Срок оплаты истёк', `Путёвка №${v.id} не была оплачена в течение ${PAYMENT_DEADLINE_HOURS} часов — бронь снята.`, '/my');
    }
  }
}

function notifyWaitlist(db: Db, categoryId: number): void {
  for (const w of db.waitlist) {
    if (w.status !== 'OPEN' || w.categoryId !== categoryId) continue;
    const { maxIn } = availabilityOf(db, categoryId, w.dateFrom, w.dateTo);
    if (maxIn >= w.places) {
      w.status = 'NOTIFIED';
      const cat = db.categories.find((x) => x.id === categoryId)?.name ?? '';
      notifyClient(db, w.clientId, 'WAITLIST', 'Освободились места', `По вашей заявке освободились места в категории «${cat}» на ${w.dateFrom} — ${w.dateTo}. Успейте забронировать.`, '/search');
    }
  }
}

// ---------- AUTH ----------
function makeToken(user: UserRec): { token: string; exp: number } {
  const b64 = (o: unknown) => btoa(unescape(encodeURIComponent(JSON.stringify(o)))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  const now = Math.floor(Date.now() / 1000);
  const exp = now + 120 * 60;
  const token = `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ sub: String(user.id), roles: user.roles, username: user.username, iat: now, exp })}.demo-signature-no-verification`;
  return { token, exp };
}

add('POST', '/api/auth/login', 'public', (c) => {
  const username = str(c.body?.username);
  const password = typeof c.body?.password === 'string' ? c.body.password : '';
  if (!username || !password) throw badRequest('Укажите логин и пароль');
  const user = c.db.users.find((u) => u.username === username);
  if (!user || user.password !== password || !user.active) throw new ApiFail(401, 'Неверный логин или пароль');
  return { token: makeToken(user).token, tokenType: 'Bearer', expiresInMinutes: 120, roles: user.roles };
});

add('POST', '/api/auth/register', 'public', (c) => {
  const b = c.body ?? {};
  const username = str(b.username);
  if (username.length < 3 || username.length > 50) throw badRequest('username: длина от 3 до 50 символов');
  if (typeof b.password !== 'string' || b.password.length < 8 || b.password.length > 72) throw badRequest('password: длина от 8 до 72 символов');
  if (!str(b.lastName) || !str(b.firstName)) throw badRequest('Укажите фамилию и имя');
  if (!isDate(b.birthDate) || b.birthDate >= localToday()) throw badRequest('birthDate: дата рождения должна быть в прошлом');
  const email = str(b.email) || null;
  if (email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw badRequest('email: некорректный адрес');
  if (c.db.users.some((u) => u.username === username || (email && u.email === email))) throw conflict('Пользователь с таким логином или e-mail уже существует');
  const clientId = nextId('client');
  c.db.clients.push({
    id: clientId, lastName: str(b.lastName), firstName: str(b.firstName), middleName: str(b.middleName) || undefined, birthDate: b.birthDate,
    phone: str(b.phone) || undefined, email: email ?? undefined, citizenship: 'Республика Беларусь',
  });
  c.db.users.push({
    id: nextId('user'), username, password: b.password, fullName: [b.lastName, b.firstName, b.middleName].filter(Boolean).join(' '),
    email, active: true, roles: ['CLIENT'], clientId,
  });
  return new Reply(201);
});

// ---------- ME ----------
const meView = (u: UserRec) => ({ id: u.id, username: u.username, fullName: u.fullName, email: u.email, active: u.active, roles: u.roles });
add('GET', '/api/me', 'auth', (c) => meView(c.user!));
add('PUT', '/api/me', 'auth', (c) => {
  const fullName = str(c.body?.fullName);
  if (!fullName) throw badRequest('fullName: не должно быть пустым');
  const email = str(c.body?.email) || null;
  if (email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw badRequest('email: некорректный адрес');
  if (email && c.db.users.some((u) => u.id !== c.user!.id && u.email === email)) throw conflict('Этот e-mail уже используется');
  c.user!.fullName = fullName;
  c.user!.email = email;
  return meView(c.user!);
});
add('PUT', '/api/me/password', 'auth', (c) => {
  if (c.body?.oldPassword !== c.user!.password) throw badRequest('Текущий пароль указан неверно');
  const np = c.body?.newPassword;
  if (typeof np !== 'string' || np.length < 8 || np.length > 72) throw badRequest('newPassword: длина от 8 до 72 символов');
  c.user!.password = np;
  return new Reply(204);
});
const conditionViews = (db: Db, clientId: number) =>
  db.clientConditions.filter((x) => x.clientId === clientId).map((x) => {
    const cond = db.conditions.find((k) => k.id === x.conditionId)!;
    return { conditionId: cond.id, code: cond.code, name: cond.name, diagnosedAt: x.diagnosedAt };
  });
add('GET', '/api/me/conditions', 'auth', (c) => (c.user!.clientId ? conditionViews(c.db, c.user!.clientId) : []));

// ---------- СПРАВОЧНИКИ ----------
interface DirSpec { key: 'categories' | 'rooms' | 'profiles' | 'cabinets' | 'procedures' | 'diets' | 'channels' | 'conditions' | 'customers'; fields: [string, 'string' | 'number' | 'enum', boolean][]; inUse: (db: Db, id: number) => boolean; label: string }
const DIRS: Record<string, DirSpec> = {
  'room-categories': { key: 'categories', label: 'Категория', fields: [['name', 'string', true], ['capacityTotal', 'number', true], ['description', 'string', false]], inUse: (db, id) => db.rooms.some((r) => r.categoryId === id) || db.vouchers.some((v) => v.categoryId === id) },
  rooms: { key: 'rooms', label: 'Номер', fields: [['categoryId', 'number', true], ['roomNumber', 'string', true], ['floor', 'number', false]], inUse: (db, id) => db.vouchers.some((v) => v.roomId === id) },
  'treatment-profiles': { key: 'profiles', label: 'Профиль', fields: [['code', 'string', false], ['name', 'string', true]], inUse: (db, id) => db.vouchers.some((v) => v.profileId === id) },
  cabinets: { key: 'cabinets', label: 'Кабинет', fields: [['name', 'string', true], ['slotsPerDay', 'number', true]], inUse: (db, id) => db.procedures.some((p) => p.cabinetId === id) },
  procedures: { key: 'procedures', label: 'Процедура', fields: [['name', 'string', true], ['durationMin', 'number', true], ['cabinetId', 'number', true]], inUse: (db, id) => db.slots.some((s) => s.procedureId === id) || db.assignments.some((a) => a.items.some((i) => i.procedureId === id)) },
  diets: { key: 'diets', label: 'Диета', fields: [['code', 'string', false], ['name', 'string', true]], inUse: (db, id) => db.vouchers.some((v) => v.dietId === id) },
  'sales-channels': { key: 'channels', label: 'Канал', fields: [['name', 'string', true], ['commissionPct', 'number', true], ['quotaPlaces', 'number', false]], inUse: (db, id) => db.vouchers.some((v) => v.channelId === id) },
  'medical-conditions': { key: 'conditions', label: 'Состояние', fields: [['code', 'string', true], ['name', 'string', true]], inUse: (db, id) => db.clientConditions.some((x) => x.conditionId === id) || db.contra.some(([, k]) => k === id) },
  customers: { key: 'customers', label: 'Заказчик', fields: [['type', 'enum', true], ['name', 'string', true], ['contractNo', 'string', false]], inUse: (db, id) => db.vouchers.some((v) => v.customerId === id) },
};

function dirView(db: Db, resource: string, rec: any): any {
  if (resource === 'rooms') return { id: rec.id, categoryId: rec.categoryId, roomNumber: rec.roomNumber, floor: rec.floor };
  void db;
  return rec;
}

function dirBody(resource: string, body: any, spec: DirSpec, db: Db): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [field, type, required] of spec.fields) {
    const raw = body?.[field];
    const empty = raw === undefined || raw === null || raw === '';
    if (empty) {
      if (required) throw badRequest(`Поле «${field}» обязательно для заполнения`);
      out[field] = null;
      continue;
    }
    if (type === 'number') {
      const n = Number(raw);
      if (!Number.isFinite(n) || n < 0) throw badRequest(`Поле «${field}» должно быть неотрицательным числом`);
      out[field] = n;
    } else if (type === 'enum') {
      if (raw !== 'ORG' && raw !== 'PERSON') throw badRequest('Тип заказчика: ORG или PERSON');
      out[field] = raw;
    } else {
      out[field] = String(raw).trim();
    }
  }
  if (resource === 'room-categories' && (out.capacityTotal as number) < 1) throw badRequest('Вместимость должна быть не меньше 1');
  if (resource === 'sales-channels' && (out.commissionPct as number) > 100) throw badRequest('Комиссия не может быть больше 100%');
  if (resource === 'cabinets' && (out.slotsPerDay as number) < 1) throw badRequest('Пропускная способность должна быть не меньше 1');
  if (resource === 'procedures') {
    if (!db.cabinets.some((x) => x.id === out.cabinetId)) throw badRequest('Кабинет не найден');
    if ((out.durationMin as number) < 1) throw badRequest('Длительность должна быть не меньше 1 минуты');
  }
  if (resource === 'rooms' && !db.categories.some((x) => x.id === out.categoryId)) throw badRequest('Категория номера не найдена');
  if (resource === 'rooms' && out.floor === null) out.floor = 1;
  return out;
}

add('GET', '/api/directory/:resource', 'auth', (c) => {
  const spec = DIRS[c.params.resource];
  if (!spec) throw notFound('Справочник не найден');
  if (c.params.resource === 'customers' && !c.user!.roles.some((r) => ALL_STAFF.includes(r))) throw new ApiFail(403, 'Недостаточно прав для этого действия');
  return (c.db[spec.key] as any[]).map((r) => dirView(c.db, c.params.resource, r));
});
add('GET', '/api/directory/:resource/:id', 'auth', (c) => {
  const spec = DIRS[c.params.resource];
  if (!spec) throw notFound('Справочник не найден');
  const rec = (c.db[spec.key] as any[]).find((r) => r.id === Number(c.params.id));
  if (!rec) throw notFound('Запись не найдена');
  return dirView(c.db, c.params.resource, rec);
});
add('POST', '/api/directory/:resource', ['SYSADMIN'], (c) => {
  const spec = DIRS[c.params.resource];
  if (!spec) throw notFound('Справочник не найден');
  const data = dirBody(c.params.resource, c.body, spec, c.db);
  const id = nextId(`dir_${spec.key}`) + Math.max(0, ...(c.db[spec.key] as any[]).map((r) => r.id)) * 0;
  const maxId = Math.max(0, ...(c.db[spec.key] as any[]).map((r) => r.id));
  const rec: any = { id: Math.max(id, maxId + 1), ...data };
  if (c.params.resource === 'rooms') {
    const building = 'Корпус №1 «Главный»';
    Object.assign(rec, { building, windowView: 'во внутренний двор', amenities: [] });
  }
  (c.db[spec.key] as any[]).push(rec);
  return new Reply(201, dirView(c.db, c.params.resource, rec));
});
add('PUT', '/api/directory/:resource/:id', ['SYSADMIN'], (c) => {
  const spec = DIRS[c.params.resource];
  if (!spec) throw notFound('Справочник не найден');
  const rec = (c.db[spec.key] as any[]).find((r) => r.id === Number(c.params.id));
  if (!rec) throw notFound('Запись не найдена');
  Object.assign(rec, dirBody(c.params.resource, c.body, spec, c.db));
  return dirView(c.db, c.params.resource, rec);
});
add('DELETE', '/api/directory/:resource/:id', ['SYSADMIN'], (c) => {
  const spec = DIRS[c.params.resource];
  if (!spec) throw notFound('Справочник не найден');
  const arr = c.db[spec.key] as any[];
  const idx = arr.findIndex((r) => r.id === Number(c.params.id));
  if (idx < 0) throw notFound('Запись не найдена');
  if (spec.inUse(c.db, arr[idx].id)) throw conflict('Запись используется в других данных и не может быть удалена');
  arr.splice(idx, 1);
  return new Reply(204);
});

// ---------- НАЛИЧИЕ И ПУТЁВКИ ----------
add('GET', '/api/availability', ['CLIENT', 'BOOKING_ADMIN', 'MANAGER'], (c) => {
  const from = c.query.get('from');
  const to = c.query.get('to');
  if (!isDate(from) || !isDate(to)) throw badRequest('Параметры from и to обязательны (ГГГГ-ММ-ДД)');
  return searchAvailability(c.db, from, to, Number(c.query.get('places') ?? 1));
});

add('POST', '/api/vouchers', ['CLIENT', 'BOOKING_ADMIN'], (c) => {
  const b = c.body ?? {};
  const u = c.user!;
  let clientId: number;
  if (u.roles.includes('BOOKING_ADMIN')) {
    clientId = num(b.clientId) ?? 0;
    if (!clientId) throw badRequest('Для оформления администратором нужен clientId');
    if (!c.db.clients.some((x) => x.id === clientId)) throw conflict('Профиль клиента не найден');
  } else {
    if (!u.clientId) throw conflict('Профиль клиента не найден');
    clientId = u.clientId;
  }
  const categoryId = num(b.categoryId);
  const places = Number(b.places);
  if (categoryId === null || !isDate(b.checkIn) || !isDate(b.checkOut)) throw badRequest('Укажите категорию, даты заезда и выезда');
  if (num(b.profileId) === null || num(b.channelId) === null) throw badRequest('Укажите лечебный профиль и канал продаж');
  validateStay(b.checkIn, b.checkOut, places);
  if (!c.db.categories.some((x) => x.id === categoryId)) throw notFound('Категория номера не найдена');
  if (!c.db.profiles.some((x) => x.id === Number(b.profileId))) throw notFound('Лечебный профиль не найден');
  if (!c.db.channels.some((x) => x.id === Number(b.channelId))) throw notFound('Канал продаж не найден');
  if (num(b.dietId) !== null && !c.db.diets.some((x) => x.id === Number(b.dietId))) throw notFound('Диета не найдена');
  const q = quote(c.db, categoryId, b.checkIn, b.checkOut);
  if (!q) throw new ApiFail(503, 'Цена на выбранные даты недоступна: для категории не задан сезон или тариф');
  if (q.closed) throw conflict('Продажи по этой категории на выбранные даты закрыты');
  if (q.nights < q.minLos) throw conflict(`Минимальный срок проживания по этим датам — ${q.minLos} суток`);
  // клиент не может одновременно проживать по двум путёвкам
  if (c.db.vouchers.some((v) => v.clientId === clientId && ACTIVE_STATUSES.includes(v.status) && v.checkIn < b.checkOut && b.checkIn < v.checkOut)) {
    throw conflict('У клиента уже есть путёвка на пересекающийся период');
  }
  const room = findRoom(c.db, categoryId, b.checkIn, b.checkOut, places);
  if (!room) throw conflict('Нет номера с таким количеством свободных мест на выбранные даты');
  const total = r2(q.perDayAvg * places * q.nights);
  const v: VoucherRec = {
    id: nextId('voucher'), clientId, status: 'AWAITING_PAYMENT', categoryId, roomId: room.id, checkIn: b.checkIn, checkOut: b.checkOut, places,
    pricePerPlaceDay: q.perDayAvg, totalPrice: total, currency: CURRENCY,
    paymentDeadline: new Date(Date.now() + PAYMENT_DEADLINE_HOURS * 3600000).toISOString(), paid: 0,
    profileId: Number(b.profileId), channelId: Number(b.channelId), dietId: num(b.dietId), customerId: num(b.customerId),
    createdAt: iso(), createdBy: u.id,
  };
  c.db.vouchers.push(v);
  notifyClient(c.db, clientId, 'PAYMENT', 'Путёвка оформлена', `Путёвка №${v.id} ожидает оплаты. Внесите предоплату ${PREPAY_PERCENT}% в течение ${PAYMENT_DEADLINE_HOURS} часов.`, '/my');
  notifyRole(c.db, 'BOOKING_ADMIN', 'INFO', 'Новая путёвка', `Оформлена путёвка №${v.id} (${clientName(c.db, clientId)}), заезд ${v.checkIn}.`, '/admin-bookings');
  return new Reply(201, voucherView(c.db, v));
});

add('GET', '/api/vouchers/my', ['CLIENT', 'BOOKING_ADMIN'], (c) => {
  const clientId = clientOf(c.db, c.user!);
  return c.db.vouchers.filter((v) => v.clientId === clientId).sort((a, b) => b.id - a.id).map((v) => voucherView(c.db, v));
});
add('GET', '/api/vouchers', ['BOOKING_ADMIN'], (c) => {
  const status = c.query.get('status');
  return c.db.vouchers.filter((v) => !status || v.status === status).sort((a, b) => b.id - a.id).map((v) => voucherView(c.db, v));
});
add('GET', '/api/vouchers/:id', ['CLIENT', 'BOOKING_ADMIN'], (c) => voucherView(c.db, voucherFor(c, Number(c.params.id))));

add('POST', '/api/vouchers/:id/pay', ['CLIENT', 'BOOKING_ADMIN'], (c) => {
  const v = voucherFor(c, Number(c.params.id));
  if (v.status !== 'AWAITING_PAYMENT') throw conflict(`Оплата невозможна: путёвка в статусе ${v.status}`);
  const amount = r2((v.totalPrice * PREPAY_PERCENT) / 100);
  v.paid = amount;
  v.status = 'CONFIRMED';
  const paymentId = nextId('payment');
  notifyClient(c.db, v.clientId, 'PAYMENT', 'Оплата получена', `Предоплата ${amount} ${v.currency} по путёвке №${v.id} принята. Заезд ${v.checkIn}.`, '/my');
  notifyRole(c.db, 'BOOKING_ADMIN', 'PAYMENT', 'Поступила оплата', `Путёвка №${v.id} оплачена (${amount} ${v.currency}).`, '/admin-bookings');
  return { paymentId, invoiceId: paymentId + 5000, amount, currency: v.currency, payUrl: '/my?pay=SUCCESS' };
});

add('POST', '/api/vouchers/:id/cancel', ['CLIENT', 'BOOKING_ADMIN'], (c) => {
  const v = voucherFor(c, Number(c.params.id));
  if (v.status !== 'AWAITING_PAYMENT' && v.status !== 'CONFIRMED') throw conflict(`Путёвку в статусе ${v.status} отменить нельзя`);
  const res = cancellation(v.checkIn, localToday(), v.totalPrice, v.paid);
  v.status = 'CANCELLED';
  v.retained = res.retained;
  v.refunded = res.refund;
  if (res.refund > 0) c.db.refunds.push({ id: nextId('refund'), voucherId: v.id, reason: 'Отмена путёвки', amount: res.refund, createdAt: iso() });
  notifyClient(c.db, v.clientId, 'PAYMENT', 'Путёвка отменена', res.refund > 0 ? `Путёвка №${v.id} отменена. К возврату ${res.refund} ${v.currency}, удержано ${res.retained} ${v.currency} (${res.retainPercent}%).` : `Путёвка №${v.id} отменена.`, '/my');
  notifyWaitlist(c.db, v.categoryId);
  return { voucher: voucherView(c.db, v), retainPercent: res.retainPercent, retained: res.retained, refund: res.refund };
});

add('POST', '/api/vouchers/:id/check-in', ['BOOKING_ADMIN'], (c) => {
  const v = c.db.vouchers.find((x) => x.id === Number(c.params.id));
  if (!v) throw notFound('Путёвка не найдена');
  if (v.status !== 'CONFIRMED') throw conflict(`Заезд возможен только для оплаченной путёвки (статус CONFIRMED), сейчас ${v.status}`);
  const today = localToday();
  if (today < v.checkIn) throw conflict(`Заезд возможен не раньше ${v.checkIn}`);
  if (today >= v.checkOut) throw conflict('Срок проживания по путёвке уже истёк');
  v.status = 'CHECKED_IN';
  const room = c.db.rooms.find((r) => r.id === v.roomId);
  if (room) delete room.statusOverride;
  notifyClient(c.db, v.clientId, 'MEDICAL', 'Добро пожаловать!', `Вы заселены в номер ${room?.roomNumber ?? ''}. Врач назначит лечение после первичного осмотра.`, '/profile');
  notifyRole(c.db, 'DOCTOR', 'MEDICAL', 'Новый пациент', `Заселён гость ${clientName(c.db, v.clientId)} (путёвка №${v.id}) — требуется первичный осмотр.`, '/doctor');
  return voucherView(c.db, v);
});

add('POST', '/api/vouchers/:id/check-out', ['BOOKING_ADMIN'], (c) => {
  const v = c.db.vouchers.find((x) => x.id === Number(c.params.id));
  if (!v) throw notFound('Путёвка не найдена');
  if (v.status !== 'CHECKED_IN') throw conflict(`Выписка возможна только после заезда (статус CHECKED_IN), сейчас ${v.status}`);
  v.status = 'COMPLETED';
  v.paid = v.totalPrice;
  const room = c.db.rooms.find((r) => r.id === v.roomId);
  if (room) room.statusOverride = 'CLEANING';
  accrueBonus(c.db, v);
  notifyClient(c.db, v.clientId, 'LOYALTY', 'Спасибо, что были с нами!', `Начислен кэшбэк за путёвку №${v.id}. Оставьте отзыв о пребывании в разделе «Мои путёвки».`, '/my');
  return voucherView(c.db, v);
});

// ---------- ЛИСТ ОЖИДАНИЯ ----------
const wlView = (w: Db['waitlist'][number]) => ({ id: w.id, clientId: w.clientId, categoryId: w.categoryId, dateFrom: w.dateFrom, dateTo: w.dateTo, places: w.places, status: w.status, createdAt: w.createdAt });
add('POST', '/api/waitlist', ['CLIENT', 'BOOKING_ADMIN'], (c) => {
  const b = c.body ?? {};
  const u = c.user!;
  let clientId: number;
  if (u.roles.includes('BOOKING_ADMIN')) {
    clientId = num(b.clientId) ?? 0;
    if (!clientId) throw badRequest('Для постановки администратором нужен clientId');
  } else clientId = u.clientId ?? 0;
  if (!clientId) throw conflict('Профиль клиента не найден');
  const categoryId = num(b.categoryId);
  if (categoryId === null || !c.db.categories.some((x) => x.id === categoryId)) throw notFound('Категория номера не найдена');
  if (!isDate(b.dateFrom) || !isDate(b.dateTo)) throw badRequest('Укажите даты');
  validateStay(b.dateFrom, b.dateTo, Number(b.places));
  if (availabilityOf(c.db, categoryId, b.dateFrom, b.dateTo).maxIn >= Number(b.places)) throw conflict('Места на эти даты есть — оформите бронирование, лист ожидания не нужен');
  const w = { id: nextId('waitlist'), clientId, categoryId, dateFrom: b.dateFrom, dateTo: b.dateTo, places: Number(b.places), status: 'OPEN' as const, createdAt: iso() };
  c.db.waitlist.push(w);
  notifyClient(c.db, clientId, 'WAITLIST', 'Вы в листе ожидания', `Заявка на ${w.dateFrom} — ${w.dateTo} принята. Сообщим, когда освободятся места.`, '/my');
  return new Reply(201, wlView(w));
});
add('GET', '/api/waitlist/my', ['CLIENT', 'BOOKING_ADMIN'], (c) => {
  const id = clientOf(c.db, c.user!);
  return c.db.waitlist.filter((w) => w.clientId === id).sort((a, b) => b.id - a.id).map(wlView);
});
add('GET', '/api/waitlist', ['CLIENT', 'BOOKING_ADMIN'], (c) => {
  if (!isAdmin(c.user!)) throw notFound('Не найдено');
  const status = c.query.get('status');
  if (status && !['OPEN', 'NOTIFIED', 'CLOSED'].includes(status)) throw badRequest('Статус: OPEN, NOTIFIED или CLOSED');
  return c.db.waitlist.filter((w) => !status || w.status === status).sort((a, b) => a.id - b.id).map(wlView);
});
add('DELETE', '/api/waitlist/:id', ['CLIENT', 'BOOKING_ADMIN'], (c) => {
  const idx = c.db.waitlist.findIndex((w) => w.id === Number(c.params.id));
  const w = c.db.waitlist[idx];
  if (!w || (!isAdmin(c.user!) && w.clientId !== c.user!.clientId)) throw notFound('Запись листа ожидания не найдена');
  c.db.waitlist.splice(idx, 1);
  return new Reply(204);
});

// ---------- КЛИЕНТЫ ----------
function clientBody(b: any) {
  if (!str(b?.lastName) || !str(b?.firstName)) throw badRequest('Укажите фамилию и имя');
  if (!isDate(b?.birthDate) || b.birthDate >= localToday()) throw badRequest('birthDate: дата рождения должна быть в прошлом');
  const email = str(b.email) || undefined;
  if (email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw badRequest('email: некорректный адрес');
  return {
    lastName: str(b.lastName), firstName: str(b.firstName), middleName: str(b.middleName) || undefined, birthDate: b.birthDate as string,
    phone: str(b.phone) || undefined, email, citizenship: str(b.citizenship) || undefined,
  };
}
add('POST', '/api/clients', ['BOOKING_ADMIN', 'SYSADMIN'], (c) => {
  const rec = { id: nextId('client'), ...clientBody(c.body) };
  c.db.clients.push(rec);
  return new Reply(201, rec);
});
add('GET', '/api/clients', ['BOOKING_ADMIN', 'DOCTOR', 'SYSADMIN'], (c) => {
  const page = Number(c.query.get('page') ?? 0);
  const size = Number(c.query.get('size') ?? 50);
  if (!(size >= 1 && size <= 200) || page < 0) throw badRequest('size: 1..200, page ≥ 0');
  const q = (c.query.get('q') ?? '').trim().toLowerCase();
  const list = c.db.clients.filter((x) => !q || x.lastName.toLowerCase().startsWith(q) || `${x.lastName} ${x.firstName}`.toLowerCase().startsWith(q) || (x.phone ?? '').replace(/\D/g, '').includes(q.replace(/\D/g, '') || '§'))
    .sort((a, b) => a.lastName.localeCompare(b.lastName, 'ru') || a.firstName.localeCompare(b.firstName, 'ru'));
  return list.slice(page * size, page * size + size);
});
add('GET', '/api/clients/:id', ['BOOKING_ADMIN', 'DOCTOR', 'SYSADMIN'], (c) => {
  const x = c.db.clients.find((k) => k.id === Number(c.params.id));
  if (!x) throw notFound('Клиент не найден');
  return x;
});
add('PUT', '/api/clients/:id', ['BOOKING_ADMIN', 'SYSADMIN'], (c) => {
  const x = c.db.clients.find((k) => k.id === Number(c.params.id));
  if (!x) throw notFound('Клиент не найден');
  Object.assign(x, clientBody(c.body));
  return x;
});
add('GET', '/api/clients/:id/conditions', ['DOCTOR', 'BOOKING_ADMIN'], (c) => {
  if (!c.db.clients.some((k) => k.id === Number(c.params.id))) throw notFound('Клиент не найден');
  return conditionViews(c.db, Number(c.params.id));
});
add('POST', '/api/clients/:id/conditions', ['DOCTOR', 'BOOKING_ADMIN'], (c) => {
  const id = Number(c.params.id);
  if (!c.db.clients.some((k) => k.id === id)) throw notFound('Клиент не найден');
  const cid = num(c.body?.conditionId);
  if (cid === null || !c.db.conditions.some((k) => k.id === cid)) throw notFound('Состояние здоровья не найдено в справочнике');
  if (!c.db.clientConditions.some((x) => x.clientId === id && x.conditionId === cid)) {
    c.db.clientConditions.push({ clientId: id, conditionId: cid, diagnosedAt: isDate(c.body?.diagnosedAt) ? c.body.diagnosedAt : localToday() });
  }
  return new Reply(204);
});
add('DELETE', '/api/clients/:id/conditions/:cid', ['DOCTOR', 'BOOKING_ADMIN'], (c) => {
  const idx = c.db.clientConditions.findIndex((x) => x.clientId === Number(c.params.id) && x.conditionId === Number(c.params.cid));
  if (idx < 0) throw notFound('Состояние у клиента не найдено');
  c.db.clientConditions.splice(idx, 1);
  return new Reply(204);
});

// ---------- ЛЕЧЕНИЕ ----------
const assignmentView = (db: Db, a: Db['assignments'][number]): AssignmentView => ({
  id: a.id, voucherId: a.voucherId, doctorId: a.doctorId, createdAt: a.createdAt,
  items: a.items.map((i) => ({ procedureId: i.procedureId, procedure: db.procedures.find((p) => p.id === i.procedureId)?.name ?? '—', sessionsPlanned: i.sessionsPlanned })),
});

add('POST', '/api/assignments', ['DOCTOR'], (c) => {
  const b = c.body ?? {};
  const v = c.db.vouchers.find((x) => x.id === Number(b.voucherId));
  if (!v) throw notFound('Путёвка не найдена');
  if (v.status !== 'CHECKED_IN') throw conflict(`Назначение возможно только после заезда (статус CHECKED_IN), сейчас ${v.status}`);
  const items: { procedureId: number; sessions: number }[] = Array.isArray(b.items) ? b.items : [];
  if (items.length < 1 || items.length > 20) throw badRequest('items: от 1 до 20 процедур');
  const seen: number[] = [];
  for (const it of items) {
    const sessions = Number(it.sessions);
    if (!Number.isInteger(sessions) || sessions < 1 || sessions > 30) throw badRequest('Число сеансов: от 1 до 30');
    if (seen.includes(Number(it.procedureId))) throw badRequest(`Процедура ${it.procedureId} указана в назначении дважды`);
    seen.push(Number(it.procedureId));
  }
  const procs = seen.map((id) => c.db.procedures.find((p) => p.id === id));
  if (procs.some((p) => !p)) throw badRequest('Некоторые процедуры не найдены в справочнике');
  const notAllowed = procs.filter((p) => !c.db.procProfile.some(([pr, id]) => pr === v.profileId && id === p!.id));
  if (notAllowed.length) throw conflict(`Процедуры не входят в лечебный профиль путёвки: ${notAllowed.map((p) => p!.name).join(', ')}`);
  const conds = new Set(c.db.clientConditions.filter((x) => x.clientId === v.clientId).map((x) => x.conditionId));
  const warnings = c.db.contra.filter(([pid, cid]) => seen.includes(pid) && conds.has(cid)).map(([pid, cid]) => ({
    procedureId: pid, procedure: c.db.procedures.find((p) => p.id === pid)!.name, conditionId: cid, condition: c.db.conditions.find((k) => k.id === cid)!.name,
  }));
  if (warnings.length && !b.confirmContraindications) {
    throw new ApiFail(409, 'Выявлены противопоказания к назначаемым процедурам: подтвердите назначение или уберите процедуры', warnings);
  }
  const a = { id: nextId('assignment'), voucherId: v.id, doctorId: c.user!.id, createdAt: iso(), items: items.map((i) => ({ procedureId: Number(i.procedureId), sessionsPlanned: Number(i.sessions) })), planned: false };
  c.db.assignments.push(a);
  notifyClient(c.db, v.clientId, 'MEDICAL', 'Назначено лечение', `Врач назначил курс процедур (${items.length} видов). Расписание появится в ближайшее время.`, '/profile');
  return new Reply(201, assignmentView(c.db, a));
});
add('GET', '/api/assignments/by-voucher/:id', ['DOCTOR', 'BOOKING_ADMIN'], (c) => {
  if (!c.db.vouchers.some((v) => v.id === Number(c.params.id))) throw notFound('Путёвка не найдена');
  return c.db.assignments.filter((a) => a.voucherId === Number(c.params.id)).map((a) => assignmentView(c.db, a));
});
add('POST', '/api/assignments/:id/schedule', ['DOCTOR'], (c) => {
  const a = c.db.assignments.find((x) => x.id === Number(c.params.id));
  if (!a) throw notFound('Назначение не найдено');
  const v = c.db.vouchers.find((x) => x.id === a.voucherId)!;
  if (v.status !== 'CHECKED_IN') throw conflict(`Расписание формируется для проживающего (статус CHECKED_IN), сейчас ${v.status}`);
  if (a.planned) throw conflict('Расписание по этому назначению уже сформировано');
  planAssignment(c.db, a.id, localToday());
  notifyClient(c.db, v.clientId, 'MEDICAL', 'Расписание процедур готово', 'Ваше расписание процедур сформировано. Приходите к назначенному времени.', '/profile');
  return new Reply(201, c.db.slots.filter((s) => s.assignmentId === a.id).sort(slotOrder).map((s) => scheduleEntry(c.db, s)));
});
const slotOrder = (a: Db['slots'][number], b: Db['slots'][number]) => (a.date + String(a.startMinute).padStart(4, '0') < b.date + String(b.startMinute).padStart(4, '0') ? -1 : 1);
add('GET', '/api/assignments/:id/schedule', ['DOCTOR'], (c) => {
  if (!c.db.assignments.some((x) => x.id === Number(c.params.id))) throw notFound('Назначение не найдено');
  return c.db.slots.filter((s) => s.assignmentId === Number(c.params.id)).sort(slotOrder).map((s) => scheduleEntry(c.db, s));
});
add('GET', '/api/schedule', ['DOCTOR'], (c) => {
  const date = c.query.get('date');
  if (!isDate(date)) throw badRequest('Параметр date обязателен (ГГГГ-ММ-ДД)');
  return c.db.slots.filter((s) => s.date === date).sort(slotOrder).map((s) => scheduleEntry(c.db, s));
});
add('POST', '/api/schedule/:id/done', ['DOCTOR'], (c) => {
  const s = c.db.slots.find((x) => x.id === Number(c.params.id));
  if (!s) throw notFound('Сеанс не найден');
  if (s.done) throw conflict('Сеанс уже отмечен выполненным');
  s.done = true;
  return new Reply(204);
});

// ---------- ОТЧЁТЫ ----------
add('GET', '/api/reports/kpi', ['MANAGER'], (c) => buildReports(c.db).kpi(c.query.get('from'), c.query.get('to')));
add('GET', '/api/reports/channels', ['MANAGER'], (c) => buildReports(c.db).channels());
add('GET', '/api/reports/bi-monthly', ['MANAGER'], (c) => buildReports(c.db).monthly());
add('GET', '/api/reports/profiles', ['MANAGER'], (c) => buildReports(c.db).profiles());

// ---------- PRICING-FORECAST ----------
add('GET', '/pricing/price/reviews', ['MANAGER'], (c) => {
  const f = c.query.get('status_filter');
  return c.db.priceReviews.filter((r) => !f || r.status === f).sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
});
add('POST', '/pricing/price/reviews/:id/decide', ['MANAGER'], (c) => {
  const r = c.db.priceReviews.find((x) => x.id === Number(c.params.id));
  if (!r) throw notFound('Запись не найдена');
  if (r.status !== 'PENDING_REVIEW') throw conflict('Запись уже рассмотрена');
  const action = c.body?.action;
  if (action !== 'ACKNOWLEDGE' && action !== 'RULE_ADJUSTED') throw unprocessable('Недопустимое действие');
  r.status = action === 'ACKNOWLEDGE' ? 'ACKNOWLEDGED' : 'RULE_ADJUSTED';
  r.decided_by = c.user!.username;
  r.decided_at = iso();
  return r;
});

add('GET', '/pricing/pricing-rules/seasons', ['MANAGER'], (c) =>
  [...c.db.seasons].sort((x, y) => (x.date_from < y.date_from ? -1 : 1)));
add('GET', '/pricing/pricing-rules/tariffs', ['MANAGER'], (c) => {
  const sid = c.query.get('season_id');
  const cid = c.query.get('category_id');
  return c.db.tariffs.filter((t) => (!sid || t.season_id === Number(sid)) && (!cid || t.category_id === Number(cid)));
});
add('POST', '/pricing/pricing-rules/seasons', ['MANAGER'], (c) => {
  const b = c.body ?? {};
  if (!str(b.name) || !isDate(b.date_from) || !isDate(b.date_to)) throw unprocessable('Укажите название и корректные даты сезона');
  if (b.date_from > b.date_to) throw unprocessable('Дата начала сезона позже даты окончания');
  const k = Number(b.k_season);
  if (!Number.isFinite(k) || k <= 0) throw unprocessable('Коэффициент сезона должен быть положительным');
  const db = c.db;
  const from = b.date_from as string;
  const to = b.date_to as string;
  // новый сезон «вырезается» из пересекающихся: границы старых сезонов сдвигаются, тарифы наследуются
  const inherit = db.seasons.find((s) => s.date_from <= from && from <= s.date_to) ?? db.seasons.find((s) => s.date_from <= to && to <= s.date_to);
  const next: typeof db.seasons = [];
  for (const s of db.seasons) {
    if (s.date_to < from || s.date_from > to) { next.push(s); continue; }
    if (s.date_from < from) {
      next.push({ ...s, date_to: addDays(from, -1) });
    }
    if (s.date_to > to) {
      const id = nextId('season');
      next.push({ ...s, id, date_from: addDays(to, 1) });
      for (const t of db.tariffs.filter((x) => x.season_id === s.id)) db.tariffs.push({ ...t, id: nextId('tariff'), season_id: id });
    }
    if (s.date_from >= from && s.date_to <= to) db.tariffs = db.tariffs.filter((x) => x.season_id !== s.id);
  }
  const id = nextId('season');
  next.push({ id, name: str(b.name), date_from: from, date_to: to, k_season: k });
  db.seasons = next.sort((x, y) => (x.date_from < y.date_from ? -1 : 1));
  if (inherit) for (const t of db.tariffs.filter((x) => x.season_id === inherit.id)) db.tariffs.push({ ...t, id: nextId('tariff'), season_id: id });
  return new Reply(201, { id });
});
add('POST', '/pricing/pricing-rules/tariffs', ['MANAGER'], (c) => {
  const b = c.body ?? {};
  const price = Number(b.price_base);
  if (!Number.isFinite(price) || price < 0) throw unprocessable('Базовая цена должна быть неотрицательной');
  if (!c.db.seasons.some((s) => s.id === Number(b.season_id))) throw conflict('Сезон с таким идентификатором не найден');
  if (!c.db.categories.some((s) => s.id === Number(b.category_id))) throw conflict('Категория номера не найдена');
  const ex = c.db.tariffs.find((t) => t.season_id === Number(b.season_id) && t.category_id === Number(b.category_id));
  if (ex) {
    ex.price_base = price; // повторное сохранение обновляет цену
    return new Reply(201, { id: ex.id });
  }
  const id = nextId('tariff');
  c.db.tariffs.push({ id, season_id: Number(b.season_id), category_id: Number(b.category_id), price_base: price });
  return new Reply(201, { id });
});
add('POST', '/pricing/pricing-rules/corridors', ['MANAGER'], (c) => {
  const b = c.body ?? {};
  if (!isDate(b.date_from) || !isDate(b.date_to)) throw unprocessable('Укажите корректные даты коридора');
  if (b.date_from > b.date_to) throw unprocessable('Дата начала позже даты окончания');
  const pMin = Number(b.p_min);
  const pMax = Number(b.p_max);
  if (!Number.isFinite(pMin) || !Number.isFinite(pMax) || pMin < 0) throw unprocessable('Некорректные границы цен');
  if (pMin > pMax) throw unprocessable('p_min не может быть больше p_max');
  const catId = Number(b.category_id);
  if (!c.db.categories.some((k) => k.id === catId)) throw conflict('Категория номера не найдена');
  const minLos = Math.max(1, Number(b.min_los ?? 1) || 1);
  const from = b.date_from as string;
  const to = b.date_to as string;
  // новый коридор замещает пересекающиеся участки прежних правил категории
  const next: typeof c.db.corridors = [];
  for (const r of c.db.corridors) {
    if (r.category_id !== catId || r.date_to < from || r.date_from > to) { next.push(r); continue; }
    if (r.date_from < from) next.push({ ...r, date_to: addDays(from, -1) });
    if (r.date_to > to) next.push({ ...r, id: nextId('corridor'), date_from: addDays(to, 1) });
  }
  const id = nextId('corridor');
  next.push({ id, category_id: catId, date_from: from, date_to: to, p_min: pMin, p_max: pMax, min_los: minLos, closed: !!b.closed });
  c.db.corridors = next;
  return new Reply(201, { id });
});

add('GET', '/pricing/history/:cat', ['MANAGER'], (c) => {
  const from = c.query.get('date_from');
  const to = c.query.get('date_to');
  if (!isDate(from) || !isDate(to)) throw unprocessable('Параметры date_from и date_to обязательны');
  return (c.db.history[Number(c.params.cat)] ?? []).filter((p) => p.stay_date >= from && p.stay_date <= to).sort((a, b) => (a.stay_date < b.stay_date ? -1 : 1));
});
add('POST', '/pricing/history/:cat', ['MANAGER'], (c) => {
  const pts = c.body;
  if (!Array.isArray(pts) || pts.length < 1 || pts.length > 1000) throw unprocessable('Нужно от 1 до 1000 точек истории');
  const cat = Number(c.params.cat);
  const arr = c.db.history[cat] ?? (c.db.history[cat] = []);
  for (const p of pts) {
    if (!isDate(p?.stay_date) || !Number.isInteger(p.sold) || !Number.isInteger(p.available) || p.sold < 0 || p.available <= 0) throw unprocessable('Некорректная точка истории');
    if (p.sold > p.available) throw unprocessable('sold не может быть больше available');
  }
  for (const p of pts) {
    const ex = arr.find((x) => x.stay_date === p.stay_date);
    if (ex) { ex.sold = p.sold; ex.available = p.available; } else arr.push({ stay_date: p.stay_date, sold: p.sold, available: p.available });
  }
  arr.sort((a, b) => (a.stay_date < b.stay_date ? -1 : 1));
  return { upserted: pts.length };
});
add('POST', '/pricing/forecast/:cat/run', ['MANAGER'], (c) => {
  const cat = Number(c.params.cat);
  const hist = c.db.history[cat] ?? [];
  if (hist.length < 28) throw unprocessable(`Недостаточно истории спроса: ${hist.length} суток, нужно не менее 28 (альтернативный поток 2а сценария СЦ-4)`);
  const { points, mape } = forecastOccupancy(hist, 90, localToday());
  const runId = nextId('forecastRun');
  const stamp = iso();
  c.db.forecastRuns.push({ id: runId, mape, created_at: stamp, category_id: cat });
  c.db.forecasts = c.db.forecasts.filter((f) => f.category_id !== cat || f.stay_date < localToday()); // оставляем только свежий прогон
  for (const p of points) c.db.forecasts.push({ run_id: runId, category_id: cat, stay_date: p.stay_date, predicted_occ: p.predicted_occ, lower: p.lower, upper: p.upper, created_at: stamp });
  return new Reply(201, { run_id: runId, mape, points: points.length });
});
add('GET', '/pricing/forecast/:cat', ['MANAGER'], (c) => {
  const from = c.query.get('date_from');
  const to = c.query.get('date_to');
  if (!isDate(from) || !isDate(to)) throw unprocessable('Параметры date_from и date_to обязательны');
  const cat = Number(c.params.cat);
  const best = new Map<string, Db['forecasts'][number]>();
  for (const f of c.db.forecasts) {
    if (f.category_id !== cat || f.stay_date < from || f.stay_date > to) continue;
    const ex = best.get(f.stay_date);
    if (!ex || f.run_id > ex.run_id) best.set(f.stay_date, f);
  }
  return [...best.values()].sort((a, b) => (a.stay_date < b.stay_date ? -1 : 1)).map((f) => ({ stay_date: f.stay_date, predicted_occ: f.predicted_occ, lower_95: f.lower, upper_95: f.upper }));
});

// ---------- АДМИНИСТРИРОВАНИЕ ----------
const userRow = (u: UserRec) => ({ id: u.id, username: u.username, fullName: u.fullName, email: u.email, active: u.active, roles: u.roles });
const ROLES: Role[] = ['CLIENT', 'BOOKING_ADMIN', 'DOCTOR', 'MANAGER', 'SYSADMIN'];
add('GET', '/api/users', ['SYSADMIN'], (c) => {
  const size = Number(c.query.get('size') ?? 50);
  return c.db.users.slice(0, size).map(userRow);
});
add('POST', '/api/users', ['SYSADMIN'], (c) => {
  const b = c.body ?? {};
  const username = str(b.username);
  if (username.length < 3 || username.length > 50) throw badRequest('username: длина от 3 до 50 символов');
  if (typeof b.password !== 'string' || b.password.length < 8) throw badRequest('password: не менее 8 символов');
  if (!str(b.fullName)) throw badRequest('fullName: не должно быть пустым');
  const roles: Role[] = Array.isArray(b.roles) ? b.roles.filter((r: Role) => ROLES.includes(r)) : [];
  if (roles.length === 0) throw badRequest('Выберите хотя бы одну роль');
  const email = str(b.email) || null;
  if (c.db.users.some((u) => u.username === username || (email && u.email === email))) throw conflict('Пользователь с таким логином или e-mail уже существует');
  const u: UserRec = { id: nextId('user'), username, password: b.password, fullName: str(b.fullName), email, active: true, roles };
  if (roles.includes('CLIENT')) {
    const parts = u.fullName.split(/\s+/);
    const clientId = nextId('client');
    c.db.clients.push({ id: clientId, lastName: parts[0] ?? u.fullName, firstName: parts[1] ?? '—', middleName: parts[2], birthDate: '1980-01-01', email: email ?? undefined, citizenship: 'Республика Беларусь' });
    u.clientId = clientId;
  }
  c.db.users.push(u);
  return new Reply(201, { id: u.id });
});
const userById = (c: Ctx) => {
  const u = c.db.users.find((x) => x.id === Number(c.params.id));
  if (!u) throw notFound('Пользователь не найден');
  return u;
};
add('PUT', '/api/users/:id/roles', ['SYSADMIN'], (c) => {
  const u = userById(c);
  const roles: Role[] = Array.isArray(c.body?.roles) ? c.body.roles.filter((r: Role) => ROLES.includes(r)) : [];
  if (roles.length === 0) throw badRequest('Выберите хотя бы одну роль');
  if (u.id === c.user!.id && !roles.includes('SYSADMIN')) throw conflict('Нельзя снять с себя роль SYSADMIN');
  u.roles = roles;
  return new Reply(204);
});
add('PUT', '/api/users/:id/active', ['SYSADMIN'], (c) => {
  const u = userById(c);
  if (u.id === c.user!.id && c.body?.active === false) throw conflict('Нельзя заблокировать самого себя');
  u.active = !!c.body?.active;
  return new Reply(204);
});
add('PUT', '/api/users/:id/password', ['SYSADMIN'], (c) => {
  const u = userById(c);
  if (typeof c.body?.password !== 'string' || c.body.password.length < 8) throw badRequest('password: не менее 8 символов');
  u.password = c.body.password;
  return new Reply(204);
});
add('GET', '/api/audit', ['SYSADMIN'], (c) => {
  const page = Number(c.query.get('page') ?? 0);
  const size = Number(c.query.get('size') ?? 50);
  if (!(size >= 1 && size <= 200) || page < 0) throw badRequest('size: 1..200, page ≥ 0');
  const sorted = [...c.db.audit].sort((a, b) => b.id - a.id);
  return sorted.slice(page * size, page * size + size);
});

// ---------- ЛОЯЛЬНОСТЬ ----------
function loyaltyView(db: Db, clientId: number) {
  const acc = db.loyalty[clientId] ?? { balance: 100, spentMoney: 0 };
  const txs = db.bonusTx.filter((t) => t.clientId === clientId);
  const earned = txs.filter((t) => t.amount > 0).reduce((s, t) => s + t.amount, 0) || acc.balance;
  const spent = txs.filter((t) => t.amount < 0).reduce((s, t) => s - t.amount, 0);
  const t = tierOf(acc.spentMoney);
  return {
    clientId, tier: t.tier, tierName: t.name, balance: acc.balance, totalEarned: earned, totalSpent: spent, spentMoneyTotal: acc.spentMoney,
    nextTierThreshold: t.next, cashbackPercent: t.cashback, discountPercent: t.discount, privileges: t.privileges,
  };
}
add('GET', '/api/loyalty/account', 'auth', (c) => loyaltyView(c.db, resolveClientId(c, undefined)));
add('GET', '/api/loyalty/account/:id', 'auth', (c) => loyaltyView(c.db, resolveClientId(c, c.params.id)));
add('GET', '/api/loyalty/transactions', 'auth', (c) => c.db.bonusTx.filter((t) => t.clientId === resolveClientId(c, undefined)).sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1)));
add('GET', '/api/loyalty/transactions/:id', 'auth', (c) => c.db.bonusTx.filter((t) => t.clientId === resolveClientId(c, c.params.id)).sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1)));
add('POST', '/api/loyalty/add-bonus', 'auth', (c) => {
  const clientId = resolveClientId(c, c.body?.clientId);
  const amount = Math.trunc(Number(c.body?.amount));
  if (!Number.isFinite(amount) || amount === 0) throw badRequest('Укажите ненулевую сумму бонусов');
  if (!c.db.clients.some((k) => k.id === clientId)) throw notFound('Клиент не найден');
  const acc = c.db.loyalty[clientId] ?? (c.db.loyalty[clientId] = { balance: 100, spentMoney: 0 });
  acc.balance = Math.max(0, acc.balance + amount);
  c.db.bonusTx.push({ id: nextId('bonus'), clientId, amount, type: amount > 0 ? 'ADJUSTMENT' : 'REDEMPTION', description: str(c.body?.description) || 'Корректировка бонусного счёта', createdAt: iso() });
  if (amount > 0) notifyClient(c.db, clientId, 'LOYALTY', 'Начислены бонусы', `На ваш счёт зачислено ${amount} баллов.`, '/profile');
  return loyaltyView(c.db, clientId);
});
add('POST', '/api/loyalty/apply', 'auth', (c) => {
  const clientId = resolveClientId(c, c.body?.clientId);
  const acc = c.db.loyalty[clientId] ?? (c.db.loyalty[clientId] = { balance: 100, spentMoney: 0 });
  const applied = Math.min(acc.balance, Math.trunc(Number(c.body?.bonusPoints)));
  if (!(applied > 0)) throw badRequest('Недостаточно бонусных баллов');
  acc.balance -= applied;
  c.db.bonusTx.push({ id: nextId('bonus'), clientId, amount: -applied, type: 'REDEMPTION', description: `Оплата бонусами части путёвки №${c.body?.voucherId}`, createdAt: iso(), voucherId: Number(c.body?.voucherId) || undefined });
  return { success: true, applied };
});

// ---------- ЭМК ----------
function ehrOf(db: Db, clientId: number) {
  return db.ehr[clientId] ?? { clientId, allergies: [], contraindications: [], updatedAt: iso() };
}
add('GET', '/api/ehr/my', 'auth', (c) => ehrOf(c.db, resolveClientId(c, undefined)));
add('GET', '/api/ehr/:id/notes', 'auth', (c) => c.db.notes.filter((n) => n.clientId === resolveClientId(c, c.params.id)).sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1)));
add('GET', '/api/ehr/:id', 'auth', (c) => ehrOf(c.db, resolveClientId(c, c.params.id)));
add('PUT', '/api/ehr/:id', 'auth', (c) => {
  const id = resolveClientId(c, c.params.id);
  if (!c.db.clients.some((k) => k.id === id)) throw notFound('Клиент не найден');
  const cur = ehrOf(c.db, id);
  const b = c.body ?? {};
  const pick = (k: string) => (b[k] !== undefined && b[k] !== null ? b[k] : (cur as any)[k]);
  const next = {
    ...cur, heightCm: pick('heightCm'), weightKg: pick('weightKg'), systolicBp: pick('systolicBp'), diastolicBp: pick('diastolicBp'), pulseBpm: pick('pulseBpm'),
    bloodType: pick('bloodType'), mainDiagnosis: pick('mainDiagnosis'), allergies: Array.isArray(b.allergies) ? b.allergies : cur.allergies,
    contraindications: Array.isArray(b.contraindications) ? b.contraindications : cur.contraindications, updatedAt: iso(),
  } as any;
  if (next.heightCm > 0 && next.weightKg > 0) next.bmi = Math.round((next.weightKg / (next.heightCm / 100) ** 2) * 10) / 10;
  c.db.ehr[id] = next;
  return next;
});
add('POST', '/api/ehr/notes', ['DOCTOR', 'SYSADMIN'], (c) => {
  const b = c.body ?? {};
  const clientId = num(b.clientId);
  if (clientId === null || !c.db.clients.some((k) => k.id === clientId)) throw notFound('Клиент не найден');
  if (!str(b.complaints) && !str(b.objectiveStatus) && !str(b.recommendations)) throw badRequest('Заполните хотя бы одно поле записи');
  const note = {
    id: nextId('note'), clientId, voucherId: num(b.voucherId) ?? undefined, doctorId: c.user!.id, doctorName: str(b.doctorName) || 'Врач санатория',
    visitType: ['INITIAL', 'CONTROL', 'DISCHARGE'].includes(b.visitType) ? b.visitType : 'CONTROL', complaints: str(b.complaints), objectiveStatus: str(b.objectiveStatus),
    recommendations: str(b.recommendations), createdAt: iso(),
  };
  c.db.notes.push(note);
  return new Reply(201, note);
});

// ---------- УВЕДОМЛЕНИЯ ----------
const notifView = (n: Db['notifications'][number]) => ({ id: n.id, type: n.type, title: n.title, message: n.message, createdAt: n.createdAt, read: n.read, link: n.link });
add('GET', '/api/notifications', 'auth', (c) => c.db.notifications.filter((n) => n.userId === c.user!.id).sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1)).map(notifView));
add('PUT', '/api/notifications/read-all', 'auth', (c) => {
  c.db.notifications.forEach((n) => { if (n.userId === c.user!.id) n.read = true; });
  return new Reply(204);
});
add('PUT', '/api/notifications/:id/read', 'auth', (c) => {
  const n = c.db.notifications.find((x) => x.id === c.params.id && x.userId === c.user!.id);
  if (!n) throw notFound('Уведомление не найдено');
  n.read = true;
  return notifView(n);
});
add('POST', '/api/notifications', 'auth', (c) => {
  const b = c.body ?? {};
  if (!str(b.title) && !str(b.message)) throw badRequest('Заполните заголовок или текст уведомления');
  const n = notify(c.db, c.user!.id, ['INFO', 'PAYMENT', 'MEDICAL', 'WAITLIST', 'LOYALTY'].includes(b.type) ? b.type : 'INFO', str(b.title), str(b.message), b.link || undefined);
  return new Reply(201, notifView(n));
});
add('DELETE', '/api/notifications/:id', 'auth', (c) => {
  const idx = c.db.notifications.findIndex((x) => x.id === c.params.id && x.userId === c.user!.id);
  if (idx >= 0) c.db.notifications.splice(idx, 1);
  return new Reply(204);
});

// ---------- ОТЗЫВЫ ----------
function reviewStats(db: Db) {
  const all = db.guestReviews;
  const total = all.length;
  const avg = (f: (r: Db['guestReviews'][number]) => number) => (total ? r2(all.reduce((s, r) => s + f(r), 0) / total) : 0);
  const promoters = all.filter((r) => r.npsScore >= 9).length;
  const detractors = all.filter((r) => r.npsScore <= 6).length;
  const dist: Record<1 | 2 | 3 | 4 | 5, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  all.forEach((r) => { dist[r.overallRating as 1 | 2 | 3 | 4 | 5]++; });
  const procs = new Map<string, { sum: number; n: number }>();
  for (const r of all) for (const p of r.procedureFeedback ?? []) {
    const e = procs.get(p.procedureName) ?? { sum: 0, n: 0 };
    e.sum += p.rating; e.n++;
    procs.set(p.procedureName, e);
  }
  return {
    averageOverall: avg((r) => r.overallRating), npsIndex: total ? Math.round(((promoters - detractors) / total) * 100) : 0, totalReviews: total,
    promotersCount: promoters, passivesCount: total - promoters - detractors, detractorsCount: detractors,
    categoryAverages: { room: avg((r) => r.categoriesRating.room), treatment: avg((r) => r.categoriesRating.treatment), food: avg((r) => r.categoriesRating.food), service: avg((r) => r.categoriesRating.service) },
    ratingsDistribution: dist,
    topRatedProcedures: [...procs.entries()].filter(([, e]) => e.n >= 2).map(([name, e]) => ({ name, avgRating: r2(e.sum / e.n), reviewCount: e.n })).sort((a, b) => b.avgRating - a.avgRating || b.reviewCount - a.reviewCount).slice(0, 5),
  };
}
add('GET', '/api/reviews/stats', 'auth', (c) => reviewStats(c.db));
add('GET', '/api/reviews/check-voucher/:id', 'auth', (c) => c.db.guestReviews.some((r) => r.voucherId === Number(c.params.id)));
add('GET', '/api/reviews', 'auth', (c) => {
  const q = c.query;
  const filter = q.get('filter');
  const vid = num(q.get('voucherId'));
  const cid = num(q.get('clientId'));
  const min = num(q.get('minRating'));
  const max = num(q.get('maxRating'));
  let list = [...c.db.guestReviews];
  if (filter === 'ATTENTION') list = list.filter((r) => r.overallRating <= 3 || r.npsScore <= 6 || !r.managementResponse);
  else if (cid !== null) list = list.filter((r) => r.clientId === cid);
  else if (vid !== null) list = list.filter((r) => r.voucherId === vid);
  else if (min !== null) list = list.filter((r) => r.overallRating >= min);
  else if (max !== null) list = list.filter((r) => r.overallRating <= max);
  return list.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
});
add('POST', '/api/reviews', 'auth', (c) => {
  const b = c.body ?? {};
  if (!str(b.comment)) throw badRequest('comment: не должно быть пустым');
  if (b.voucherId && c.db.guestReviews.some((r) => r.voucherId === b.voucherId)) throw conflict('Отзыв по данной путёвке уже был оставлен ранее');
  const clientId = c.user!.clientId ?? num(b.clientId);
  if (clientId === null || clientId === undefined) throw badRequest('Не указан идентификатор клиента (clientId)');
  const lim = (n: unknown, lo: number, hi: number) => clamp(Math.round(Number(n) || lo), lo, hi);
  const overall = lim(b.overallRating, 1, 5);
  const cr = b.categoriesRating ?? {};
  const r = {
    id: nextId('review'), voucherId: Number(b.voucherId), clientId, clientName: str(b.clientName) || clientName(c.db, clientId), categoryName: str(b.categoryName) || 'Номер санатория',
    roomNumber: b.roomNumber, stayDates: str(b.stayDates) || 'Сезон 2026', overallRating: overall, npsScore: lim(b.npsScore, 0, 10),
    categoriesRating: { room: lim(cr.room ?? overall, 1, 5), treatment: lim(cr.treatment ?? overall, 1, 5), food: lim(cr.food ?? overall, 1, 5), service: lim(cr.service ?? overall, 1, 5) },
    procedureFeedback: Array.isArray(b.procedureFeedback) ? b.procedureFeedback.filter((p: any) => str(p?.procedureName)).map((p: any) => ({ procedureName: str(p.procedureName), rating: lim(p.rating, 1, 5), comment: str(p.comment) || undefined })) : [],
    comment: str(b.comment), createdAt: iso(), status: 'PUBLISHED' as const,
  };
  c.db.guestReviews.push(r);
  notifyRole(c.db, 'MANAGER', 'INFO', 'Новый отзыв', `Гость оценил пребывание на ${overall} из 5. ${overall <= 3 ? 'Требуется ответ руководства.' : ''}`, '/manager');
  return new Reply(201, r);
});
add('POST', '/api/reviews/:id/reply', ['MANAGER', 'SYSADMIN'], (c) => {
  const r = c.db.guestReviews.find((x) => x.id === Number(c.params.id));
  if (!r) throw notFound('Отзыв не найден');
  if (!str(c.body?.replyText)) throw badRequest('replyText: не должно быть пустым');
  r.managementResponse = { replyText: str(c.body.replyText), repliedAt: iso(), replierName: str(c.body.replierName) || 'Администрация санатория' };
  notifyClient(c.db, r.clientId, 'INFO', 'Ответ на ваш отзыв', 'Руководство санатория ответило на ваш отзыв. Спасибо, что помогаете нам становиться лучше!', '/my');
  return r;
});

// ---------- КАРТА НОМЕРОВ ----------
function roomState(db: Db, room: Db['rooms'][number], staff: boolean) {
  const today = localToday();
  const cat = db.categories.find((x) => x.id === room.categoryId)!;
  const active = db.vouchers.filter((v) => v.roomId === room.id && ACTIVE_STATUSES.includes(v.status) && v.status !== 'COMPLETED');
  const inHouse = active.find((v) => v.status === 'CHECKED_IN');
  const arriving = active.find((v) => v.status === 'CONFIRMED' && v.checkIn >= today && v.checkIn <= addDays(today, 1));
  let status: 'VACANT' | 'OCCUPIED' | 'CLEANING' | 'RESERVED' = 'VACANT';
  let v: VoucherRec | undefined;
  if (room.statusOverride === 'CLEANING') status = 'CLEANING';
  else if (inHouse) { status = 'OCCUPIED'; v = inHouse; } else if (arriving) { status = 'RESERVED'; v = arriving; } else if (room.statusOverride) status = room.statusOverride;
  return {
    id: room.id, roomNumber: room.roomNumber, categoryId: cat.id, categoryName: cat.name, floor: room.floor, building: room.building, capacity: cat.capacityTotal, status,
    pricePerDay: priceInfo(db, cat.id, today).applied, windowView: `Вид ${room.windowView}`, amenities: room.amenities,
    ...(staff && v ? { currentGuestName: clientName(db, v.clientId), voucherCode: `ПУТ-${String(v.id).padStart(5, '0')}`, checkInDate: v.checkIn, checkOutDate: v.checkOut } : {}),
    ...(room.notes ? { notes: room.notes } : {}),
  };
}
const isStaffUser = (u: UserRec | null) => !!u && u.roles.some((r) => r !== 'CLIENT');
add('GET', '/api/interactive-rooms/stats', 'public', (c) => {
  const list = c.db.rooms.map((r) => roomState(c.db, r, false));
  const n = (s: string) => list.filter((r) => r.status === s).length;
  return { total: list.length, vacant: n('VACANT'), occupied: n('OCCUPIED'), cleaning: n('CLEANING'), reserved: n('RESERVED'), occupancyPercent: Math.round((n('OCCUPIED') / list.length) * 1000) / 10 };
});
add('GET', '/api/interactive-rooms', 'public', (c) => {
  const floor = num(c.query.get('floor'));
  const status = c.query.get('status');
  const cat = num(c.query.get('categoryId'));
  return c.db.rooms.map((r) => roomState(c.db, r, isStaffUser(c.user)))
    .filter((r) => (floor === null || r.floor === floor) && (!status || r.status === status) && (cat === null || r.categoryId === cat));
});
add('GET', '/api/interactive-rooms/:id', 'public', (c) => {
  const r = c.db.rooms.find((x) => x.id === Number(c.params.id));
  if (!r) throw notFound('Номер не найден');
  return roomState(c.db, r, isStaffUser(c.user));
});
add('PUT', '/api/interactive-rooms/:id/status', ['BOOKING_ADMIN', 'MANAGER', 'SYSADMIN'], (c) => {
  const r = c.db.rooms.find((x) => x.id === Number(c.params.id));
  if (!r) throw notFound('Номер не найден');
  const s = c.body?.status;
  if (!['VACANT', 'OCCUPIED', 'CLEANING', 'RESERVED'].includes(s)) throw badRequest('Статус: VACANT, OCCUPIED, CLEANING или RESERVED');
  if (s === 'VACANT') delete r.statusOverride; else r.statusOverride = s;
  if (c.body?.notes !== undefined) r.notes = str(c.body.notes) || undefined;
  return roomState(c.db, r, true);
});

// ---------- ПАКЕТЫ, СКЛАД, ПЕРСОНАЛ ----------
const OPS: Role[] = ['MANAGER', 'SYSADMIN', 'BOOKING_ADMIN'];
add('GET', '/api/packages', 'auth', (c) => c.db.packages);
add('POST', '/api/packages', OPS, (c) => {
  const b = c.body ?? {};
  if (!str(b.name)) throw badRequest('name: не должно быть пустым');
  if (!(Number(b.packagePrice) > 0)) throw badRequest('Цена пакета должна быть положительной');
  const p = { ...b, id: nextId('package'), isActive: b.isActive !== false };
  c.db.packages.push(p);
  return new Reply(201, p);
});
add('PUT', '/api/packages/:id/toggle', OPS, (c) => {
  const p = c.db.packages.find((x) => x.id === Number(c.params.id));
  if (!p) throw notFound('Пакет не найден');
  p.isActive = !p.isActive;
  return p;
});
add('DELETE', '/api/packages/:id', OPS, (c) => {
  const i = c.db.packages.findIndex((x) => x.id === Number(c.params.id));
  if (i < 0) throw notFound('Пакет не найден');
  c.db.packages.splice(i, 1);
  return new Reply(204);
});

const stockStatus = (qty: number, min: number): 'IN_STOCK' | 'LOW_STOCK' | 'CRITICAL' => (qty <= min * 0.5 ? 'CRITICAL' : qty <= min ? 'LOW_STOCK' : 'IN_STOCK');
add('GET', '/api/inventory', 'auth', (c) => c.db.inventory);
add('POST', '/api/inventory', OPS, (c) => {
  const b = c.body ?? {};
  if (!str(b.name)) throw badRequest('name: не должно быть пустым');
  const qty = Number(b.stockQuantity) || 0;
  const min = Number(b.minThreshold) || 0;
  const cab = c.db.cabinets.find((k) => k.id === Number(b.cabinetId));
  const it = { id: nextId('inventory'), sku: str(b.sku) || `SKU-${1000 + c.db.inventory.length * 7}`, name: str(b.name), category: str(b.category) || 'Расходные материалы', cabinetId: Number(b.cabinetId) || 0, cabinetName: cab?.name ?? str(b.cabinetName), unit: str(b.unit) || 'шт', stockQuantity: qty, minThreshold: min, status: stockStatus(qty, min), lastRestockedAt: iso() };
  c.db.inventory.push(it);
  return new Reply(201, it);
});
const stockOp = (sign: 1 | -1) => (c: Ctx) => {
  const it = c.db.inventory.find((x) => x.id === Number(c.params.id));
  if (!it) throw notFound('Позиция не найдена');
  const amount = Number(c.body?.amount);
  if (!(amount > 0)) throw badRequest('Количество должно быть положительным');
  if (sign < 0 && amount > it.stockQuantity) throw conflict('Нельзя списать больше, чем есть на складе');
  it.stockQuantity += sign * amount;
  if (sign > 0) it.lastRestockedAt = iso();
  it.status = stockStatus(it.stockQuantity, it.minThreshold);
  return it;
};
add('POST', '/api/inventory/:id/restock', OPS, stockOp(1));
add('POST', '/api/inventory/:id/write-off', OPS, stockOp(-1));

const staffView = (m: Db['staff'][number]) => ({ ...m, utilizationPercent: m.maxSlotsPerDay ? Math.round((m.assignedSlotsToday / m.maxSlotsPerDay) * 100) : 0 });
add('GET', '/api/staff', 'auth', (c) => c.db.staff.map(staffView));
add('PUT', '/api/staff/:id/status', OPS, (c) => {
  const m = c.db.staff.find((x) => x.id === Number(c.params.id));
  if (!m) throw notFound('Сотрудник не найден');
  if (!['ON_SHIFT', 'VACATION', 'SICK_LEAVE'].includes(c.body?.status)) throw badRequest('Статус: ON_SHIFT, VACATION или SICK_LEAVE');
  m.status = c.body.status;
  if (m.status !== 'ON_SHIFT') m.assignedSlotsToday = 0;
  return staffView(m);
});
add('POST', '/api/staff', OPS, (c) => {
  const b = c.body ?? {};
  if (!str(b.fullName)) throw badRequest('fullName: не должно быть пустым');
  const m = { id: nextId('staff'), fullName: str(b.fullName), role: str(b.role) || 'Сотрудник', cabinetName: str(b.cabinetName), shiftHours: str(b.shiftHours) || '08:00–16:00', status: b.status ?? 'ON_SHIFT', assignedSlotsToday: Number(b.assignedSlotsToday) || 0, maxSlotsPerDay: Number(b.maxSlotsPerDay) || 12, utilizationPercent: 0, rating: Number(b.rating) || 4.5 };
  c.db.staff.push(m);
  return new Reply(201, staffView(m));
});

