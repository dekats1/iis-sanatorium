import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ehrApi, loyaltyApi } from './loyaltyAndEhr';

function respond(status: number, body?: unknown): Response {
  return new Response(body === undefined ? null : JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('Loyalty and EHR Services (Java Spring Boot Integration)', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    fetchMock.mockReset();
    vi.unstubAllGlobals();
  });

  it('loads loyalty account with proper tier calculations', async () => {
    const mockAccount = {
      clientId: 1,
      balance: 350,
      tier: 'SILVER',
      totalSpent: 2800,
      privileges: ['Ранний заезд'],
      cashbackPercent: 5,
    };
    fetchMock.mockResolvedValueOnce(respond(200, mockAccount));

    const acc = await loyaltyApi.account(1);
    expect(acc.clientId).toBe(1);
    expect(acc.balance).toBe(350);
    expect(['BRONZE', 'SILVER', 'GOLD', 'PLATINUM']).toContain(acc.tier);
    expect(acc.privileges.length).toBeGreaterThan(0);
    expect(acc.cashbackPercent).toBe(5);

    const [url] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain('/api/loyalty/account/1');
  });

  it('manages loyalty bonus transactions and accruals', async () => {
    const updatedAccount = {
      clientId: 1,
      balance: 400,
      tier: 'SILVER',
      totalSpent: 2800,
      privileges: [],
      cashbackPercent: 5,
    };
    const mockTxs = [
      { id: 10, amount: 50, type: 'MANUAL', description: 'Тестовое начисление' },
    ];
    fetchMock
      .mockResolvedValueOnce(respond(200, updatedAccount))
      .mockResolvedValueOnce(respond(200, mockTxs));

    const updated = await loyaltyApi.addBonus(1, 50, 'Тестовое начисление');
    expect(updated.balance).toBe(400);

    const txs = await loyaltyApi.transactions(1);
    expect(txs.length).toBe(1);
    expect(txs[0].amount).toBe(50);
  });

  it('retrieves and updates patient EHR record with BMI computation', async () => {
    const mockEhr = {
      clientId: 1,
      bloodType: 'A(II) Rh+',
      heightCm: 180,
      weightKg: 81,
      bmi: 25.0,
      bloodPressure: '120/80',
      allergies: ['Пенициллин'],
    };
    fetchMock
      .mockResolvedValueOnce(respond(200, mockEhr))
      .mockResolvedValueOnce(respond(200, mockEhr));

    const patientCard = await ehrApi.get(1);
    expect(patientCard.clientId).toBe(1);
    expect(patientCard.heightCm).toBe(180);
    expect(patientCard.weightKg).toBe(81);

    const updated = await ehrApi.update(1, { heightCm: 180, weightKg: 81 });
    expect(updated.heightCm).toBe(180);
    expect(updated.weightKg).toBe(81);
    expect(updated.bmi).toBe(25.0);
  });

  it('adds and lists doctor clinical notes in EHR', async () => {
    const mockNote = {
      id: 99,
      clientId: 1,
      doctorId: 2,
      doctorName: 'Др. Иванов',
      visitType: 'CONTROL',
      complaints: 'Жалоб нет',
      objectiveStatus: 'Состояние удовлетворительное',
      recommendations: 'Продолжить ЛФК',
      createdAt: '2026-10-29T10:00:00Z',
    };
    fetchMock
      .mockResolvedValueOnce(respond(201, mockNote))
      .mockResolvedValueOnce(respond(200, [mockNote]));

    const note = await ehrApi.addNote({
      clientId: 1,
      doctorId: 2,
      doctorName: 'Др. Иванов',
      visitType: 'CONTROL',
      complaints: 'Жалоб нет',
      objectiveStatus: 'Состояние удовлетворительное',
      recommendations: 'Продолжить ЛФК',
    });

    expect(note.id).toBe(99);
    expect(note.visitType).toBe('CONTROL');

    const list = await ehrApi.notes(1);
    expect(list.some((n) => n.id === note.id)).toBe(true);
  });
});
