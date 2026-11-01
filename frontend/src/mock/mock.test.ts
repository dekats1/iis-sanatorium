import { beforeAll, describe, expect, it } from 'vitest';
import type { Role } from '../types';
import { decodeJwt } from '../utils/jwt';
import { getDb } from './db';
import { handleRequest, resetDb, setMockDelay } from './index';
import { addDays, localToday } from './util';

type Json = any; // eslint-disable-line @typescript-eslint/no-explicit-any

async function call(method: string, path: string, token?: string, body?: unknown): Promise<{ status: number; json: Json }> {
  const headers: Record<string, string> = {};
  if (token) headers.authorization = `Bearer ${token}`;
  const res = await handleRequest(method, path, headers, body === undefined ? undefined : JSON.stringify(body));
  const text = await res.text();
  return { status: res.status, json: text ? JSON.parse(text) : undefined };
}
async function login(username: string): Promise<string> {
  const r = await call('POST', '/api/auth/login', undefined, { username, password: 'demo12345' });
  expect(r.status).toBe(200);
  return r.json.token as string;
}
const keys = (o: object) => Object.keys(o).sort();

describe('демо-бэкенд', () => {
  const tokens: Record<string, string> = {};
  beforeAll(async () => {
    setMockDelay(false);
    resetDb();
    for (const u of ['client', 'admin', 'doctor', 'manager', 'sysadmin']) tokens[u] = await login(u);
  });

  it('вход: токен разбирается jwt.ts, роли соответствуют пользователю', async () => {
    const expected: Record<string, Role> = { client: 'CLIENT', admin: 'BOOKING_ADMIN', doctor: 'DOCTOR', manager: 'MANAGER', sysadmin: 'SYSADMIN' };
    for (const [name, role] of Object.entries(expected)) {
      const payload = decodeJwt(tokens[name]);
      expect(payload?.roles).toEqual([role]);
      expect(payload!.exp * 1000).toBeGreaterThan(Date.now());
    }
    const r = await call('POST', '/api/auth/login', undefined, { username: 'client', password: 'wrong-pass' });
    expect(r.status).toBe(401);
    expect(r.json.detail).toBe('Неверный логин или пароль');
  });

  it('права: 401 без токена и 403 по роли', async () => {
    expect((await call('GET', '/api/me')).status).toBe(401);
    expect((await call('GET', '/api/reports/kpi?from=2026-01-01&to=2026-02-01', tokens.client)).status).toBe(403);
    expect((await call('GET', '/api/vouchers', tokens.client)).status).toBe(403);
    expect((await call('POST', '/api/directory/cabinets', tokens.admin, { name: 'X', slotsPerDay: 5 })).status).toBe(403);
    expect((await call('GET', '/api/users', tokens.manager)).status).toBe(403);
    expect((await call('POST', '/api/assignments', tokens.admin, {})).status).toBe(403);
    expect((await call('GET', '/pricing/price/reviews', tokens.doctor)).status).toBe(403);
    expect((await call('GET', '/api/users', tokens.sysadmin)).status).toBe(200);
  });

  it('справочники и формы ответов совпадают с типами', async () => {
    const t = tokens.admin;
    expect(keys((await call('GET', '/api/directory/room-categories', t)).json[0])).toEqual(['capacityTotal', 'description', 'id', 'name']);
    expect(keys((await call('GET', '/api/directory/rooms', t)).json[0])).toEqual(['categoryId', 'floor', 'id', 'roomNumber']);
    expect(keys((await call('GET', '/api/directory/procedures', t)).json[0])).toEqual(['cabinetId', 'durationMin', 'id', 'name']);
    expect(keys((await call('GET', '/api/directory/sales-channels', t)).json[0])).toEqual(['commissionPct', 'id', 'name', 'quotaPlaces']);
    expect(keys((await call('GET', '/api/directory/customers', t)).json[0])).toEqual(['contractNo', 'id', 'name', 'type']);
    expect((await call('GET', '/api/directory/rooms', t)).json).toHaveLength(90);
    expect((await call('GET', '/api/directory/procedures', t)).json.length).toBeGreaterThanOrEqual(35);
    const v = (await call('GET', '/api/vouchers/my', tokens.client)).json[0];
    expect(keys(v)).toEqual(['categoryId', 'checkIn', 'checkOut', 'clientId', 'currency', 'id', 'paid', 'paymentDeadline', 'places', 'pricePerPlaceDay', 'roomNumber', 'status', 'totalPrice']);
    const client = (await call('GET', '/api/clients?q=Иванова&size=50', t)).json[0];
    expect(keys(client)).toEqual(expect.arrayContaining(['birthDate', 'firstName', 'id', 'lastName']));
    const kpi = (await call('GET', `/api/reports/kpi?from=${addDays(localToday(), -30)}&to=${localToday()}`, tokens.manager)).json;
    expect(keys(kpi)).toEqual(['adr', 'availablePlaceDays', 'from', 'occPct', 'revpar', 'soldPlaceDays', 'to']);
    expect(kpi.occPct).toBeGreaterThan(10);
    const bi = (await call('GET', '/api/reports/bi-monthly', tokens.manager)).json;
    expect(bi.length).toBe(18);
    expect(keys(bi[0])).toEqual(['month', 'occupancyPct', 'revenue', 'targetRevenue', 'vouchersCount']);
    const rev = (await call('GET', '/pricing/price/reviews', tokens.manager)).json[0];
    expect(keys(rev)).toEqual(['category_id', 'created_at', 'decided_at', 'decided_by', 'id', 'p_max', 'p_min', 'price_applied', 'price_recommended', 'quote_id', 'status', 'stay_date']);
    const loy = (await call('GET', '/api/loyalty/account', tokens.client)).json;
    expect(keys(loy)).toEqual(['balance', 'cashbackPercent', 'clientId', 'discountPercent', 'nextTierThreshold', 'privileges', 'spentMoneyTotal', 'tier', 'tierName', 'totalEarned', 'totalSpent']);
    const stats = (await call('GET', '/api/reviews/stats', tokens.manager)).json;
    expect(Object.keys(stats.ratingsDistribution).sort()).toEqual(['1', '2', '3', '4', '5']);
    expect((await call('GET', '/api/audit?page=0&size=50', tokens.sysadmin)).json).toHaveLength(50);
  });

  it('доступность: цены посчитаны по тарифам', async () => {
    const from = addDays(localToday(), 30);
    const to = addDays(localToday(), 40);
    const r = await call('GET', `/api/availability?from=${from}&to=${to}&places=2`, tokens.client);
    expect(r.status).toBe(200);
    expect(r.json.length).toBeGreaterThan(2);
    for (const c of r.json) {
      expect(c.priceAvailable).toBe(true);
      expect(c.pricePerPlaceDay).toBeGreaterThan(50);
      expect(c.totalPerPlace).toBeCloseTo(c.pricePerPlaceDay * 10, 0);
    }
    expect((await call('GET', '/api/availability?from=2020-01-01&to=2020-01-05&places=1', tokens.client)).json.detail).toBe('Дата заезда не может быть в прошлом');
  });

  it('полный цикл путёвки: создать, оплатить, заезд, лечение, выезд', async () => {
    const today = localToday();
    const created = await call('POST', '/api/clients', tokens.admin, { lastName: 'Тестов', firstName: 'Тест', birthDate: '1970-05-05', phone: '+375 29 000-00-00' });
    expect(created.status).toBe(201);
    const clientId = created.json.id as number;
    const avail = (await call('GET', `/api/availability?from=${today}&to=${addDays(today, 8)}&places=1`, tokens.admin)).json;
    const cat = avail[0];
    const before = cat.freePlaces;
    const v = await call('POST', '/api/vouchers', tokens.admin, { clientId, categoryId: cat.categoryId, checkIn: today, checkOut: addDays(today, 8), places: 1, profileId: 1, channelId: 2 });
    expect(v.status).toBe(201);
    expect(v.json.status).toBe('AWAITING_PAYMENT');
    expect(v.json.totalPrice).toBeCloseTo(v.json.pricePerPlaceDay * 8, 1);
    const after = (await call('GET', `/api/availability?from=${today}&to=${addDays(today, 8)}&places=1`, tokens.admin)).json.find((c: Json) => c.categoryId === cat.categoryId);
    expect(after.freePlaces).toBe(before - 1);
    // заезд до оплаты невозможен
    expect((await call('POST', `/api/vouchers/${v.json.id}/check-in`, tokens.admin)).status).toBe(409);
    const pay = await call('POST', `/api/vouchers/${v.json.id}/pay`, tokens.admin);
    expect(pay.status).toBe(200);
    expect(keys(pay.json)).toEqual(['amount', 'currency', 'invoiceId', 'payUrl', 'paymentId']);
    expect(pay.json.amount).toBeCloseTo(v.json.totalPrice * 0.3, 1);
    expect((await call('GET', `/api/vouchers/${v.json.id}`, tokens.admin)).json.status).toBe('CONFIRMED');
    // назначение до заезда запрещено
    expect((await call('POST', '/api/assignments', tokens.doctor, { voucherId: v.json.id, items: [{ procedureId: 1, sessions: 3 }], confirmContraindications: false })).status).toBe(409);
    expect((await call('POST', `/api/vouchers/${v.json.id}/check-in`, tokens.admin)).json.status).toBe('CHECKED_IN');
    // профиль 1 (кардио): грязелечение (id 8) в профиль не входит
    const bad = await call('POST', '/api/assignments', tokens.doctor, { voucherId: v.json.id, items: [{ procedureId: 8, sessions: 3 }], confirmContraindications: false });
    expect(bad.status).toBe(409);
    expect(bad.json.detail).toContain('не входят в лечебный профиль');
    // противопоказание: онкология в анамнезе и магнитотерапия
    await call('POST', `/api/clients/${clientId}/conditions`, tokens.doctor, { conditionId: 12 });
    const body = { voucherId: v.json.id, items: [{ procedureId: 15, sessions: 4 }, { procedureId: 1, sessions: 3 }] };
    const warn = await call('POST', '/api/assignments', tokens.doctor, { ...body, confirmContraindications: false });
    expect(warn.status).toBe(409);
    expect(warn.json.warnings.length).toBeGreaterThan(0);
    expect(keys(warn.json.warnings[0])).toEqual(['condition', 'conditionId', 'procedure', 'procedureId']);
    const ok = await call('POST', '/api/assignments', tokens.doctor, { ...body, confirmContraindications: true });
    expect(ok.status).toBe(201);
    const plan = await call('POST', `/api/assignments/${ok.json.id}/schedule`, tokens.doctor);
    expect(plan.status).toBe(201);
    expect(plan.json).toHaveLength(7);
    expect(keys(plan.json[0])).toEqual(['assignmentId', 'cabinet', 'clientName', 'done', 'id', 'procedure', 'procedureId', 'slot', 'voucherId']);
    expect((await call('POST', `/api/assignments/${ok.json.id}/schedule`, tokens.doctor)).status).toBe(409);
    const day = (await call('GET', `/api/schedule?date=${today}`, tokens.doctor)).json;
    expect(day.some((s: Json) => s.voucherId === v.json.id)).toBe(true);
    const slot = plan.json[0].id as number;
    expect((await call('POST', `/api/schedule/${slot}/done`, tokens.doctor)).status).toBe(204);
    expect((await call('POST', `/api/schedule/${slot}/done`, tokens.doctor)).status).toBe(409);
    const out = await call('POST', `/api/vouchers/${v.json.id}/check-out`, tokens.admin);
    expect(out.json.status).toBe('COMPLETED');
    // действия попали в журнал аудита
    const audit = (await call('GET', '/api/audit?page=0&size=50', tokens.sysadmin)).json;
    expect(audit.some((a: Json) => a.entity === `/api/vouchers/${v.json.id}/check-out`)).toBe(true);
  });

  it('отмена: удержание зависит от числа суток до заезда', async () => {
    const today = localToday();
    const mk = async (daysAhead: number) => {
      const cl = (await call('POST', '/api/clients', tokens.admin, { lastName: `Отмена${daysAhead}`, firstName: 'Тест', birthDate: '1980-01-01' })).json.id;
      const from = addDays(today, daysAhead);
      const cat = (await call('GET', `/api/availability?from=${from}&to=${addDays(from, 5)}&places=1`, tokens.admin)).json[0];
      const v = await call('POST', '/api/vouchers', tokens.admin, { clientId: cl, categoryId: cat.categoryId, checkIn: from, checkOut: addDays(from, 5), places: 1, profileId: 2, channelId: 1 });
      expect(v.status).toBe(201);
      await call('POST', `/api/vouchers/${v.json.id}/pay`, tokens.admin);
      return call('POST', `/api/vouchers/${v.json.id}/cancel`, tokens.admin);
    };
    const early = await mk(20);
    expect(early.json.retainPercent).toBe(0);
    expect(early.json.refund).toBeCloseTo(early.json.voucher.paid, 2);
    expect(early.json.voucher.status).toBe('CANCELLED');
    expect((await mk(9)).json.retainPercent).toBe(25);
    expect((await mk(4)).json.retainPercent).toBe(50);
    const veryLate = await mk(1);
    expect(veryLate.json.retainPercent).toBe(100);
    expect(veryLate.json.refund).toBe(0);
    expect(keys(veryLate.json)).toEqual(['refund', 'retainPercent', 'retained', 'voucher']);
    // повторная отмена невозможна
    expect((await call('POST', `/api/vouchers/${veryLate.json.voucher.id}/cancel`, tokens.admin)).status).toBe(409);
  });

  it('клиент не видит чужие путёвки; лист ожидания не нужен при наличии мест', async () => {
    const all = (await call('GET', '/api/vouchers', tokens.admin)).json as Json[];
    const mine = (await call('GET', '/api/vouchers/my', tokens.client)).json as Json[];
    const foreign = all.find((v) => !mine.some((m) => m.id === v.id))!;
    expect((await call('GET', `/api/vouchers/${foreign.id}`, tokens.client)).status).toBe(404);
    const from = addDays(localToday(), 50);
    const r = await call('POST', '/api/waitlist', tokens.client, { categoryId: 1, dateFrom: from, dateTo: addDays(from, 7), places: 1 });
    expect(r.status).toBe(409);
  });

  it('прогноз: запуск строит 90 точек с интервалом, мало истории даёт 422', async () => {
    const run = await call('POST', '/pricing/forecast/1/run', tokens.manager);
    expect(run.status).toBe(201);
    expect(run.json.points).toBe(90);
    const pts = (await call('GET', `/pricing/forecast/1?date_from=${localToday()}&date_to=${addDays(localToday(), 90)}`, tokens.manager)).json;
    expect(pts).toHaveLength(90);
    for (const p of pts) {
      expect(p.predicted_occ).toBeGreaterThanOrEqual(0);
      expect(p.predicted_occ).toBeLessThanOrEqual(100);
      expect(p.lower_95).toBeLessThanOrEqual(p.predicted_occ);
      expect(p.upper_95).toBeGreaterThanOrEqual(p.predicted_occ);
    }
    getDb().history[99] = [];
    expect((await call('POST', '/pricing/forecast/99/run', tokens.manager)).status).toBe(422);
  });

  it('рекомендации цен: решение меняет статус, повторное даёт 409', async () => {
    const pending = (await call('GET', '/pricing/price/reviews?status_filter=PENDING_REVIEW', tokens.manager)).json as Json[];
    expect(pending.length).toBeGreaterThan(3);
    const ok = await call('POST', `/pricing/price/reviews/${pending[0].id}/decide`, tokens.manager, { action: 'ACKNOWLEDGE' });
    expect(ok.json.status).toBe('ACKNOWLEDGED');
    expect((await call('POST', `/pricing/price/reviews/${pending[0].id}/decide`, tokens.manager, { action: 'ACKNOWLEDGE' })).status).toBe(409);
  });

  it('справочники: запись, чтение, защита от удаления используемых записей', async () => {
    const my = (await call('GET', '/api/notifications', tokens.admin)).json as Json[];
    expect(my.length).toBeGreaterThan(2);
    const created = await call('POST', '/api/directory/cabinets', tokens.sysadmin, { name: 'Тестовый кабинет', slotsPerDay: 10 });
    expect(created.status).toBe(201);
    expect((await call('GET', '/api/directory/cabinets', tokens.sysadmin)).json.some((c: Json) => c.id === created.json.id)).toBe(true);
    expect((await call('DELETE', `/api/directory/cabinets/${created.json.id}`, tokens.sysadmin)).status).toBe(204);
    expect((await call('DELETE', '/api/directory/cabinets/1', tokens.sysadmin)).status).toBe(409);
  });
});
