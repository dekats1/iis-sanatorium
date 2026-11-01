import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { notificationsApi, refundsApi } from './notificationsAndRefunds';

function respond(status: number, body?: unknown): Response {
  if (status === 204) {
    return new Response(null, { status: 204 });
  }
  return new Response(body === undefined ? null : JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('Notifications and Refunds Services (Java Spring Boot Integration)', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    fetchMock.mockReset();
    vi.unstubAllGlobals();
  });

  it('manages notifications lifecycle and marking as read via backend', async () => {
    const mockList = [
      { id: '1', type: 'INFO', title: 'Вход', message: 'Добро пожаловать', read: false },
    ];
    const mockCreated = {
      id: '2',
      type: 'PAYMENT',
      title: 'Тестовый счёт',
      message: 'Тестовое уведомление',
      read: false,
    };
    const mockRead = { ...mockCreated, read: true };

    fetchMock
      .mockResolvedValueOnce(respond(200, mockList))
      .mockResolvedValueOnce(respond(201, mockCreated))
      .mockResolvedValueOnce(respond(200, mockRead))
      .mockResolvedValueOnce(respond(200, [mockRead]))
      .mockResolvedValueOnce(respond(204, null))
      .mockResolvedValueOnce(respond(200, [mockRead]));

    const list = await notificationsApi.list();
    expect(list).toBeInstanceOf(Array);
    expect(list.length).toBe(1);

    const created = await notificationsApi.add({
      type: 'PAYMENT',
      title: 'Тестовый счёт',
      message: 'Тестовое уведомление',
    });
    expect(created.id).toBe('2');
    expect(created.read).toBe(false);

    await notificationsApi.markAsRead(created.id);
    const updatedList = await notificationsApi.list();
    const found = updatedList.find((n) => n.id === created.id);
    expect(found?.read).toBe(true);

    await notificationsApi.markAllAsRead();
    const allReadList = await notificationsApi.list();
    expect(allReadList.every((n) => n.read)).toBe(true);
  });

  it('correctly calculates refunds with >14 days (0% retention, 100% refund)', () => {
    const d = new Date();
    d.setDate(d.getDate() + 20);
    const dateStr = d.toISOString().slice(0, 10);

    const calc = refundsApi.calculate(dateStr, 1000, 1000, 1);
    expect(calc.retainPercent).toBe(0);
    expect(calc.retainedAmount).toBe(0);
    expect(calc.refundAmount).toBe(1000);
  });

  it('correctly calculates refunds with 7-13 days (25% retention, 75% refund)', () => {
    const d = new Date();
    d.setDate(d.getDate() + 10);
    const dateStr = d.toISOString().slice(0, 10);

    const calc = refundsApi.calculate(dateStr, 1000, 1000, 1);
    expect(calc.retainPercent).toBe(25);
    expect(calc.retainedAmount).toBe(250);
    expect(calc.refundAmount).toBe(750);
  });

  it('correctly calculates refunds with 3-6 days (50% retention, 50% refund)', () => {
    const d = new Date();
    d.setDate(d.getDate() + 4);
    const dateStr = d.toISOString().slice(0, 10);

    const calc = refundsApi.calculate(dateStr, 1000, 1000, 1);
    expect(calc.retainPercent).toBe(50);
    expect(calc.retainedAmount).toBe(500);
    expect(calc.refundAmount).toBe(500);
  });

  it('correctly calculates refunds with <3 days (100% retention, 0% refund)', () => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    const dateStr = d.toISOString().slice(0, 10);

    const calc = refundsApi.calculate(dateStr, 1000, 1000, 1);
    expect(calc.retainPercent).toBe(100);
    expect(calc.retainedAmount).toBe(1000);
    expect(calc.refundAmount).toBe(0);
  });
});
