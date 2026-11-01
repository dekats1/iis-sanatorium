// Побочные эффекты операций: уведомления, начисление бонусов.
import type { AppNotification } from '../types';
import { nextId, type Db, type NotificationRec, type VoucherRec } from './db';
import { tierOf } from './engine';
import { r2 } from './util';

export function notify(db: Db, userId: number, type: AppNotification['type'], title: string, message: string, link?: string): NotificationRec {
  const n: NotificationRec = { id: String(nextId('notification')), userId, type, title, message, link, createdAt: new Date().toISOString(), read: false };
  db.notifications.push(n);
  return n;
}

export function notifyClient(db: Db, clientId: number, type: AppNotification['type'], title: string, message: string, link?: string): void {
  const u = db.users.find((x) => x.clientId === clientId);
  if (u) notify(db, u.id, type, title, message, link);
}

export function notifyRole(db: Db, role: 'BOOKING_ADMIN' | 'DOCTOR' | 'MANAGER' | 'SYSADMIN', type: AppNotification['type'], title: string, message: string, link?: string): void {
  for (const u of db.users) if (u.active && u.roles.includes(role)) notify(db, u.id, type, title, message, link);
}

/** Кэшбэк за завершённую путёвку по ставке уровня лояльности. */
export function accrueBonus(db: Db, v: VoucherRec): void {
  const acc = db.loyalty[v.clientId] ?? (db.loyalty[v.clientId] = { balance: 100, spentMoney: 0 });
  const t = tierOf(acc.spentMoney);
  const pts = Math.round((v.totalPrice * t.cashback) / 100);
  acc.balance += pts;
  acc.spentMoney = r2(acc.spentMoney + v.totalPrice);
  db.bonusTx.push({ id: nextId('bonus'), clientId: v.clientId, amount: pts, type: 'ACCRUAL', description: `Кэшбэк ${t.cashback}% за путёвку №${v.id}`, createdAt: new Date().toISOString(), voucherId: v.id });
}
