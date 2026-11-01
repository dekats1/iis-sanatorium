// Вспомогательные функции демо-бэкенда: ГПСЧ, даты, округление.

/** Детерминированный генератор (mulberry32). */
export function makeRng(seed: number) {
  let a = seed >>> 0;
  const next = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    next,
    int: (min: number, max: number) => Math.floor(next() * (max - min + 1)) + min,
    pick: <T,>(arr: readonly T[]): T => arr[Math.floor(next() * arr.length)],
    chance: (p: number) => next() < p,
    /** Взвешенный выбор: weights соответствуют items. */
    weighted: <T,>(items: readonly T[], weights: readonly number[]): T => {
      const total = weights.reduce((s, w) => s + w, 0);
      let r = next() * total;
      for (let i = 0; i < items.length; i++) {
        r -= weights[i];
        if (r <= 0) return items[i];
      }
      return items[items.length - 1];
    },
    /** Приблизительно нормальное распределение. */
    gauss: () => (next() + next() + next() + next() - 2) * 1.7,
  };
}
export type Rng = ReturnType<typeof makeRng>;

const DAY_MS = 86400000;

/** Номер суток от эпохи для даты ГГГГ-ММ-ДД (UTC, без часовых поясов). */
export function dn(date: string): number {
  const [y, m, d] = date.split('-').map(Number);
  return Math.round(Date.UTC(y, m - 1, d) / DAY_MS);
}
export function ds(n: number): string {
  return new Date(n * DAY_MS).toISOString().slice(0, 10);
}
export function addDays(date: string, n: number): string {
  return ds(dn(date) + n);
}
export function daysBetween(a: string, b: string): number {
  return dn(b) - dn(a);
}
/** Локальная сегодняшняя дата в формате ГГГГ-ММ-ДД (как ui.today()). */
export function localToday(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
export function monthOf(date: string): string {
  return date.slice(0, 7);
}
export function dayOfYear(date: string): number {
  return dn(date) - dn(`${date.slice(0, 4)}-01-01`);
}
/** Метка времени в часовом поясе Минска (+03:00). */
export function minskIso(date: string, minutes: number): string {
  const h = String(Math.floor(minutes / 60)).padStart(2, '0');
  const m = String(minutes % 60).padStart(2, '0');
  return `${date}T${h}:${m}:00+03:00`;
}
export function nowIso(): string {
  return new Date().toISOString();
}
export function isoAt(date: string, hour: number, minute = 0): string {
  return `${date}T${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:00.000Z`;
}
export const r2 = (x: number) => Math.round(x * 100) / 100;
export const clamp = (x: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, x));
export const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
