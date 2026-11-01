import { del, get, post, put } from './client';
import type {
  BiMonthlyPoint,
  ConsumableItem,
  ProfilePopularity,
  SanatoriumPackage,
  StaffMember,
  StaffStatus,
} from '../types';

// ==========================================
// 1. BI Reports Service (Java Backend: /api/reports)
// ==========================================
export const biApi = {
  monthlyStats: async (): Promise<BiMonthlyPoint[]> => {
    return get<BiMonthlyPoint[]>('/api/reports/bi-monthly');
  },

  profilePopularity: async (): Promise<ProfilePopularity[]> => {
    return get<ProfilePopularity[]>('/api/reports/profiles');
  },

  exportCsv: async (monthly?: BiMonthlyPoint[], profiles?: ProfilePopularity[]): Promise<string> => {
    const mData = monthly || (await biApi.monthlyStats());
    const pData = profiles || (await biApi.profilePopularity());
    const rows = [
      ['Месяц', 'Факт выручки (BYN)', 'План выручки (BYN)', 'Загрузка (%)', 'Оформлено путевок'],
      ...mData.map((m) => [m.month, m.revenue, m.targetRevenue, m.occupancyPct, m.vouchersCount]),
      [''],
      ['Профиль', 'Количество путевок', 'Доля (%)', 'Выручка (BYN)'],
      ...pData.map((p) => [p.profileName, p.vouchersCount, p.sharePercent, p.revenue]),
    ];
    const csvContent = '\uFEFF' + rows.map((e) => e.join(';')).join('\n');
    if (typeof document !== 'undefined') {
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.setAttribute('href', url);
      link.setAttribute('download', `BI_Report_Sanatorium_${new Date().toISOString().slice(0, 10)}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    }
    return csvContent;
  },
};

// ==========================================
// 2. Package Builder Service (Java Backend: /api/packages)
// ==========================================
export const packagesApi = {
  list: async (_activeOnly = false): Promise<SanatoriumPackage[]> => {
    return get<SanatoriumPackage[]>('/api/packages');
  },

  create: async (pkg: Omit<SanatoriumPackage, 'id'>): Promise<SanatoriumPackage> => {
    return post<SanatoriumPackage>('/api/packages', pkg);
  },

  toggleActive: async (id: number): Promise<boolean> => {
    const res = await put<SanatoriumPackage>(`/api/packages/${id}/toggle`, {});
    return res.isActive;
  },

  remove: async (id: number): Promise<void> => {
    return del<void>(`/api/packages/${id}`);
  },
};

// ==========================================
// 3. Consumables & Inventory Service (Java Backend: /api/inventory)
// ==========================================
export const inventoryApi = {
  list: async (): Promise<ConsumableItem[]> => {
    return get<ConsumableItem[]>('/api/inventory');
  },

  restock: async (id: number, amount: number): Promise<ConsumableItem> => {
    return post<ConsumableItem>(`/api/inventory/${id}/restock`, { amount });
  },

  writeOff: async (id: number, amount: number): Promise<ConsumableItem> => {
    return post<ConsumableItem>(`/api/inventory/${id}/write-off`, { amount });
  },

  add: async (item: Omit<ConsumableItem, 'id' | 'status' | 'lastRestockedAt'>): Promise<ConsumableItem> => {
    return post<ConsumableItem>('/api/inventory', item);
  },
};

// ==========================================
// 4. Staff & Shift Management Service (Java Backend: /api/staff)
// ==========================================
export const staffApi = {
  list: async (): Promise<StaffMember[]> => {
    return get<StaffMember[]>('/api/staff');
  },

  updateStatus: async (id: number, status: StaffStatus): Promise<StaffMember> => {
    return put<StaffMember>(`/api/staff/${id}/status`, { status });
  },

  add: async (member: Omit<StaffMember, 'id' | 'utilizationPercent'>): Promise<StaffMember> => {
    return post<StaffMember>('/api/staff', member);
  },
};
