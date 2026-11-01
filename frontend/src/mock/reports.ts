// Отчёты менеджера: KPI (Occ, ADR, RevPAR), выручка по каналам, помесячная аналитика, популярность профилей.
import type { BiMonthlyPoint, ChannelRevenue, KpiView, ProfilePopularity } from '../types';
import type { Db } from './db';
import { PAID_STATUSES, badRequest, noise, occModel, priceInfo } from './engine';
import { daysBetween, dn, ds, localToday, r2 } from './util';

const MONTHS = ['Янв', 'Фев', 'Мар', 'Апр', 'Май', 'Июн', 'Июл', 'Авг', 'Сен', 'Окт', 'Ноя', 'Дек'];
const isDate = (s: unknown): s is string => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s);

interface Day { sold: number; revenue: number }

export function buildReports(db: Db) {
  const totalCap = db.rooms.reduce((s, r) => s + (db.categories.find((c) => c.id === r.categoryId)?.capacityTotal ?? 0), 0);
  const real = new Map<number, Day>();
  for (const v of db.vouchers) {
    if (!PAID_STATUSES.includes(v.status)) continue;
    for (let d = dn(v.checkIn); d < dn(v.checkOut); d++) {
      const e = real.get(d) ?? { sold: 0, revenue: 0 };
      e.sold += v.places;
      e.revenue += v.places * v.pricePerPlaceDay;
      real.set(d, e);
    }
  }
  const archiveIndex = new Map<string, Map<string, number>>();
  for (const [cat, pts] of Object.entries(db.history)) archiveIndex.set(cat, new Map(pts.map((p) => [p.stay_date, p.sold])));

  const day = (date: string): Day => {
    if (date >= db.windowStart) return real.get(dn(date)) ?? { sold: 0, revenue: 0 };
    let sold = 0;
    let revenue = 0;
    for (const c of db.categories) {
      const s = archiveIndex.get(String(c.id))?.get(date) ?? 0;
      sold += s;
      revenue += s * priceInfo(db, c.id, date).applied;
    }
    return { sold, revenue };
  };

  return {
    kpi(from: string | null, to: string | null): KpiView {
      if (!isDate(from) || !isDate(to)) throw badRequest('Параметры from и to обязательны (ГГГГ-ММ-ДД)');
      if (to <= from) throw badRequest('Конец периода должен быть позже начала');
      let sold = 0;
      let revenue = 0;
      const n = daysBetween(from, to);
      for (let d = dn(from); d < dn(to); d++) {
        const e = day(ds(d));
        sold += e.sold;
        revenue += e.revenue;
      }
      const avail = n * totalCap;
      return {
        from, to, availablePlaceDays: avail, soldPlaceDays: sold,
        occPct: avail ? r2((100 * sold) / avail) : 0, adr: sold ? r2(revenue / sold) : 0, revpar: avail ? r2(revenue / avail) : 0,
      };
    },

    channels(): ChannelRevenue[] {
      const acc = new Map<number, { n: number; rev: number }>();
      for (const v of db.vouchers) {
        if (!PAID_STATUSES.includes(v.status)) continue;
        const e = acc.get(v.channelId) ?? { n: 0, rev: 0 };
        e.n++;
        e.rev += v.totalPrice;
        acc.set(v.channelId, e);
      }
      return db.channels.filter((c) => acc.has(c.id)).map((c) => {
        const e = acc.get(c.id)!;
        return { channel: c.name, vouchers: e.n, revenue: r2(e.rev), commission: r2((e.rev * c.commissionPct) / 100) };
      }).sort((a, b) => b.revenue - a.revenue);
    },

    monthly(): BiMonthlyPoint[] {
      const today = localToday();
      const y = Number(today.slice(0, 4));
      const m = Number(today.slice(5, 7));
      const out: BiMonthlyPoint[] = [];
      for (let k = 17; k >= 0; k--) {
        const idx = y * 12 + (m - 1) - k;
        const yy = Math.floor(idx / 12);
        const mm = (idx % 12) + 1;
        const first = `${yy}-${String(mm).padStart(2, '0')}-01`;
        const nextFirst = mm === 12 ? `${yy + 1}-01-01` : `${yy}-${String(mm + 1).padStart(2, '0')}-01`;
        const last = nextFirst; // текущий месяц — с учётом уже оформленных броней
        let sold = 0;
        let revenue = 0;
        let target = 0;
        let days = 0;
        for (let d = dn(first); d < dn(last); d++) {
          const date = ds(d);
          const e = day(date);
          sold += e.sold;
          revenue += e.revenue;
          const avgPrice = db.categories.reduce((s, c) => s + c.capacityTotal * db.rooms.filter((r) => r.categoryId === c.id).length * priceInfo(db, c.id, date).applied, 0) / totalCap;
          target += totalCap * Math.min(0.95, occModel(date) * (1.03 + 0.03 * noise(`t|${first}`))) * avgPrice;
          days++;
        }
        const vouchersCount = first >= db.windowStart
          ? db.vouchers.filter((v) => PAID_STATUSES.includes(v.status) && v.checkIn >= first && v.checkIn < nextFirst).length
          : Math.round(sold / (14 * 1.7));
        out.push({
          month: `${MONTHS[mm - 1]} ${yy}`, revenue: Math.round(revenue), targetRevenue: Math.round(target),
          occupancyPct: days ? r2((100 * sold) / (days * totalCap)) : 0, vouchersCount,
        });
      }
      return out;
    },

    profiles(): ProfilePopularity[] {
      const acc = new Map<number, { n: number; rev: number }>();
      let total = 0;
      for (const v of db.vouchers) {
        if (!PAID_STATUSES.includes(v.status)) continue;
        const e = acc.get(v.profileId) ?? { n: 0, rev: 0 };
        e.n++;
        e.rev += v.totalPrice;
        acc.set(v.profileId, e);
        total++;
      }
      return db.profiles.filter((p) => acc.has(p.id)).map((p) => {
        const e = acc.get(p.id)!;
        return { profileId: p.id, profileName: p.name, vouchersCount: e.n, sharePercent: total ? r2((100 * e.n) / total) : 0, revenue: r2(e.rev) };
      }).sort((a, b) => b.vouchersCount - a.vouchersCount);
    },
  };
}
