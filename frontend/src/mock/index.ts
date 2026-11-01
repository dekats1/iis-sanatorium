// Демо-режим: встроенный в браузер бэкенд. Перехватывает window.fetch для /api/* и /pricing/* и отвечает
// так же, как core-service и pricing-forecast. Состояние хранится в памяти и в localStorage.
import { CATEGORY_MEDIA } from '../api/interactiveMapAndRecommendations';
import { decodeJwt, isExpired } from '../utils/jwt';
import { dropStored, getDb, loadOrCreate, persist, persistNow, resetDb, type UserRec } from './db';
import { ApiFail, setCategoryPhotos } from './engine';
import { Reply, checkAccess, matchRoute, sweepExpired } from './routes';
import './seed';
import { sleep } from './util';

export { resetDb };
let installed = false;
let delayEnabled = true;

/** Отвечает на запрос так же, как настоящий шлюз; вынесено отдельно для тестов. */
export async function handleRequest(method: string, url: string, headers: Record<string, string>, rawBody: string | undefined): Promise<Response> {
  if (delayEnabled) await sleep(80 + Math.random() * 170);
  const parsed = new URL(url, 'http://demo.local');
  const path = parsed.pathname.replace(/\/{2,}/g, '/');
  try {
    const db = getDb();
    sweepExpired(db);
    // пользователь из токена (подпись не проверяется — как и в браузерном jwt.ts, проверка у шлюза)
    let user: UserRec | null = null;
    const auth = headers.authorization ?? headers.Authorization;
    if (auth?.startsWith('Bearer ')) {
      const payload = decodeJwt(auth.slice(7));
      if (!payload || isExpired(payload)) throw new ApiFail(401, 'Требуется вход в систему');
      user = db.users.find((u) => u.id === Number(payload.sub) && u.active) ?? null;
      if (!user) throw new ApiFail(401, 'Требуется вход в систему');
    }
    const { route, params, pathMatched } = matchRoute(method, path);
    if (!route) throw new ApiFail(pathMatched ? 405 : 404, pathMatched ? 'Метод не поддерживается' : 'Ресурс не найден');
    let body: unknown;
    if (rawBody) {
      try { body = JSON.parse(rawBody); } catch { throw new ApiFail(400, 'Некорректный JSON в теле запроса'); }
    }
    let status = 200;
    let result: unknown;
    try {
      checkAccess(route, user);
      result = route.handler({ db, method, path, params, query: parsed.searchParams, body, user });
      if (result instanceof Reply) {
        status = result.status;
        result = result.body;
      }
    } catch (e) {
      auditRequest(method, path, user, e instanceof ApiFail ? e.status : 500);
      throw e;
    }
    auditRequest(method, path, user, status);
    if (method !== 'GET') persistNow(); else persist();
    if (status === 204 || result === undefined) return new Response(null, { status: status === 200 ? 204 : status });
    return new Response(JSON.stringify(result), { status, headers: { 'Content-Type': 'application/json' } });
  } catch (e) {
    if (e instanceof ApiFail) {
      return new Response(JSON.stringify({ type: 'about:blank', title: e.message, status: e.status, detail: e.message, ...(e.warnings ? { warnings: e.warnings } : {}) }), {
        status: e.status, headers: { 'Content-Type': 'application/problem+json' },
      });
    }
    console.error('[demo-backend]', e);
    return new Response(JSON.stringify({ type: 'about:blank', title: 'Внутренняя ошибка', status: 500, detail: 'Внутренняя ошибка демо-сервера' }), {
      status: 500, headers: { 'Content-Type': 'application/problem+json' },
    });
  }
}

/** Как AuditInterceptor: фиксируются изменяющие запросы аутентифицированных пользователей. */
function auditRequest(method: string, path: string, user: UserRec | null, status: number): void {
  if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) return;
  const db = getDb();
  if (!user && !path.startsWith('/api/auth/')) return;
  db.audit.push({
    id: (db.seq.audit = (db.seq.audit ?? 0) + 1), createdAt: new Date().toISOString(), userId: user?.id ?? null, username: user?.username ?? null,
    action: method, entity: path.slice(0, 50), details: `status=${status}`,
  });
  if (db.audit.length > 3000) db.audit.splice(0, db.audit.length - 3000);
}

/** Сбрасывает демо-данные к исходным (также window.__resetMock()). */
export function resetMock(): void {
  dropStored();
  resetDb();
}

export function setMockDelay(enabled: boolean): void {
  delayEnabled = enabled;
}

export async function installMock(): Promise<void> {
  if (installed) return;
  installed = true;
  setCategoryPhotos(CATEGORY_MEDIA);
  loadOrCreate();
  const realFetch = window.fetch.bind(window);
  window.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const req = typeof input === 'string' || input instanceof URL ? null : input;
    const rawUrl = req ? req.url : String(input);
    const u = new URL(rawUrl, window.location.origin);
    const sameOrigin = u.origin === window.location.origin;
    if (!sameOrigin || !(u.pathname.startsWith('/api/') || u.pathname.startsWith('/pricing/'))) return realFetch(input, init);
    const method = (init?.method ?? req?.method ?? 'GET').toUpperCase();
    const headers: Record<string, string> = {};
    new Headers(init?.headers ?? req?.headers).forEach((v, k) => { headers[k.toLowerCase()] = v; });
    const rawBody = typeof init?.body === 'string' ? init.body : req ? await req.clone().text() : undefined;
    return handleRequest(method, u.pathname + u.search, headers, rawBody || undefined);
  };
  window.addEventListener('beforeunload', persistNow);
  (window as unknown as { __resetMock: () => void }).__resetMock = () => {
    resetMock();
    window.location.reload();
  };
}
