import { del, get, post, put } from './client';
import type { AppNotification, RefundCalculation, RefundRequest } from '../types';

// ==========================================
// 1. Notifications API (Java Spring Boot Backend)
// ==========================================
export const notificationsApi = {
  list: async (): Promise<AppNotification[]> => {
    return get<AppNotification[]>('/api/notifications');
  },

  markAsRead: async (id: string | number): Promise<void> => {
    await put<AppNotification>(`/api/notifications/${id}/read`, {});
    if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
      window.dispatchEvent(new Event('sanatorium_notifications_changed'));
    }
  },

  markAllAsRead: async (): Promise<void> => {
    await put<void>('/api/notifications/read-all', {});
    if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
      window.dispatchEvent(new Event('sanatorium_notifications_changed'));
    }
  },

  add: async (
    notification: Omit<AppNotification, 'id' | 'createdAt' | 'read'>
  ): Promise<AppNotification> => {
    const created = await post<AppNotification>('/api/notifications', notification);
    if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
      window.dispatchEvent(new Event('sanatorium_notifications_changed'));
    }
    return created;
  },

  remove: async (id: string | number): Promise<void> => {
    await del<void>(`/api/notifications/${id}`);
    if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
      window.dispatchEvent(new Event('sanatorium_notifications_changed'));
    }
  },
};

// ==========================================
// 2. Refunds Policy & Registration (ФТ-11)
// ==========================================
export const refundsApi = {
  calculate: (
    checkInDate: string,
    totalPrice: number,
    paidAmount: number,
    voucherId: number
  ): RefundCalculation => {
    const now = new Date();
    const checkIn = new Date(checkInDate);
    const diffMs = checkIn.getTime() - now.getTime();
    const daysBefore = Math.max(0, Math.ceil(diffMs / (1000 * 3600 * 24)));

    let retainPercent = 100;
    let policyDescription = 'Отмена менее чем за 3 суток — удержание 100% стоимости по правилам санатория.';

    if (daysBefore >= 14) {
      retainPercent = 0;
      policyDescription = 'Заблаговременная отмена (более 14 дней до заезда) — возврат 100% без удержаний.';
    } else if (daysBefore >= 7) {
      retainPercent = 25;
      policyDescription = 'Отмена за 7–13 дней до заезда — стандартное удержание 25% стоимости брони.';
    } else if (daysBefore >= 3) {
      retainPercent = 50;
      policyDescription = 'Поздняя отмена за 3–6 дней до заезда — удержание 50% стоимости брони.';
    }

    const byRule = (totalPrice * retainPercent) / 100;
    const retainedAmount = Math.min(byRule, paidAmount);
    const refundAmount = Math.max(0, paidAmount - retainedAmount);

    return {
      voucherId,
      totalPrice,
      paidAmount,
      daysBeforeCheckIn: daysBefore,
      retainPercent,
      retainedAmount,
      refundAmount,
      policyDescription,
    };
  },

  processRefund: async (request: RefundRequest): Promise<{ success: boolean; message: string }> => {
    await notificationsApi.add({
      type: 'PAYMENT',
      title: 'Возврат средств оформлен',
      message: `Заявление на отмену путёвки #${request.voucherId} принято. Причина: «${request.reason}». Денежные средства поступят на карту в течение 1–3 банковских дней.`,
      link: '/my',
    });

    return {
      success: true,
      message: `Заявление на возврат по путёвке #${request.voucherId} успешно зарегистрировано.`,
    };
  },
};
