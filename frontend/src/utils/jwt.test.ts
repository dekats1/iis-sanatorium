import { describe, expect, it } from 'vitest';
import { decodeJwt, isExpired } from './jwt';

function b64url(obj: unknown): string {
  const bytes = new TextEncoder().encode(JSON.stringify(obj));
  let bin = '';
  bytes.forEach((b) => { bin += String.fromCharCode(b); });
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

const make = (payload: unknown) => `${b64url({ alg: 'HS256' })}.${b64url(payload)}.signature`;

describe('decodeJwt', () => {
  it('читает субъект, роли и срок', () => {
    const p = decodeJwt(make({ sub: 'doctor', roles: ['DOCTOR'], exp: 2_000_000_000 }));
    expect(p).toEqual({ sub: 'doctor', roles: ['DOCTOR'], exp: 2_000_000_000 });
  });

  it('понимает кириллицу в полезной нагрузке', () => {
    const p = decodeJwt(make({ sub: 'иванов', roles: [], exp: 1 }));
    expect(p?.sub).toBe('иванов');
  });

  it('возвращает null для мусора и неполных токенов', () => {
    expect(decodeJwt('')).toBeNull();
    expect(decodeJwt('abc')).toBeNull();
    expect(decodeJwt('a.b.c')).toBeNull();
    expect(decodeJwt(make({ sub: 'x' }))).toBeNull();
    expect(decodeJwt(make({ sub: 'x', roles: 'CLIENT', exp: 1 }))).toBeNull();
  });
});

describe('isExpired', () => {
  it('сравнивает срок с текущим временем', () => {
    const p = { sub: 'x', roles: [], exp: 1000 };
    expect(isExpired(p, 999_000)).toBe(false);
    expect(isExpired(p, 1_000_000)).toBe(true);
    expect(isExpired(p, 2_000_000)).toBe(true);
  });
});
