import { describe, expect, it } from 'vitest';
import { formatDateTime, money, statusName, today } from './ui';

describe('UI utilities', () => {
  it('formats money properly in BYN', () => {
    expect(money(null)).toBe('—');
    expect(money(undefined)).toBe('—');
    expect(money(120)).toContain('120');
    expect(money(120)).toContain('BYN');
    expect(money(1234.5)).toContain('1');
    expect(money(1234.5)).toContain('234');
  });

  it('translates statuses to Russian correctly', () => {
    expect(statusName('CONFIRMED')).toBe('Подтверждена');
    expect(statusName('CHECKED_IN')).toBe('Заселён');
    expect(statusName('AWAITING_PAYMENT')).toBe('Ожидает оплаты');
    expect(statusName('COMPLETED')).toBe('Завершена');
    expect(statusName('CANCELLED')).toBe('Отменена');
    expect(statusName('UNKNOWN_XYZ')).toBe('UNKNOWN_XYZ');
  });

  it('formats dates and offsets', () => {
    const t0 = today(0);
    expect(t0).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    const t5 = today(5);
    expect(t5).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(formatDateTime(null)).toBe('—');
    expect(formatDateTime('2026-10-28T12:00:00Z')).toBeTruthy();
  });
});
