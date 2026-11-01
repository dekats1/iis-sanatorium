// Детерминированный генератор демо-данных. Все даты считаются от «сегодня», поэтому данные всегда актуальны.
import type {
  AppNotification, AuditRow, BonusTransaction, ClientView, ConsumableItem, DoctorNote, EhrRecord, GuestReview,
  PriceReview, StaffMember,
} from '../types';
import {
  setBuilder, type AssignmentRec, type Db, type HistoryRec, type NotificationRec, type RoomRec, type SlotRec,
  type UserRec, type VoucherRec, type VoucherStatus, type WaitlistRec,
} from './db';
import {
  ACTIVE_STATUSES, CURRENCY, DAY_MINUTES, PAYMENT_DEADLINE_HOURS, PREPAY_PERCENT, cancellation, capacityOf,
  forecastOccupancy, nightsOf, noise, occModel, planSlots, priceInfo, quote, tierOf, type PlanRequest,
} from './engine';
import { FEMALE_FIRST, FEMALE_PATR, MALE_FIRST, MALE_PATR, SURNAMES } from './names';
import {
  ALLERGIES, BASE_PRICE, CABINETS, CATEGORIES, CHANNELS, CONDITIONS, CONTRA, CUSTOMERS, DIETS, PROCEDURES,
  PROC_PROFILE, PROFILES, PROFILE_CONDITIONS, buildRooms,
} from './seedRef';
import { addDays, clamp, daysBetween, dn, ds, isoAt, localToday, makeRng, r2 } from './util';

const TRANSLIT: Record<string, string> = {
  а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ё: 'e', ж: 'zh', з: 'z', и: 'i', й: 'y', к: 'k', л: 'l', м: 'm', н: 'n',
  о: 'o', п: 'p', р: 'r', с: 's', т: 't', у: 'u', ф: 'f', х: 'kh', ц: 'ts', ч: 'ch', ш: 'sh', щ: 'sch', ъ: '', ы: 'y',
  ь: '', э: 'e', ю: 'yu', я: 'ya',
};
const translit = (s: string) => s.toLowerCase().split('').map((c) => TRANSLIT[c] ?? c).join('');

const ACCOUNT_CLIENTS: [string, string, string, string, string][] = [
  // фамилия, имя, отчество, дата рождения, логин
  ['Иванова', 'Елена', 'Сергеевна', '1971-03-14', 'client'],
  ['Иванов', 'Сергей', 'Петрович', '1964-09-02', 'ivanov'],
  ['Петрова', 'Анна', 'Викторовна', '1958-12-21', 'petrova'],
  ['Сидоренко', 'Николай', 'Андреевич', '1953-06-30', 'sidorenko'],
  ['Коваленко', 'Ирина', 'Михайловна', '1980-01-17', 'kovalenko'],
  ['Козловская', 'Татьяна', 'Ивановна', '1967-04-08', 'kozlovskaya'],
  ['Гринкевич', 'Виктор', 'Леонидович', '1949-11-25', 'grinkevich'],
  ['Романюк', 'Людмила', 'Александровна', '1975-08-12', 'romanyuk'],
];

const COMMENTS_GOOD = [
  'Отличный санаторий! Очень внимательный медицинский персонал, процедуры расписаны удобно, без очередей. Питание разнообразное, диетический стол соблюдался.',
  'Отдыхали вдвоём с мужем, остались довольны. Номер чистый, вид на лес, сосновый воздух творит чудеса. Особенно понравились жемчужные ванны и массаж.',
  'Приезжаю уже третий раз. Врач составил программу под моё давление, самочувствие заметно улучшилось. Спасибо всему коллективу.',
  'Прекрасная территория для прогулок, терренкур, озеро. Процедуры без задержек, медсёстры вежливые. Рекомендую для восстановления после болезни.',
  'Хорошо подобрали лечение для спины, боли ушли уже на второй неделе. Бассейн с минеральной водой — отдельное удовольствие.',
  'Спасибо за внимательное отношение! Питание вкусное, персонал приветливый. Хотелось бы побольше вечерних мероприятий, но в целом всё замечательно.',
  'Ездили по профсоюзной путёвке. Организация на высоте, заселили без очереди, номер соответствует описанию. Лечением довольна.',
];
const COMMENTS_MID = [
  'В целом неплохо, лечение помогло. Но в выходные в водолечебнице были очереди, а в номере было прохладно по вечерам.',
  'Процедуры хорошие, врач внимательный. Питание однообразное, хотелось бы больше свежих овощей. Wi-Fi в номере слабый.',
  'Номер чистый, но мебель уже устаревшая. Лечением довольна, персонал вежливый. За такие деньги ожидала немного большего.',
];
const COMMENTS_BAD = [
  'Расписание процедур несколько раз переносили без предупреждения, пришлось ждать в коридоре. Номер холодный, батареи еле тёплые.',
  'Не понравилось питание и долгое заселение (ждали номер до вечера). Лечение нормальное, но организация хромает.',
];
const REPLIES = [
  'Благодарим вас за тёплый отзыв! Будем рады видеть вас снова в «Беловежских далях».',
  'Спасибо за обратную связь! Передали ваши пожелания службе питания и администрации — постараемся сделать пребывание ещё комфортнее.',
  'Приносим извинения за доставленные неудобства. Ваше замечание передано главной медсестре; расписание процедур мы пересмотрели. Надеемся, что вы дадите нам шанс исправиться.',
];

