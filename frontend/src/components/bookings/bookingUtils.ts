import type { ClientView, VoucherView } from '../../types';

/** Количество ночей между датами заезда и выезда. */
export function calculateNights(start: string | null, end: string | null): number {
  if (!start || !end) return 0;
  const diff = new Date(end).getTime() - new Date(start).getTime();
  return Math.max(0, Math.round(diff / (1000 * 3600 * 24)));
}

/** Сколько дней осталось до заезда (null — дата не указана). */
export function calculateDaysLeft(checkIn: string | null): number | null {
  if (!checkIn) return null;
  const diff = new Date(checkIn).getTime() - new Date().getTime();
  return Math.ceil(diff / (1000 * 3600 * 24));
}

/** Путёвка оплачена полностью. */
export function isFullyPaid(v: VoucherView): boolean {
  return (v.paid ?? 0) >= (v.totalPrice ?? 0) && (v.totalPrice ?? 0) > 0;
}

/** Остаток к оплате. */
export function amountDue(v: VoucherView): number {
  return Math.max(0, (v.totalPrice ?? 0) - (v.paid ?? 0));
}

export function fullName(c: ClientView | undefined, fallbackId: number): string {
  return c ? `${c.lastName} ${c.firstName} ${c.middleName ?? ''}`.trim() : `Клиент #${fallbackId}`;
}

/** Период проживания для таблиц. */
export function period(from: string | null, to: string | null): string {
  if (!from && !to) return '—';
  return `${from ?? '—'} — ${to ?? '—'}`;
}
