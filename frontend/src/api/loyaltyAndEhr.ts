import { get, post, put } from './client';
import type { BonusTransaction, DoctorNote, EhrRecord, LoyaltyAccount } from '../types';

export const loyaltyApi = {
  account: async (clientId?: number): Promise<LoyaltyAccount> => {
    const url = clientId ? `/api/loyalty/account/${clientId}` : '/api/loyalty/account';
    return get<LoyaltyAccount>(url);
  },

  transactions: async (clientId?: number): Promise<BonusTransaction[]> => {
    const url = clientId ? `/api/loyalty/transactions/${clientId}` : '/api/loyalty/transactions';
    return get<BonusTransaction[]>(url);
  },

  addBonus: async (clientId: number, amount: number, description: string): Promise<LoyaltyAccount> => {
    return post<LoyaltyAccount>('/api/loyalty/add-bonus', { clientId, amount, description });
  },

  applyBonuses: async (clientId: number, voucherId: number, bonusPoints: number): Promise<{ success: boolean; applied: number }> => {
    return post<{ success: boolean; applied: number }>('/api/loyalty/apply', { clientId, voucherId, bonusPoints });
  },
};

export const ehrApi = {
  get: async (clientId?: number): Promise<EhrRecord> => {
    const url = clientId ? `/api/ehr/${clientId}` : '/api/ehr/my';
    return get<EhrRecord>(url);
  },

  update: async (clientId: number, update: Partial<EhrRecord>): Promise<EhrRecord> => {
    return put<EhrRecord>(`/api/ehr/${clientId}`, update);
  },

  notes: async (clientId: number): Promise<DoctorNote[]> => {
    return get<DoctorNote[]>(`/api/ehr/${clientId}/notes`);
  },

  addNote: async (note: Omit<DoctorNote, 'id' | 'createdAt'>): Promise<DoctorNote> => {
    return post<DoctorNote>('/api/ehr/notes', note);
  },
};
