import { get, post, query } from './client';
import type {
  CreateReviewRequest,
  GuestReview,
  ReviewQualityStats,
} from '../types';

export const reviewsApi = {
  list: async (filters?: {
    filter?: string;
    status?: string;
    voucherId?: number;
    clientId?: number;
    minRating?: number;
    maxRating?: number;
    needAttention?: boolean;
  }): Promise<GuestReview[]> => {
    const filterParam = filters?.needAttention ? 'ATTENTION' : filters?.filter;
    const q = query({
      filter: filterParam,
      voucherId: filters?.voucherId,
      clientId: filters?.clientId,
      minRating: filters?.minRating,
      maxRating: filters?.maxRating,
    });
    return get<GuestReview[]>(`/api/reviews${q}`);
  },

  get: async (id: number): Promise<GuestReview | null> => {
    const all = await get<GuestReview[]>('/api/reviews');
    return all.find((r) => r.id === id) || null;
  },

  hasReviewForVoucher: async (voucherId: number): Promise<boolean> => {
    return get<boolean>(`/api/reviews/check-voucher/${voucherId}`);
  },

  stats: async (): Promise<ReviewQualityStats> => {
    return get<ReviewQualityStats>('/api/reviews/stats');
  },

  create: async (req: CreateReviewRequest): Promise<GuestReview> => {
    return post<GuestReview>('/api/reviews', req);
  },

  reply: async (reviewId: number, replyText: string, replierName: string): Promise<GuestReview> => {
    return post<GuestReview>(`/api/reviews/${reviewId}/reply`, { replyText, replierName });
  },
};
