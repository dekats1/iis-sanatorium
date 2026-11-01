import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { auth as authApi } from '../api/endpoints';
import { setToken, setUnauthorizedHandler } from '../api/client';
import type { Role } from '../types';
import { decodeJwt, isExpired } from '../utils/jwt';

interface Session {
  token: string;
  username: string;
  roles: Role[];
}

interface AuthContextValue {
  session: Session | null;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
  hasRole: (...roles: Role[]) => boolean;
}

const STORAGE_KEY = 'sanatorium.token';
const USER_KEY = 'sanatorium.user';
const AuthContext = createContext<AuthContextValue | null>(null);

// sessionStorage: токен живёт до закрытия вкладки. Хранение в браузере доступно скриптам страницы (риск XSS) —
// это осознанное упрощение прототипа; в промышленной версии — HttpOnly-cookie (раздел 4.4).
function readStored(): Session | null {
  try {
    const token = sessionStorage.getItem(STORAGE_KEY);
    if (!token) return null;
    const payload = decodeJwt(token);
    if (!payload || isExpired(payload)) return null;
    // sub в JWT — числовой идентификатор пользователя; для показа в шапке храним логин отдельно
    return { token, username: sessionStorage.getItem(USER_KEY) ?? `№${payload.sub}`, roles: payload.roles };
  } catch {
    return null;
  }
}

function store(token: string | null, username?: string): void {
  try {
    if (token) {
      sessionStorage.setItem(STORAGE_KEY, token);
      if (username) sessionStorage.setItem(USER_KEY, username);
    } else {
      sessionStorage.removeItem(STORAGE_KEY);
      sessionStorage.removeItem(USER_KEY);
    }
  } catch {
    // хранилище недоступно — сеанс живёт только в памяти
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(() => {
    const s = readStored();
    setToken(s?.token ?? null);
    return s;
  });

  const logout = useCallback(() => {
    setToken(null);
    store(null);
    setSession(null);
  }, []);

  useEffect(() => {
    setUnauthorizedHandler(logout);
  }, [logout]);

  // выход по истечении срока токена, без ожидания первого отказа от сервера
  useEffect(() => {
    if (!session) return undefined;
    const payload = decodeJwt(session.token);
    if (!payload) return undefined;
    const ms = Math.max(0, payload.exp * 1000 - Date.now());
    const timer = window.setTimeout(logout, Math.min(ms, 2 ** 31 - 1));
    return () => window.clearTimeout(timer);
  }, [session, logout]);

  const login = useCallback(async (username: string, password: string) => {
    const response = await authApi.login(username, password);
    setToken(response.token);
    store(response.token, username);
    setSession({ token: response.token, username, roles: response.roles });
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      login,
      logout,
      hasRole: (...roles) => !!session && roles.some((r) => session.roles.includes(r)),
    }),
    [session, login, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth вне AuthProvider');
  return ctx;
}
