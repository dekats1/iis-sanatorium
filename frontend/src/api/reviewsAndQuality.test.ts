import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { reviewsApi } from './reviewsAndQuality';

function respond(status: number, body?: unknown): Response {
  return new Response(body === undefined ? null : JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('Reviews API client (Java Spring Boot Integration)', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    fetchMock.mockReset();
    vi.unstubAllGlobals();
  });

  it('fetches reviews list with query params', async () => {
    const mockList = [
      { id: 1, overallRating: 5, comment: 'Отлично' },
      { id: 2, overallRating: 4, comment: 'Хорошо' },
    ];
    fetchMock.mockResolvedValue(respond(200, mockList));

    const result = await reviewsApi.list({ needAttention: true, minRating: 3 });
    expect(fetchMock).toHaveBeenCalled();
    const [path] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(path).toContain('/api/reviews?');
    expect(path).toContain('filter=ATTENTION');
    expect(path).toContain('minRating=3');
    expect(result).toEqual(mockList);
  });

  it('fetches quality stats from /api/reviews/stats', async () => {
    const mockStats = {
      averageOverall: 4.8,
      npsIndex: 75,
      totalReviews: 20,
      promotersCount: 16,
      passivesCount: 3,
      detractorsCount: 1,
      categoryAverages: { room: 4.7, treatment: 4.9, food: 4.6, service: 4.8 },
      ratingsDistribution: { 5: 15, 4: 4, 3: 1, 2: 0, 1: 0 },
      topRatedProcedures: [{ name: 'Массаж', avgRating: 5.0, reviewCount: 10 }],
    };
    fetchMock.mockResolvedValue(respond(200, mockStats));

    const stats = await reviewsApi.stats();
    const [path] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(path).toBe('/api/reviews/stats');
    expect(stats.npsIndex).toBe(75);
    expect(stats.totalReviews).toBe(20);
  });

  it('checks voucher review status via /api/reviews/check-voucher/{id}', async () => {
    fetchMock.mockResolvedValue(respond(200, true));

    const has = await reviewsApi.hasReviewForVoucher(888);
    const [path] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(path).toBe('/api/reviews/check-voucher/888');
    expect(has).toBe(true);
  });

  it('posts new review to /api/reviews', async () => {
    const newReview = { id: 10, overallRating: 5, comment: 'Супер' };
    fetchMock.mockResolvedValue(respond(201, newReview));

    const payload = {
      voucherId: 101,
      clientId: 1,
      clientName: 'Иванов Иван',
      categoryName: 'Люкс',
      stayDates: '2026-10-01 — 2026-10-14',
      overallRating: 5,
      npsScore: 10,
      categoriesRating: { room: 5, treatment: 5, food: 5, service: 5 },
      comment: 'Великолепно',
    };

    const created = await reviewsApi.create(payload);
    const [path, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(path).toBe('/api/reviews');
    expect(init.method).toBe('POST');
    expect(init.body).toContain('"overallRating":5');
    expect(created.id).toBe(10);
  });

  it('posts management reply to /api/reviews/{id}/reply', async () => {
    const updatedReview = {
      id: 5,
      managementResponse: {
        replyText: 'Спасибо!',
        replierName: 'Главврач',
      },
    };
    fetchMock.mockResolvedValue(respond(200, updatedReview));

    const res = await reviewsApi.reply(5, 'Спасибо!', 'Главврач');
    const [path, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(path).toBe('/api/reviews/5/reply');
    expect(init.method).toBe('POST');
    expect(init.body).toContain('"replyText":"Спасибо!"');
    expect(res.managementResponse?.replierName).toBe('Главврач');
  });
});