export function buildDb(): Db {
  const rng = makeRng(20260317);
  const today = localToday();
  const todayN = dn(today);
  const nowMs = Date.now();
  const iso = (ms: number) => new Date(ms).toISOString();
  const windowStart = addDays(today, -60);
  const windowEnd = addDays(today, 95);

  const db: Db = {
    seedDate: today,
    windowStart,
    seq: {},
    users: [], categories: CATEGORIES.map((c) => ({ ...c })), rooms: buildRooms(), profiles: PROFILES.map((x) => ({ ...x })),
    diets: DIETS.map((x) => ({ ...x })), conditions: CONDITIONS.map((x) => ({ ...x })), channels: CHANNELS.map((x) => ({ ...x })),
    procedures: PROCEDURES.map((x) => ({ ...x })), cabinets: CABINETS.map((x) => ({ ...x })), customers: CUSTOMERS.map((x) => ({ ...x })),
    procProfile: PROC_PROFILE.map((x) => [...x] as [number, number]), contra: CONTRA.map((x) => [...x] as [number, number]),
    clients: [], clientConditions: [], vouchers: [], waitlist: [], assignments: [], slots: [], seasons: [], tariffs: [], corridors: [],
    priceReviews: [], history: {}, forecasts: [], forecastRuns: [], loyalty: {}, bonusTx: [], ehr: {}, notes: [], notifications: [],
    guestReviews: [], packages: [], inventory: [], staff: [], audit: [], refunds: [],
  };
  const seq = (k: string) => { db.seq[k] = (db.seq[k] ?? 0) + 1; return db.seq[k]; };

  // ---------- пользователи ----------
  const pw = 'demo12345';
  const staff: [number, string, string, UserRec['roles'], string][] = [
    [1, 'sysadmin', 'Юрчик Артём Константинович', ['SYSADMIN'], 'sysadmin@belovezhskie-dali.by'],
    [2, 'manager', 'Нестерович Дмитрий Олегович', ['MANAGER'], 'manager@belovezhskie-dali.by'],
    [3, 'admin', 'Мазуревич Светлана Ивановна', ['BOOKING_ADMIN'], 'admin@belovezhskie-dali.by'],
    [4, 'doctor', 'Смирнова Елена Викторовна', ['DOCTOR'], 'smirnova@belovezhskie-dali.by'],
    [5, 'doctor2', 'Климович Андрей Павлович', ['DOCTOR'], 'klimovich@belovezhskie-dali.by'],
  ];
  for (const [id, username, fullName, roles, email] of staff) {
    db.users.push({ id, username, password: pw, fullName, email, active: true, roles });
  }
  db.seq.user = 5;

  // ---------- клиенты ----------
  const clients: ClientView[] = [];
  const mkPhone = () => `+375 ${rng.pick(['29', '33', '44', '25'])} ${rng.int(100, 999)}-${rng.int(10, 99)}-${rng.int(10, 99)}`;
  ACCOUNT_CLIENTS.forEach(([ln, fn, mn, bd, username], i) => {
    const id = i + 1;
    clients.push({ id, lastName: ln, firstName: fn, middleName: mn, birthDate: bd, phone: mkPhone(), email: `${username === 'client' ? 'e.ivanova' : username}@mail.by`, citizenship: 'Республика Беларусь' });
    const uid = 5 + id;
    db.users.push({ id: uid, username, password: pw, fullName: `${ln} ${fn} ${mn}`, email: clients[i].email ?? null, active: true, roles: ['CLIENT'], clientId: id });
  });
  db.seq.user = 5 + ACCOUNT_CLIENTS.length;
  const usedNames = new Set(clients.map((c) => `${c.lastName}${c.firstName}`));
  while (clients.length < 172) {
    const female = rng.chance(0.62);
    const sur = rng.pick(SURNAMES);
    const ln = female ? sur[1] : sur[0];
    const fn = female ? rng.pick(FEMALE_FIRST) : rng.pick(MALE_FIRST);
    if (usedNames.has(ln + fn)) continue;
    usedNames.add(ln + fn);
    const mn = female ? rng.pick(FEMALE_PATR) : rng.pick(MALE_PATR);
    const age = clamp(Math.round(55 + rng.gauss() * 14), 24, 86);
    const bd = `${Number(today.slice(0, 4)) - age}-${String(rng.int(1, 12)).padStart(2, '0')}-${String(rng.int(1, 28)).padStart(2, '0')}`;
    const email = rng.chance(0.78) ? `${translit(fn)[0]}.${translit(ln)}${rng.chance(0.4) ? rng.int(1, 99) : ''}@${rng.pick(['mail.ru', 'gmail.com', 'tut.by', 'yandex.by', 'mail.by'])}` : undefined;
    clients.push({
      id: clients.length + 1, lastName: ln, firstName: fn, middleName: mn, birthDate: bd,
      phone: rng.chance(0.93) ? mkPhone() : undefined, email,
      citizenship: rng.weighted(['Республика Беларусь', 'Российская Федерация', 'Республика Казахстан'], [86, 11, 3]),
    });
  }
  db.clients = clients;
  db.seq.client = clients.length;

  // ---------- сезоны, тарифы, коридоры ----------
  const y0 = Number(today.slice(0, 4));
  for (const y of [y0 - 1, y0, y0 + 1]) {
    const defs: [string, string, string, number][] = [
      [`Новогодние каникулы ${y}`, `${y}-01-01`, `${y}-01-08`, 1.3],
      [`Зима ${y}`, `${y}-01-09`, `${y}-03-31`, 0.95],
      [`Весна ${y}`, `${y}-04-01`, `${y}-05-31`, 0.92],
      [`Лето ${y}`, `${y}-06-01`, `${y}-08-31`, 1.25],
      [`Бархатный сезон ${y}`, `${y}-09-01`, `${y}-09-30`, 1.05],
      [`Осень ${y}`, `${y}-10-01`, `${y}-12-24`, 0.85],
      [`Новогодние праздники ${y}`, `${y}-12-25`, `${y}-12-31`, 1.3],
    ];
    for (const [name, from, to, k] of defs) {
      const id = seq('season');
      db.seasons.push({ id, name, date_from: from, date_to: to, k_season: k });
      for (const c of CATEGORIES) db.tariffs.push({ id: seq('tariff'), season_id: id, category_id: c.id, price_base: BASE_PRICE[c.id] });
    }
  }
  for (const c of CATEGORIES) {
    db.corridors.push({
      id: seq('corridor'), category_id: c.id, date_from: addDays(today, -400), date_to: addDays(today, 400),
      p_min: r2(BASE_PRICE[c.id] * 0.88), p_max: r2(BASE_PRICE[c.id] * 1.42), min_los: 3, closed: false,
    });
  }

  // ---------- путёвки ----------
  const cap = (room: RoomRec) => capacityOf(db, room);
  const totalCap = db.rooms.reduce((s, r) => s + cap(r), 0);
  const roomVouchers = new Map<number, VoucherRec[]>();
  const clientStays = new Map<number, [string, string][]>();
  const dayPlaces = new Map<number, number>();
  const all: VoucherRec[] = [];
  let tempId = 0;

  const freeIn = (room: RoomRec, from: string, to: string): number => {
    const vs = (roomVouchers.get(room.id) ?? []).filter((v) => v.checkIn < to && from < v.checkOut);
    if (vs.length === 0) return cap(room);
    let used = 0;
    for (const n of nightsOf(from, to)) {
      let u = 0;
      for (const v of vs) if (v.checkIn <= n && n < v.checkOut) u += v.places;
      used = Math.max(used, u);
    }
    return cap(room) - used;
  };
  const pickRoom = (cat: number, from: string, to: string, places: number): RoomRec | null => {
    const rooms = db.rooms.filter((r) => r.categoryId === cat);
    const off = rng.int(0, rooms.length - 1);
    let best: RoomRec | null = null;
    let bestFree = 99;
    for (let k = 0; k < rooms.length; k++) {
      const r = rooms[(k + off) % rooms.length];
      const f = freeIn(r, from, to);
      if (f >= places && f < bestFree) { best = r; bestFree = f; }
    }
    return best;
  };
  const clientFree = (id: number, from: string, to: string) => !(clientStays.get(id) ?? []).some(([a, b]) => a < to && from < b);
  const pickClient = (from: string, to: string): number => {
    for (let t = 0; t < 8; t++) {
      const id = rng.chance(0.03) ? rng.int(1, 8) : rng.int(9, clients.length);
      if (clientFree(id, from, to)) return id;
    }
    return 0;
  };
  let arrivalsToday = 0;
  const profileOfClient = new Map<number, number>();

  const createdFor = (ci: string, dayOffsetLead: number): string => {
    const hour = rng.int(8, 21);
    const ms = Date.UTC(Number(ci.slice(0, 4)), Number(ci.slice(5, 7)) - 1, Number(ci.slice(8, 10)), hour, rng.int(0, 59)) - dayOffsetLead * 86400000;
    return iso(Math.min(ms, nowMs - rng.int(1, 30) * 3600000));
  };

  const makeVoucher = (clientId: number, cat: number, room: RoomRec, ci: string, co: string, places: number, forced?: VoucherStatus): VoucherRec => {
    const q = quote(db, cat, ci, co)!;
    const total = r2(q.perDayAvg * places * nightsOf(ci, co).length);
    let status: VoucherStatus;
    if (forced) status = forced;
    else if (co <= today) status = 'COMPLETED';
    else if (ci <= today) {
      if (ci === today && arrivalsToday < 4) { status = 'CONFIRMED'; arrivalsToday++; } else status = 'CHECKED_IN';
    } else status = 'CONFIRMED';
    const created = createdFor(ci, rng.int(4, 70));
    const paid = status === 'CONFIRMED' ? (rng.chance(0.25) ? total : r2((total * PREPAY_PERCENT) / 100)) : status === 'AWAITING_PAYMENT' ? 0 : total;
    const profile = rng.weighted([1, 2, 3, 4, 5, 6], [30, 26, 15, 10, 12, 7]);
    const v: VoucherRec = {
      id: ++tempId, clientId, status, categoryId: cat, roomId: room.id, checkIn: ci, checkOut: co, places,
      pricePerPlaceDay: q.perDayAvg, totalPrice: total, currency: CURRENCY,
      paymentDeadline: iso(Date.parse(created) + PAYMENT_DEADLINE_HOURS * 3600000), paid,
      profileId: profile, channelId: rng.weighted(CHANNELS.map((c) => c.id), [28, 12, 20, 15, 10, 10, 5]),
      dietId: rng.chance(0.85) ? rng.weighted([1, 2, 3, 4, 5, 6], [30, 22, 12, 22, 9, 5]) : null,
      customerId: null, createdAt: created, createdBy: null,
    };
    if (v.channelId === 5 && rng.chance(0.8)) v.customerId = rng.int(1, CUSTOMERS.length);
    if (v.channelId === 4 && rng.chance(0.5)) v.customerId = 3;
    return v;
  };

  const place = (v: VoucherRec, occupying: boolean) => {
    all.push(v);
    if (!occupying) return;
    (roomVouchers.get(v.roomId) ?? roomVouchers.set(v.roomId, []).get(v.roomId)!).push(v);
    (clientStays.get(v.clientId) ?? clientStays.set(v.clientId, []).get(v.clientId)!).push([v.checkIn, v.checkOut]);
    for (let d = dn(v.checkIn); d < dn(v.checkOut); d++) dayPlaces.set(d, (dayPlaces.get(d) ?? 0) + v.places);
  };

  const tryCreate = (date: string): boolean => {
    for (let a = 0; a < 6; a++) {
      const cat = rng.weighted([1, 2, 3, 4, 5], [30, 22, 13, 18, 17]);
      const nights = rng.weighted([7, 10, 12, 14, 18, 21], [14, 20, 12, 32, 8, 14]);
      const co = addDays(date, nights);
      const maxPlaces = CATEGORIES[cat - 1].capacityTotal;
      const places = Math.min(maxPlaces, rng.weighted([1, 2, 3, 4], [26, 46, 12, 16]));
      const room = pickRoom(cat, date, co, places);
      if (!room) continue;
      const client = pickClient(date, co);
      if (!client) continue;
      place(makeVoucher(client, cat, room, date, co, places), true);
      return true;
    }
    return false;
  };

  for (let d = dn(windowStart) - 21; d <= dn(windowEnd); d++) {
    const date = ds(d);
    const ahead = d - todayN;
    const occ = occModel(date);
    let f = ahead <= 0 ? 1 : Math.max(0.22, 1 - 0.0085 * ahead);
    if (ahead > 0 && occ > 0.85) f = Math.max(f, 0.8);
    const target = occ * f * totalCap * (0.97 + 0.06 * rng.next());
    let guard = 0;
    while ((dayPlaces.get(d) ?? 0) < target && guard++ < 25) tryCreate(date);
  }

  // новогодний пик: «люкс» и «апартаменты» заполнены, чтобы показать лист ожидания
  const nyYear = today.slice(5) >= '01-10' ? y0 : y0 - 1;
  const nyFrom = `${nyYear}-12-27`;
  const nyTo = `${nyYear + 1}-01-05`;
  if (nyFrom <= windowEnd && nyTo >= today) {
    for (const cat of [3, 5]) {
      for (const room of db.rooms.filter((r) => r.categoryId === cat)) {
        const f = freeIn(room, nyFrom, nyTo);
        if (f <= 0) continue;
        const client = pickClient(nyFrom, nyTo);
        if (client) place(makeVoucher(client, cat, room, nyFrom, nyTo, f, 'CONFIRMED'), true);
      }
    }
  }

  // оформленные, но неоплаченные путёвки (ждут оплаты) и недавно истёкшие
  const upcoming = all.filter((v) => v.status === 'CONFIRMED' && v.checkIn > addDays(today, 6) && v.checkIn < addDays(today, 45) && v.clientId > 8);
  for (let i = 0; i < 7 && i < upcoming.length; i++) {
    const v = upcoming[i * 3 % upcoming.length];
    if (v.status !== 'CONFIRMED') continue;
    v.status = 'AWAITING_PAYMENT';
    v.paid = 0;
    v.createdAt = iso(nowMs - rng.int(1, 19) * 3600000);
    v.paymentDeadline = iso(Date.parse(v.createdAt) + PAYMENT_DEADLINE_HOURS * 3600000);
  }

  // отменённые и просроченные: места не занимают
  const activeCount = all.length;
  const extra = Math.round(activeCount * 0.1);
  for (let i = 0; i < extra; i++) {
    const cancelled = i % 4 !== 0;
    const ci = ds(dn(windowStart) + rng.int(-5, dn(windowEnd) - dn(windowStart) - 8));
    const cat = rng.weighted([1, 2, 3, 4, 5], [30, 22, 13, 18, 17]);
    const places = Math.min(CATEGORIES[cat - 1].capacityTotal, rng.weighted([1, 2, 3], [40, 54, 6]));
    const nights = rng.weighted([7, 10, 14, 21], [20, 25, 40, 15]);
    const room = rng.pick(db.rooms.filter((r) => r.categoryId === cat));
    const v = makeVoucher(rng.int(9, clients.length), cat, room, ci, addDays(ci, nights), places, cancelled ? 'CANCELLED' : 'EXPIRED');
    const createdDay = ds(Math.max(dn(ci) - rng.int(5, 60), dn(windowStart) - 20));
    v.createdAt = createdFor(ci, 0).replace(/^\d{4}-\d{2}-\d{2}/, createdDay);
    if (Date.parse(v.createdAt) > nowMs) v.createdAt = iso(nowMs - rng.int(2, 60) * 3600000);
    v.paymentDeadline = iso(Date.parse(v.createdAt) + PAYMENT_DEADLINE_HOURS * 3600000);
    if (cancelled && rng.chance(0.62)) {
      const paid = r2((v.totalPrice * PREPAY_PERCENT) / 100);
      const cdMax = Math.min(dn(ci) - 1, todayN);
      const cdMin = Math.min(dn(v.createdAt.slice(0, 10)), cdMax);
      const cancelDate = ds(rng.int(cdMin, cdMax));
      const res = cancellation(ci, cancelDate, v.totalPrice, paid);
      v.paid = paid;
      v.retained = res.retained;
      v.refunded = res.refund;
    } else {
      v.paid = 0;
    }
    place(v, false);
  }

  // назначаем клиентам-демо типичные истории (по одной путёвке в каждом статусе)
  const owned = (id: number) => all.filter((v) => v.clientId === id && ACTIVE_STATUSES.includes(v.status));
  const give = (clientId: number, pred: (v: VoucherRec) => boolean, count = 1) => {
    let given = 0;
    for (const v of all) {
      if (given >= count) break;
      if (v.clientId <= 8 || !pred(v)) continue;
      if (owned(clientId).some((o) => o.checkIn < v.checkOut && v.checkIn < o.checkOut)) continue;
      v.clientId = clientId;
      given++;
    }
  };
  give(1, (v) => v.status === 'CHECKED_IN');
  give(1, (v) => v.status === 'CONFIRMED' && v.checkIn > addDays(today, 15) && v.paid < v.totalPrice);
  give(1, (v) => v.status === 'AWAITING_PAYMENT');
  give(1, (v) => v.status === 'COMPLETED', 3);
  give(2, (v) => v.status === 'CONFIRMED' && v.checkIn > addDays(today, 5));
  give(2, (v) => v.status === 'COMPLETED', 2);
  give(3, (v) => v.status === 'CHECKED_IN');
  give(3, (v) => v.status === 'COMPLETED', 2);
  give(4, (v) => v.status === 'COMPLETED', 2);
  give(4, (v) => v.status === 'CONFIRMED' && v.checkIn > addDays(today, 30));
  give(5, (v) => v.status === 'CHECKED_IN');
  give(6, (v) => v.status === 'CONFIRMED' && v.checkIn > addDays(today, 10));
  give(6, (v) => v.status === 'COMPLETED', 2);
  give(7, (v) => v.status === 'COMPLETED', 2);
  give(8, (v) => v.status === 'CHECKED_IN');
  give(8, (v) => v.status === 'COMPLETED', 1);
  give(1, (v) => v.status === 'CANCELLED');
  give(3, (v) => v.status === 'EXPIRED');

  all.sort((a, b) => (a.createdAt < b.createdAt ? -1 : a.createdAt > b.createdAt ? 1 : a.id - b.id));
  all.forEach((v, i) => { v.id = i + 1; });
  db.vouchers = all;
  db.seq.voucher = all.length;
  for (const v of all) {
    const channel = v.channelId;
    void channel;
    if (!profileOfClient.has(v.clientId)) profileOfClient.set(v.clientId, v.profileId);
  }

  // ---------- состояния здоровья, ЭМК ----------
  const hasVoucher = new Set(all.map((v) => v.clientId));
  const femaleOf = (c: ClientView) => c.middleName?.endsWith('на') ?? false;
  for (const c of clients) {
    const pr = profileOfClient.get(c.id) ?? rng.int(1, 6);
    const pool = PROFILE_CONDITIONS[pr];
    const set = new Set<number>();
    const n = rng.weighted([0, 1, 2, 3], [8, 40, 38, 14]);
    for (let k = 0; k < n; k++) set.add(rng.pick(pool));
    if (rng.chance(0.05)) set.add(rng.pick([12, 13, 16]));
    if (rng.chance(0.03) && femaleOf(c) && Number(c.birthDate.slice(0, 4)) > y0 - 45) set.add(14);
    for (const cid of set) db.clientConditions.push({ clientId: c.id, conditionId: cid, diagnosedAt: addDays(today, -rng.int(120, 4000)) });
  }
  // у демо-клиентов гарантированно есть состояния для показа противопоказаний
  const ensureCond = (clientId: number, cid: number) => {
    if (!db.clientConditions.some((x) => x.clientId === clientId && x.conditionId === cid)) {
      db.clientConditions.push({ clientId, conditionId: cid, diagnosedAt: addDays(today, -rng.int(300, 3000)) });
    }
  };
  ensureCond(1, 1); ensureCond(1, 7); ensureCond(3, 2); ensureCond(3, 16); ensureCond(5, 3); ensureCond(8, 5);

  for (const c of clients) {
    const conds = db.clientConditions.filter((x) => x.clientId === c.id).map((x) => db.conditions.find((k) => k.id === x.conditionId)!);
    const h = clamp(Math.round(170 + rng.gauss() * 9), 150, 196);
    const w = clamp(Math.round(h - 100 + rng.gauss() * 12 + 4), 50, 130);
    const rec: EhrRecord = {
      clientId: c.id,
      sanatoriumCardNumber: `СК-${y0}-${String(c.id).padStart(4, '0')}`,
      cardIssuedDate: hasVoucher.has(c.id) ? addDays(today, -rng.int(10, 400)) : undefined,
      mainDiagnosis: conds[0] ? `${conds[0].name} (${conds[0].code})` : 'Практически здоров, оздоровительный курс',
      bloodType: rng.pick(['A (II) Rh+', 'O (I) Rh+', 'B (III) Rh+', 'AB (IV) Rh+', 'O (I) Rh-', 'A (II) Rh-']),
      heightCm: h,
      weightKg: w,
      bmi: r2(w / ((h / 100) ** 2)),
      systolicBp: clamp(Math.round(128 + rng.gauss() * 14), 100, 180),
      diastolicBp: clamp(Math.round(81 + rng.gauss() * 8), 60, 105),
      pulseBpm: clamp(Math.round(73 + rng.gauss() * 8), 55, 100),
      allergies: rng.chance(0.3) ? [rng.pick(ALLERGIES)] : [],
      contraindications: conds.filter((x) => [12, 13, 14, 16, 3].includes(x.id)).map((x) => x.name),
      dietCode: rng.pick(['DIET-15', 'DIET-5', 'DIET-9', 'DIET-10']),
      updatedAt: iso(nowMs - rng.int(1, 30) * 86400000),
    };
    rec.bmi = Math.round(rec.bmi! * 10) / 10;
    db.ehr[c.id] = rec;
  }

  // ---------- назначения и расписание ----------
  const procsFor = (profile: number) => db.procProfile.filter(([p]) => p === profile).map(([, id]) => id);
  const contraFor = (clientId: number) => {
    const conds = new Set(db.clientConditions.filter((x) => x.clientId === clientId).map((x) => x.conditionId));
    return new Set(db.contra.filter(([, c]) => conds.has(c)).map(([p]) => p));
  };
  const busy = new Map<string, Set<number>>();
  const nowMin = new Date().getHours() * 60 + new Date().getMinutes();
  const doctorIds = [4, 5];
  const candidates = all
    .filter((v) => (v.status === 'CHECKED_IN' || (v.status === 'COMPLETED' && v.checkOut >= addDays(today, -14))) && v.clientId > 0)
    .sort((a, b) => (a.checkIn < b.checkIn ? -1 : 1));
  for (const v of candidates) {
    if (!rng.chance(v.status === 'CHECKED_IN' ? 0.8 : 0.5)) continue;
    const allowed = procsFor(v.profileId).filter((id) => !contraFor(v.clientId).has(id));
    if (allowed.length < 3) continue;
    const picked = [...allowed].sort(() => rng.next() - 0.5).slice(0, rng.int(3, Math.min(6, allowed.length)));
    const stayNights = daysBetween(v.checkIn, v.checkOut);
    const items = picked.map((id) => ({ procedureId: id, sessionsPlanned: Math.min(stayNights - 1, rng.int(6, 12)) }));
    const aId = seq('assignment');
    const a: AssignmentRec = { id: aId, voucherId: v.id, doctorId: rng.pick(doctorIds), createdAt: isoAt(v.checkIn, 11, rng.int(0, 59)), items, planned: true };
    const reqs: PlanRequest[] = items.map((it) => {
      const p = db.procedures.find((x) => x.id === it.procedureId)!;
      const cab = db.cabinets.find((x) => x.id === p.cabinetId)!;
      return { procedureId: p.id, cabinetId: cab.id, slotsPerDay: cab.slotsPerDay, sessions: it.sessionsPlanned };
    });
    const days = nightsOf(addDays(v.checkIn, 1), v.checkOut);
    const { slots } = planSlots(days, reqs, DAY_MINUTES, busy, new Map());
    for (const s of slots) {
      const k = `${s.cabinetId}|${s.date}`;
      (busy.get(k) ?? busy.set(k, new Set()).get(k)!).add(s.slotIndex);
      const startClock = 8 * 60 + s.startMinute;
      const done = s.date < today || (s.date === today && startClock + 20 < nowMin);
      const rec: SlotRec = { id: seq('slot'), assignmentId: aId, procedureId: s.procedureId, cabinetId: s.cabinetId, date: s.date, startMinute: s.startMinute, slotIndex: s.slotIndex, done };
      db.slots.push(rec);
    }
    db.assignments.push(a);
  }

  // ---------- дневник врача ----------
  const NOTE_POOL = {
    complaints: ['Жалоб активно не предъявляет, пришёл на плановое санаторное лечение.', 'Боли в пояснице при длительной ходьбе, утренняя скованность.', 'Периодические головные боли, повышение давления по вечерам.', 'Одышка при подъёме по лестнице, быстрая утомляемость.', 'Нарушение сна, раздражительность, снижение работоспособности.', 'Боль в коленных суставах после нагрузки.'],
    status: ['Состояние удовлетворительное. АД в пределах нормы, пульс ритмичный. Дыхание везикулярное.', 'Состояние средней тяжести. Пальпация паравертебральных точек болезненна. Объём движений ограничен.', 'Сознание ясное, кожа чистая. Тоны сердца приглушены, ритм правильный.'],
    recs: ['Режим щадящий, питание по диете №5. Курс из 8–10 процедур по назначению. Контроль АД ежедневно.', 'Рекомендованы ЛФК, массаж и грязелечение. Избегать переохлаждения, ограничить соль.', 'Продолжить лечение по схеме, ЭКГ-контроль на 7-е сутки. Контрольный осмотр через 5 дней.'],
  };
  const noteVouchers = all.filter((v) => (v.status === 'CHECKED_IN' || v.status === 'COMPLETED') && v.checkOut >= addDays(today, -30));
  for (const v of noteVouchers) {
    if (!rng.chance(0.75)) continue;
    const docId = rng.pick(doctorIds);
    const doc = db.users.find((u) => u.id === docId)!;
    const dayN = (n: DoctorNote['visitType'], d: string) => {
      db.notes.push({
        id: seq('note'), clientId: v.clientId, voucherId: v.id, doctorId: doc.id, doctorName: `Др. ${doc.fullName.split(' ')[0]} ${doc.fullName.split(' ')[1][0]}. ${doc.fullName.split(' ')[2][0]}.`,
        visitType: n, complaints: rng.pick(NOTE_POOL.complaints), objectiveStatus: rng.pick(NOTE_POOL.status),
        recommendations: rng.pick(NOTE_POOL.recs), createdAt: isoAt(d, rng.int(6, 12), rng.int(0, 59)),
      });
    };
    dayN('INITIAL', v.checkIn);
    if (daysBetween(v.checkIn, today > v.checkOut ? v.checkOut : today) > 6) dayN('CONTROL', addDays(v.checkIn, 7));
    if (v.status === 'COMPLETED') dayN('DISCHARGE', addDays(v.checkOut, -1));
  }

  // ---------- лояльность ----------
  const byClient = new Map<number, VoucherRec[]>();
  for (const v of all) (byClient.get(v.clientId) ?? byClient.set(v.clientId, []).get(v.clientId)!).push(v);
  for (const [cid, vs] of byClient) {
    const completed = vs.filter((v) => v.status === 'COMPLETED').sort((a, b) => (a.checkOut < b.checkOut ? -1 : 1));
    if (completed.length === 0 && !vs.some((v) => v.status === 'CHECKED_IN' || v.status === 'CONFIRMED')) continue;
    let balance = 100;
    let spent = 0;
    const first = vs.map((v) => v.createdAt).sort()[0];
    db.bonusTx.push({ id: seq('bonus'), clientId: cid, amount: 100, type: 'WELCOME', description: 'Приветственный бонус нового гостя', createdAt: first });
    for (const v of completed) {
      if (balance > 250 && rng.chance(0.3)) {
        const used = Math.round(rng.int(80, Math.min(300, balance)) / 10) * 10;
        balance -= used;
        db.bonusTx.push({ id: seq('bonus'), clientId: cid, amount: -used, type: 'REDEMPTION', description: `Оплата бонусами части путёвки №${v.id}`, createdAt: v.createdAt, voucherId: v.id });
      }
      const t = tierOf(spent);
      const pts = Math.round((v.totalPrice * t.cashback) / 100);
      spent += v.totalPrice;
      balance += pts;
      db.bonusTx.push({ id: seq('bonus'), clientId: cid, amount: pts, type: 'ACCRUAL', description: `Кэшбэк ${t.cashback}% за путёвку №${v.id}`, createdAt: isoAt(v.checkOut, 12), voucherId: v.id });
    }
    if (rng.chance(0.15)) {
      balance += 50;
      db.bonusTx.push({ id: seq('bonus'), clientId: cid, amount: 50, type: 'PROMO', description: 'Подарок ко дню рождения', createdAt: iso(nowMs - rng.int(5, 100) * 86400000) });
    }
    db.loyalty[cid] = { balance, spentMoney: r2(spent) };
  }
  db.bonusTx.sort((a, b) => (a.createdAt < b.createdAt ? -1 : 1));
  db.bonusTx.forEach((t: BonusTransaction, i) => { t.id = i + 1; });
  db.seq.bonus = db.bonusTx.length;

  // ---------- история спроса и прогноз ----------
  const realSold = new Map<number, Map<number, number>>();
  for (const v of all) {
    if (!ACTIVE_STATUSES.includes(v.status)) continue;
    const m = realSold.get(v.categoryId) ?? realSold.set(v.categoryId, new Map()).get(v.categoryId)!;
    for (let d = dn(v.checkIn); d < dn(v.checkOut); d++) m.set(d, (m.get(d) ?? 0) + v.places);
  }
  const catFactor: Record<number, number> = { 1: 1.04, 2: 1, 3: 0.97, 4: 0.95, 5: 0.9 };
  const stamp = iso(nowMs - 2 * 3600000);
  for (const c of CATEGORIES) {
    const avail = db.rooms.filter((r) => r.categoryId === c.id).length * c.capacityTotal;
    const points: HistoryRec[] = [];
    for (let d = todayN - 540; d < todayN; d++) {
      const date = ds(d);
      let sold: number;
      if (date >= windowStart) sold = realSold.get(c.id)?.get(d) ?? 0;
      else sold = Math.round(avail * clamp(occModel(date) * catFactor[c.id] * (1 + 0.06 * noise(`${c.id}|${date}`)), 0.05, 0.99));
      points.push({ stay_date: date, sold: Math.min(sold, avail), available: avail });
    }
    db.history[c.id] = points;
    const runId = seq('forecastRun');
    const { points: fc, mape } = forecastOccupancy(points, 90, today);
    db.forecastRuns.push({ id: runId, mape, created_at: stamp, category_id: c.id });
    for (const p of fc) db.forecasts.push({ run_id: runId, category_id: c.id, stay_date: p.stay_date, predicted_occ: p.predicted_occ, lower: p.lower, upper: p.upper, created_at: stamp });
  }

  // ---------- рекомендации цен вне коридора ----------
  const uuid = () => `${rng.int(0x10000000, 0xffffffff).toString(16)}-${rng.int(0x1000, 0xffff).toString(16)}-4${rng.int(0x100, 0xfff).toString(16)}-a${rng.int(0x100, 0xfff).toString(16)}-${rng.int(0x10000000, 0xffffffff).toString(16)}${rng.int(0x1000, 0xffff).toString(16)}`;
  const pending: PriceReview[] = [];
  for (const c of CATEGORIES) {
    const dev: { date: string; rec: number; applied: number; pMin: number; pMax: number; score: number }[] = [];
    for (let i = 3; i <= 75; i++) {
      const date = addDays(today, i);
      const info = priceInfo(db, c.id, date);
      if (!info.available || info.pMin === null || info.pMax === null) continue;
      if (info.recommended < info.pMin || info.recommended > info.pMax) {
        dev.push({ date, rec: info.recommended, applied: info.applied, pMin: info.pMin, pMax: info.pMax, score: Math.abs(info.recommended - info.applied) });
      }
    }
    dev.sort((a, b) => b.score - a.score);
    const chosen = dev.slice(0, 3).sort((a, b) => (a.date < b.date ? -1 : 1));
    for (const d of chosen) {
      pending.push({
        id: 0, quote_id: uuid(), category_id: c.id, stay_date: d.date, price_recommended: d.rec, price_applied: d.applied, p_min: d.pMin, p_max: d.pMax,
        status: 'PENDING_REVIEW', created_at: iso(nowMs - rng.int(1, 70) * 3600000), decided_by: null, decided_at: null,
      });
    }
    // уже рассмотренные
    for (let k = 0; k < 3; k++) {
      const stay = addDays(today, rng.int(-20, 25));
      const base = BASE_PRICE[c.id];
      const high = rng.chance(0.5);
      const rec = r2(high ? base * rng.int(146, 165) / 100 : base * rng.int(70, 84) / 100);
      const created = nowMs - rng.int(2, 26) * 86400000;
      pending.push({
        id: 0, quote_id: uuid(), category_id: c.id, stay_date: stay, price_recommended: rec, price_applied: r2(clamp(rec, base * 0.88, base * 1.42)),
        p_min: r2(base * 0.88), p_max: r2(base * 1.42), status: rng.chance(0.65) ? 'ACKNOWLEDGED' : 'RULE_ADJUSTED',
        created_at: iso(created), decided_by: 'manager', decided_at: iso(created + rng.int(1, 40) * 3600000),
      });
    }
  }
  pending.sort((a, b) => (a.created_at < b.created_at ? -1 : 1));
  pending.forEach((p, i) => { p.id = i + 1; });
  db.priceReviews = pending;
  db.seq.priceReview = pending.length;

  // ---------- отзывы ----------
  const doneVouchers = all.filter((v) => v.status === 'COMPLETED' && v.checkOut >= addDays(today, -58));
  const noReview = new Set<number>();
  // у демо-клиента №1 одна завершённая путёвка остаётся без отзыва (кнопка «Оставить отзыв»)
  const c1 = doneVouchers.filter((v) => v.clientId === 1);
  if (c1[0]) noReview.add(c1[0].id);
  for (const v of doneVouchers) {
    if (noReview.has(v.id) || !rng.chance(0.42)) continue;
    const bias = rng.next();
    const overall = bias < 0.62 ? 5 : bias < 0.84 ? 4 : bias < 0.93 ? 3 : bias < 0.98 ? 2 : 1;
    const nps = overall === 5 ? rng.int(9, 10) : overall === 4 ? rng.int(8, 9) : overall === 3 ? rng.int(5, 7) : rng.int(1, 4);
    const sub = () => clamp(overall + rng.int(-1, 1), 1, 5);
    const procs = procsFor(v.profileId).sort(() => rng.next() - 0.5).slice(0, rng.int(1, 3));
    const created = isoAt(addDays(v.checkOut, rng.int(0, 3)), rng.int(9, 20), rng.int(0, 59));
    const cl = clients.find((c) => c.id === v.clientId)!;
    const cat = CATEGORIES.find((c) => c.id === v.categoryId)!;
    const room = db.rooms.find((r) => r.id === v.roomId)!;
    const fmt = (d: string) => `${d.slice(8)}.${d.slice(5, 7)}.${d.slice(0, 4)}`;
    const review: GuestReview = {
      id: 0, voucherId: v.id, clientId: v.clientId, clientName: `${cl.lastName} ${cl.firstName[0]}.`, categoryName: cat.name, roomNumber: room.roomNumber,
      stayDates: `${fmt(v.checkIn)} – ${fmt(v.checkOut)}`, overallRating: overall, npsScore: nps,
      categoriesRating: { room: sub(), treatment: sub(), food: sub(), service: sub() },
      procedureFeedback: procs.map((id) => ({ procedureName: db.procedures.find((p) => p.id === id)!.name, rating: clamp(overall + rng.int(-1, 1), 1, 5), comment: rng.chance(0.3) ? 'Очень помогло, чувствуется эффект.' : undefined })),
      comment: overall >= 4 ? rng.pick(COMMENTS_GOOD) : overall === 3 ? rng.pick(COMMENTS_MID) : rng.pick(COMMENTS_BAD),
      createdAt: created, status: 'PUBLISHED',
    };
    const replyChance = overall <= 3 ? 0.6 : 0.4;
    if (rng.chance(replyChance) && Date.parse(created) < nowMs - 86400000) {
      review.managementResponse = {
        replyText: overall <= 3 ? REPLIES[2] : rng.pick(REPLIES.slice(0, 2)),
        repliedAt: iso(Date.parse(created) + rng.int(3, 40) * 3600000), replierName: 'Нестерович Дмитрий Олегович',
      };
    }
    db.guestReviews.push(review);
  }
  db.guestReviews.sort((a, b) => (a.createdAt < b.createdAt ? -1 : 1));
  db.guestReviews.forEach((r, i) => { r.id = i + 1; });
  db.seq.review = db.guestReviews.length;

  // ---------- пакеты ----------
  const pk = (id: number, name: string, description: string, cat: number, profile: number, diet: number, nights: number, procs: [string, number][], badge: string, discount: number, active = true) => {
    const included = procs.map(([n, sessions]) => {
      const p = db.procedures.find((x) => x.name.startsWith(n))!;
      return { procedureId: p.id, procedureName: p.name, sessions };
    });
    const base = r2(BASE_PRICE[cat] * nights * 1.0 + included.reduce((s, i) => s + i.sessions * 22, 0));
    db.packages.push({
      id, name, description, categoryId: cat, categoryName: CATEGORIES[cat - 1].name, profileId: profile, profileName: PROFILES[profile - 1].name,
      dietId: diet, dietName: DIETS[diet - 1].name, durationNights: nights, includedProcedures: included, basePrice: base,
      packagePrice: r2(base * (1 - discount / 100)), discountPercent: discount, isActive: active, badge,
    });
  };
  pk(1, 'Здоровое сердце', 'Программа для нормализации давления и укрепления сосудов: углекислые ванны, спелеотерапия, ЛФК под контролем кардиолога.', 2, 1, 4, 14,
    [['Сухая углекислая', 8], ['Спелеотерапия', 8], ['Электрофорез', 6], ['Лечебная физкультура', 10], ['ЭКГ', 2]], 'Хит сезона', 12);
  pk(2, 'Антистресс и Релакс', 'Восстановление нервной системы и сна: жемчужные ванны, релакс-массаж, электросон, фитотерапия.', 3, 4, 2, 10,
    [['Жемчужная ванна', 6], ['Релакс-массаж', 5], ['Электросон', 6], ['Фитотерапия', 10]], 'Для сна', 10);
  pk(3, 'Свободное дыхание', 'Комплексная реабилитация органов дыхания: галотерапия, ингаляции, дыхательная гимнастика.', 2, 3, 1, 12,
    [['Галотерапия', 8], ['Ингаляции ультразвуковые', 10], ['Дыхательная гимнастика', 10], ['Аромафитотерапия', 5]], 'Новинка', 8);
  pk(4, 'Лёгкие суставы и позвоночник', 'Грязелечение, подводный душ-массаж, магнитотерапия и лечебное плавание для суставов и спины.', 1, 2, 1, 14,
    [['Грязелечение', 8], ['Подводный душ', 6], ['Магнитотерапия', 8], ['Лечебное плавание', 8], ['Классический массаж', 6]], 'Выбор врачей', 15);
  pk(5, 'Новогодний релакс', 'Праздничные дни в санатории: оздоровительные процедуры, SPA и праздничный ужин.', 3, 5, 1, 7,
    [['Минеральная ванна', 4], ['Релакс-массаж', 3], ['Лечебное плавание', 4], ['Питьевое лечение', 7]], 'Праздник', 10);
  pk(6, 'Выходные у озера', 'Короткий отдых на 3 ночи: прогулки, бассейн, массаж.', 1, 5, 1, 3,
    [['Лечебное плавание', 2], ['Классический массаж', 2]], 'Выходные', 5, false);

  // ---------- склад ----------
  const inv: [string, string, string, number, string, number, number][] = [
    ['Одноразовые простыни 80×200', 'Бельё', 'шт', 1, 'Водолечебница (ванны и души)', 420, 150],
    ['Сапропелевая грязь (оз. Дикое), 20 кг', 'Лечебные средства', 'мешок', 2, 'Грязелечебница', 36, 20],
    ['Гель для УЗ-терапии 5 л', 'Расходные материалы', 'канистра', 13, 'Кабинет ультразвуковой и ударно-волновой терапии', 9, 6],
    ['Электроды для электрофореза', 'Расходные материалы', 'пара', 3, 'Кабинет физиотерапии', 260, 100],
    ['Прокладки гидрофильные', 'Расходные материалы', 'шт', 3, 'Кабинет физиотерапии', 70, 150],
    ['Соль для галокамеры (поваренная, 25 кг)', 'Лечебные средства', 'мешок', 6, 'Галокамера (соляная пещера)', 14, 8],
    ['Ингаляционный раствор физиологический 0,9%', 'Лекарственные', 'флакон', 5, 'Ингалятор', 120, 60],
    ['Масло массажное (ромашка), 1 л', 'Расходные материалы', 'бутылка', 7, 'Массажный кабинет', 5, 8],
    ['Парафин медицинский, 10 кг', 'Лечебные средства', 'упаковка', 2, 'Грязелечебница', 12, 6],
    ['Эфирное масло хвои, 100 мл', 'Лечебные средства', 'флакон', 5, 'Ингалятор', 18, 10],
    ['Электроды ЭКГ одноразовые', 'Расходные материалы', 'упаковка', 10, 'Кабинет функциональной диагностики', 22, 10],
    ['Тонометр-манжета', 'Оборудование', 'шт', 10, 'Кабинет функциональной диагностики', 6, 3],
    ['Травяной сбор «Успокоительный»', 'Фитосборы', 'пачка', 12, 'Питьевой бювет и фитобар', 48, 40],
    ['Перчатки смотровые (M)', 'Расходные материалы', 'упаковка', 1, 'Водолечебница (ванны и души)', 34, 30],
    ['Антисептик кожный, 1 л', 'Лекарственные', 'бутылка', 3, 'Кабинет физиотерапии', 4, 12],
    ['Бахилы', 'Расходные материалы', 'упаковка', 8, 'Зал лечебной физкультуры', 90, 60],
    ['Хлор для бассейна (таблетки), кг', 'Химия', 'кг', 9, 'Бассейн с минеральной водой', 28, 25],
    ['Лимфодренажные манжеты (комплект)', 'Оборудование', 'комплект', 14, 'Кабинет лимфодренажа', 3, 2],
  ];
  db.inventory = inv.map(([name, category, unit, cab, cabName, qty, min], i): ConsumableItem => ({
    id: i + 1, sku: `SKU-${String(1000 + i * 7)}`, name, category, cabinetId: cab, cabinetName: cabName, unit, stockQuantity: qty, minThreshold: min,
    status: qty <= min * 0.5 ? 'CRITICAL' : qty <= min ? 'LOW_STOCK' : 'IN_STOCK', lastRestockedAt: iso(nowMs - rng.int(2, 40) * 86400000),
  }));
  db.seq.inventory = inv.length;

  // ---------- персонал ----------
  const slotsToday = new Map<number, number>();
  for (const s of db.slots) if (s.date === today) slotsToday.set(s.cabinetId, (slotsToday.get(s.cabinetId) ?? 0) + 1);
  const staffDefs: [string, string, number, string, 'ON_SHIFT' | 'VACATION' | 'SICK_LEAVE'][] = [
    ['Смирнова Елена Викторовна', 'Врач-кардиолог', 10, '08:00–16:00', 'ON_SHIFT'],
    ['Климович Андрей Павлович', 'Врач-физиотерапевт', 3, '08:00–16:00', 'ON_SHIFT'],
    ['Гринкевич Ольга Станиславовна', 'Врач-невролог', 11, '09:00–17:00', 'ON_SHIFT'],
    ['Лукашевич Инна Анатольевна', 'Медсестра по физиотерапии', 3, '08:00–16:00', 'ON_SHIFT'],
    ['Савицкая Галина Петровна', 'Медсестра водолечебницы', 1, '08:00–16:00', 'ON_SHIFT'],
    ['Романюк Наталья Юрьевна', 'Медсестра водолечебницы', 1, '12:00–20:00', 'VACATION'],
    ['Борисенко Валентина Ивановна', 'Медсестра грязелечебницы', 2, '08:00–16:00', 'ON_SHIFT'],
    ['Позняк Светлана Александровна', 'Инструктор по лечебной физкультуре', 8, '08:00–16:00', 'ON_SHIFT'],
    ['Дубовик Сергей Николаевич', 'Массажист', 7, '08:00–16:00', 'ON_SHIFT'],
    ['Козловский Павел Игоревич', 'Массажист', 7, '12:00–20:00', 'ON_SHIFT'],
    ['Янкович Марина Васильевна', 'Медсестра ингалятория', 5, '08:00–16:00', 'ON_SHIFT'],
    ['Адамович Екатерина Олеговна', 'Оператор галокамеры', 6, '09:00–17:00', 'ON_SHIFT'],
    ['Тимошенко Алексей Викторович', 'Инструктор бассейна', 9, '07:00–15:00', 'ON_SHIFT'],
    ['Гайдук Людмила Сергеевна', 'Врач функциональной диагностики', 10, '08:00–16:00', 'SICK_LEAVE'],
    ['Мацкевич Дарья Андреевна', 'Медсестра физиотерапии (магнито-, лазеротерапия)', 4, '08:00–16:00', 'ON_SHIFT'],
    ['Шабунько Игорь Леонидович', 'Врач-психотерапевт', 11, '10:00–18:00', 'ON_SHIFT'],
    ['Карпович Оксана Дмитриевна', 'Фитотерапевт', 12, '08:00–16:00', 'ON_SHIFT'],
    ['Захаренко Тамара Ивановна', 'Медсестра лимфодренажа', 14, '09:00–17:00', 'ON_SHIFT'],
  ];
  const perCab = new Map<number, number>();
  for (const s of staffDefs) perCab.set(s[2], (perCab.get(s[2]) ?? 0) + 1);
  db.staff = staffDefs.map(([fullName, role, cab, shift, status], i): StaffMember => {
    const cabinet = db.cabinets.find((c) => c.id === cab)!;
    const share = perCab.get(cab) ?? 1;
    const max = Math.max(6, Math.round(cabinet.slotsPerDay / share));
    const assigned = status === 'ON_SHIFT' ? Math.min(max, Math.round((slotsToday.get(cab) ?? 0) / share)) : 0;
    return {
      id: i + 1, fullName, role, cabinetName: cabinet.name, shiftHours: shift, status, assignedSlotsToday: assigned, maxSlotsPerDay: max,
      utilizationPercent: Math.round((assigned / max) * 100), rating: r2(4.3 + rng.next() * 0.7),
    };
  });
  db.seq.staff = staffDefs.length;

  // ---------- лист ожидания ----------
  const mkWl = (clientId: number, cat: number, from: string, to: string, places: number, status: WaitlistRec['status'], ago: number) => {
    db.waitlist.push({ id: seq('waitlist'), clientId, categoryId: cat, dateFrom: from, dateTo: to, places, status, createdAt: iso(nowMs - ago * 3600000) });
  };
  mkWl(12, 3, nyFrom, nyTo, 2, 'OPEN', 70);
  mkWl(27, 5, nyFrom, nyTo, 4, 'OPEN', 52);
  mkWl(35, 3, addDays(nyFrom, 1), addDays(nyTo, 2), 2, 'OPEN', 30);
  mkWl(2, 3, nyFrom, nyTo, 2, 'OPEN', 20);
  mkWl(58, 5, nyFrom, addDays(nyTo, 3), 3, 'OPEN', 9);
  mkWl(71, 2, addDays(today, 20), addDays(today, 34), 2, 'NOTIFIED', 120);
  mkWl(90, 1, addDays(today, 12), addDays(today, 22), 1, 'CLOSED', 300);

  // ---------- уведомления ----------
  const notify = (userId: number, type: AppNotification['type'], title: string, message: string, link: string | undefined, hoursAgo: number, read: boolean) => {
    const n: NotificationRec = { id: String(seq('notification')), userId, type, title, message, link, createdAt: iso(nowMs - hoursAgo * 3600000), read };
    db.notifications.push(n);
  };
  for (const u of db.users.filter((x) => x.clientId && x.clientId <= 8)) {
    const myV = all.filter((v) => v.clientId === u.clientId && ACTIVE_STATUSES.includes(v.status)).sort((a, b) => (a.checkIn < b.checkIn ? 1 : -1));
    for (const v of myV.slice(0, 3)) {
      if (v.status === 'AWAITING_PAYMENT') notify(u.id, 'PAYMENT', 'Ожидается оплата путёвки', `Путёвка №${v.id}: внесите предоплату до ${v.paymentDeadline?.slice(0, 10)}, иначе бронь будет снята.`, '/my', 3, false);
      else if (v.status === 'CONFIRMED') notify(u.id, 'PAYMENT', 'Оплата получена', `Путёвка №${v.id} подтверждена. Заезд ${v.checkIn}. Ждём вас!`, '/my', 40, true);
      else if (v.status === 'CHECKED_IN') notify(u.id, 'MEDICAL', 'Расписание процедур обновлено', 'Врач назначил лечение. Посмотрите расписание на ближайшие дни на посту медсестры или в разделе «Профиль».', '/profile', 5, false);
    }
    notify(u.id, 'LOYALTY', 'Бонусы начислены', 'За прошлую путёвку начислены бонусные баллы. Используйте их при следующем бронировании.', '/profile', 200, true);
    notify(u.id, 'INFO', 'Добро пожаловать!', 'Рады видеть вас в личном кабинете санатория «Беловежские дали».', undefined, 700, true);
  }
  const waiting = db.waitlist.filter((w) => w.status === 'NOTIFIED');
  for (const w of waiting) {
    const u = db.users.find((x) => x.clientId === w.clientId);
    if (u) notify(u.id, 'WAITLIST', 'Освободились места', `По вашей заявке освободились места в категории «${CATEGORIES[w.categoryId - 1].name}». Успейте забронировать.`, '/search', 20, false);
  }
  const pendingAwait = all.filter((v) => v.status === 'AWAITING_PAYMENT');
  notify(3, 'PAYMENT', 'Неоплаченные путёвки', `Ожидают оплаты: ${pendingAwait.length}. Срок оплаты — 24 часа с момента оформления.`, '/admin-bookings', 2, false);
  notify(3, 'WAITLIST', 'Лист ожидания', `Открытых заявок в листе ожидания: ${db.waitlist.filter((w) => w.status === 'OPEN').length}.`, '/admin-bookings', 12, false);
  notify(3, 'INFO', 'Сегодняшние заезды', `Сегодня ожидается заезд: ${all.filter((v) => v.status === 'CONFIRMED' && v.checkIn === today).length} путёвок.`, '/admin-bookings', 6, true);
  notify(4, 'MEDICAL', 'Новые заезды', 'Сегодня заселились новые гости — требуется первичный осмотр и назначение лечения.', '/doctor', 4, false);
  notify(4, 'MEDICAL', 'Противопоказания', 'В назначениях пациентов есть процедуры с противопоказаниями — проверьте подтверждения.', '/doctor', 30, true);
  notify(5, 'MEDICAL', 'Расписание на сегодня готово', 'Расписание процедур на сегодня сформировано.', '/doctor', 8, false);
  notify(2, 'INFO', 'Рекомендации по ценам', `Ожидают решения: ${db.priceReviews.filter((r) => r.status === 'PENDING_REVIEW').length} рекомендаций цен вне коридора.`, '/pricing', 3, false);
  notify(2, 'INFO', 'Склад', 'Несколько расходных материалов ниже порога остатка — проверьте раздел «Склад».', '/manager', 20, false);
  notify(2, 'LOYALTY', 'Новые отзывы', 'Гости оставили новые отзывы — часть требует ответа руководства.', '/manager', 50, true);
  notify(1, 'INFO', 'Резервное копирование', 'Ежедневное резервное копирование базы данных выполнено успешно.', undefined, 10, true);
  notify(1, 'INFO', 'Новый пользователь', 'Создана учётная запись сотрудника.', '/admin', 90, true);
  db.notifications.sort((a, b) => (a.createdAt < b.createdAt ? -1 : 1));

  // ---------- журнал аудита ----------
  const auditPaths: [string, string][] = [
    ['POST', '/api/vouchers'], ['POST', '/api/vouchers/{id}/pay'], ['POST', '/api/vouchers/{id}/cancel'], ['POST', '/api/vouchers/{id}/check-in'],
    ['POST', '/api/vouchers/{id}/check-out'], ['POST', '/api/clients'], ['PUT', '/api/clients/{id}'], ['POST', '/api/assignments'],
    ['POST', '/api/assignments/{id}/schedule'], ['POST', '/api/schedule/{id}/done'], ['PUT', '/api/ehr/{id}'], ['POST', '/api/ehr/notes'],
    ['POST', '/api/waitlist'], ['PUT', '/api/me'], ['POST', '/api/notifications'], ['PUT', '/api/interactive-rooms/{id}/status'],
  ];
  const actors = db.users.filter((u) => u.id <= 12);
  const rows: AuditRow[] = [];
  for (let i = 0; i < 160; i++) {
    const u = rng.pick(actors);
    const [m, p] = rng.pick(auditPaths.filter((x) => {
      if (u.roles.includes('CLIENT')) return ['/api/vouchers', '/api/vouchers/{id}/pay', '/api/vouchers/{id}/cancel', '/api/waitlist', '/api/me'].includes(x[1]);
      if (u.roles.includes('DOCTOR')) return x[1].includes('assignments') || x[1].includes('schedule') || x[1].includes('ehr');
      if (u.roles.includes('BOOKING_ADMIN')) return x[1].includes('vouchers') || x[1].includes('clients') || x[1].includes('waitlist') || x[1].includes('rooms');
      return x[1].includes('notifications') || x[1].includes('rooms');
    }));
    const path = p.replace('{id}', String(rng.int(1, all.length)));
    rows.push({
      id: 0, createdAt: iso(nowMs - rng.int(1, 30 * 24 * 60) * 60000), userId: u.id, username: u.username, action: m, entity: path.slice(0, 50),
      details: `status=${rng.weighted([200, 201, 409, 403, 400], [60, 22, 8, 4, 6])}`,
    });
  }
  for (let i = 0; i < 25; i++) {
    const u = rng.pick(db.users.filter((x) => x.id <= 13));
    rows.push({ id: 0, createdAt: iso(nowMs - rng.int(1, 14 * 24 * 60) * 60000), userId: u.id, username: u.username, action: 'POST', entity: '/api/auth/login', details: `status=${rng.chance(0.9) ? 200 : 401}` });
  }
  rows.sort((a, b) => (a.createdAt < b.createdAt ? -1 : 1));
  rows.forEach((r, i) => { r.id = i + 1; });
  db.audit = rows;
  db.seq.audit = rows.length;

  return db;
}

setBuilder(buildDb);
