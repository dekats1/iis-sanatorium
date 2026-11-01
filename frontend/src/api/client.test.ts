import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError, get, post, query, setToken, setUnauthorizedHandler } from './client';

function respond(status: number, body?: unknown): Response {
  return new Response(body === undefined ? null : JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('api client', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock);
    setToken(null);
    setUnauthorizedHandler(() => undefined);
  });

  afterEach(() => {
    fetchMock.mockReset();
    vi.unstubAllGlobals();
  });

  it('добавляет токен и тело JSON', async () => {
    setToken('abc');
    fetchMock.mockResolvedValue(respond(200, { ok: true }));
    await post('/api/x', { a: 1 });
    const [path, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(path).toBe('/api/x');
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer abc');
    expect(init.body).toBe('{"a":1}');
  });

  it('204 даёт undefined', async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 204 }));
    await expect(get('/api/x')).resolves.toBeUndefined();
  });

  it('берёт сообщение из problem+json и предупреждения о противопоказаниях', async () => {
    const warnings = [{ procedureId: 1, procedure: 'Ванна', conditionId: 2, condition: 'Гипертония' }];
    fetchMock.mockResolvedValue(respond(409, { detail: 'Есть противопоказания', warnings }));
    const err = await get('/api/x').catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect((err as ApiError).status).toBe(409);
    expect((err as ApiError).message).toBe('Есть противопоказания');
    expect((err as ApiError).warnings).toEqual(warnings);
  });

  it('при пустом теле ошибки подставляет сообщение по коду', async () => {
    fetchMock.mockResolvedValue(new Response('не json', { status: 403 }));
    const err = (await get('/api/x').catch((e: unknown) => e)) as ApiError;
    expect(err.message).toBe('Недостаточно прав для этого действия');
  });

  it('401 при наличии токена вызывает выход, без токена (неверный пароль) — нет', async () => {
    const handler = vi.fn();
    setUnauthorizedHandler(handler);
    fetchMock.mockResolvedValue(respond(401, { detail: 'Неверный логин или пароль' }));
    await get('/api/x').catch(() => undefined);
    expect(handler).not.toHaveBeenCalled();
    setToken('abc');
    await get('/api/x').catch(() => undefined);
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('сетевой сбой превращается в понятную ошибку', async () => {
    fetchMock.mockRejectedValue(new TypeError('failed'));
    const err = (await get('/api/x').catch((e: unknown) => e)) as ApiError;
    expect(err.status).toBe(0);
    expect(err.message).toBe('Нет связи с сервером');
  });
});

describe('query', () => {
  it('пропускает пустые значения и кодирует остальные', () => {
    expect(query({ a: 1, b: '', c: undefined, d: 'x y' })).toBe('?a=1&d=x+y');
    expect(query({})).toBe('');
  });
});
