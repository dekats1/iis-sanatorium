import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { biApi, inventoryApi, packagesApi, staffApi } from './biAndOperations';

function respond(status: number, body?: unknown): Response {
  return new Response(body === undefined ? null : JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('BI & Operations Services (Java Spring Boot Integration)', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    fetchMock.mockReset();
    vi.unstubAllGlobals();
  });

  it('loads BI monthly statistics and profile popularity from backend', async () => {
    const mockMonthly = [
      { month: 'Янв 26', revenue: 41800, targetRevenue: 40000, occupancyPct: 63.1, vouchersCount: 37 },
    ];
    const mockProfiles = [
      { profileId: 1, profileName: 'Кардио', vouchersCount: 50, sharePercent: 40.0, revenue: 60000 },
    ];

    fetchMock
      .mockResolvedValueOnce(respond(200, mockMonthly))
      .mockResolvedValueOnce(respond(200, mockProfiles));

    const monthly = await biApi.monthlyStats();
    expect(monthly.length).toBe(1);
    expect(monthly[0].month).toBe('Янв 26');
    expect(monthly[0].revenue).toBe(41800);

    const profiles = await biApi.profilePopularity();
    expect(profiles.length).toBe(1);
    expect(profiles[0].profileName).toBe('Кардио');
    expect(profiles[0].sharePercent).toBe(40.0);

    const csv = await biApi.exportCsv(monthly, profiles);
    expect(csv).toContain('Месяц;Факт выручки (BYN);План выручки (BYN);Загрузка (%)');
    expect(csv).toContain('Профиль;Количество путевок;Доля (%)');
  });

  it('manages sanatorium packages lifecycle (create, toggle active)', async () => {
    const mockPackages = [
      { id: 1, name: 'Кардио', active: true, isActive: true },
    ];
    const mockCreated = {
      id: 2,
      name: 'Тестовый кардио-комплекс',
      active: true,
      isActive: true,
    };
    const mockToggled = {
      id: 2,
      name: 'Тестовый кардио-комплекс',
      active: false,
      isActive: false,
    };

    fetchMock
      .mockResolvedValueOnce(respond(200, mockPackages))
      .mockResolvedValueOnce(respond(201, mockCreated))
      .mockResolvedValueOnce(respond(200, mockToggled));

    const initialList = await packagesApi.list();
    expect(initialList.length).toBe(1);

    const created = await packagesApi.create({
      name: 'Тестовый кардио-комплекс',
      description: 'Тестовое описание',
      categoryId: 1,
      categoryName: 'Стандарт',
      profileId: 2,
      profileName: 'Кардио',
      durationNights: 14,
      basePrice: 1500,
      packagePrice: 1275,
      discountPercent: 15,
      badge: 'Скидка 15%',
      includedProcedures: [],
      isActive: true,
    });
    expect(created.id).toBe(2);
    expect(created.name).toBe('Тестовый кардио-комплекс');

    const activeState = await packagesApi.toggleActive(created.id);
    expect(activeState).toBe(false);
  });

  it('manages consumables inventory (restock, write-off, add)', async () => {
    const mockItem = {
      id: 10,
      sku: 'TEST-SKU-01',
      name: 'Тестовые перчатки',
      category: 'Медицинские расходники',
      stockQuantity: 100,
      minThreshold: 20,
      unit: 'уп.',
    };
    const mockRestocked = { ...mockItem, stockQuantity: 150 };
    const mockWrittenOff = { ...mockItem, stockQuantity: 80 };

    fetchMock
      .mockResolvedValueOnce(respond(201, mockItem))
      .mockResolvedValueOnce(respond(200, mockRestocked))
      .mockResolvedValueOnce(respond(200, mockWrittenOff));

    const newItem = await inventoryApi.add({
      sku: 'TEST-SKU-01',
      name: 'Тестовые перчатки',
      category: 'Медицинские расходники',
      cabinetId: 1,
      cabinetName: 'Кабинет №1',
      stockQuantity: 100,
      minThreshold: 20,
      unit: 'уп.',
    });
    expect(newItem.stockQuantity).toBe(100);

    const restocked = await inventoryApi.restock(newItem.id, 50);
    expect(restocked.stockQuantity).toBe(150);

    const writtenOff = await inventoryApi.writeOff(newItem.id, 70);
    expect(writtenOff.stockQuantity).toBe(80);
  });

  it('manages staff members and status updates', async () => {
    const mockStaff = [
      { id: 1, fullName: 'Др. Смирнова', role: 'Кардиолог', status: 'ON_SHIFT' },
    ];
    const mockCreated = {
      id: 2,
      fullName: 'Ковалёв Пётр Сергеевич',
      role: 'Массажист',
      status: 'ON_SHIFT',
    };
    const mockUpdated = {
      ...mockCreated,
      status: 'VACATION',
    };

    fetchMock
      .mockResolvedValueOnce(respond(200, mockStaff))
      .mockResolvedValueOnce(respond(201, mockCreated))
      .mockResolvedValueOnce(respond(200, mockUpdated));

    const staff = await staffApi.list();
    expect(staff.length).toBe(1);

    const created = await staffApi.add({
      fullName: 'Ковалёв Пётр Сергеевич',
      role: 'Массажист',
      cabinetName: 'Водогрязелечебница',
      shiftHours: '08:00 - 16:30',
      status: 'ON_SHIFT',
      assignedSlotsToday: 6,
      maxSlotsPerDay: 10,
      rating: 4.8,
    });
    expect(created.id).toBe(2);
    expect(created.status).toBe('ON_SHIFT');

    const updated = await staffApi.updateStatus(created.id, 'VACATION');
    expect(updated.status).toBe('VACATION');
  });
});
