import type { ContraindicationWarning } from '../types';

/** Ошибка API в формате RFC 9457 (application/problem+json), который отдают и шлюз, и сервисы. */
export class ApiError extends Error {
  readonly status: number;
  readonly warnings: ContraindicationWarning[];

  constructor(status: number, message: string, warnings: ContraindicationWarning[] = []) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.warnings = warnings;
  }
}

let token: string | null = null;
let onUnauthorized: () => void = () => undefined;

export function setToken(value: string | null): void {
  token = value;
}

export function setUnauthorizedHandler(handler: () => void): void {
  onUnauthorized = handler;
}

function messageFor(status: number, detail: string | undefined): string {
  if (detail) return detail;
  switch (status) {
    case 401: return 'Требуется вход в систему';
    case 403: return 'Недостаточно прав для этого действия';
    case 404: return 'Объект не найден';
    case 429: return 'Слишком много запросов, повторите позже';
    case 503: return 'Сервис временно недоступен';
    default: return `Ошибка ${status}`;
  }
}

export async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (token) headers.Authorization = `Bearer ${token}`;

  let response: Response;
  try {
    response = await fetch(path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  } catch {
    throw new ApiError(0, 'Нет связи с сервером');
  }

  if (response.ok) {
    if (response.status === 204) return undefined as T;
    const text = await response.text();
    return (text ? JSON.parse(text) : undefined) as T;
  }

  let detail: string | undefined;
  let warnings: ContraindicationWarning[] = [];
  try {
    const problem = (await response.json()) as { detail?: string; warnings?: ContraindicationWarning[] };
    detail = problem.detail;
    warnings = problem.warnings ?? [];
  } catch {
    // тело не JSON — используем стандартное сообщение по коду
  }
  // 401 на странице входа — это неверный пароль, а не истёкший сеанс
  if (response.status === 401 && token) onUnauthorized();
  throw new ApiError(response.status, messageFor(response.status, detail), warnings);
}

export const get = <T>(path: string) => request<T>('GET', path);
export const post = <T>(path: string, body?: unknown) => request<T>('POST', path, body ?? {});
export const put = <T>(path: string, body: unknown) => request<T>('PUT', path, body);
export const del = <T>(path: string) => request<T>('DELETE', path);

export function query(params: Record<string, string | number | undefined>): string {
  const q = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== '') q.set(key, String(value));
  }
  const s = q.toString();
  return s ? `?${s}` : '';
}
