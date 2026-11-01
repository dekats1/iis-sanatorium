import type { Role } from '../types';

export interface JwtPayload {
  sub: string;
  roles: Role[];
  exp: number;
}

/**
 * Разбирает полезную нагрузку JWT ТОЛЬКО для интерфейса (показать имя, скрыть недоступные пункты меню).
 * Подпись здесь не проверяется и проверяться не может: настоящую проверку выполняют шлюз и сервисы,
 * поэтому подделка токена в браузере прав не даёт.
 */
export function decodeJwt(token: string): JwtPayload | null {
  try {
    const part = token.split('.')[1];
    if (!part) return null;
    const base64 = part.replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4);
    const bytes = Uint8Array.from(atob(padded), (c) => c.charCodeAt(0));
    const data = JSON.parse(new TextDecoder().decode(bytes)) as Partial<JwtPayload>;
    if (typeof data.sub !== 'string' || typeof data.exp !== 'number' || !Array.isArray(data.roles)) return null;
    return { sub: data.sub, roles: data.roles, exp: data.exp };
  } catch {
    return null;
  }
}

export function isExpired(payload: JwtPayload, nowMs: number = Date.now()): boolean {
  return payload.exp * 1000 <= nowMs;
}
