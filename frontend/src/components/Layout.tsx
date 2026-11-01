import { useEffect, useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { ThemeToggle } from './ui';
import { NotificationBell } from './NotificationBell';
import { getUserAvatar, onAvatarChange } from '../utils/avatar';
import type { Role } from '../types';

const ROLE_NAMES: Record<Role, string> = {
  CLIENT: 'Клиент',
  BOOKING_ADMIN: 'Администратор бронирования',
  DOCTOR: 'Врач',
  MANAGER: 'Менеджер по доходам',
  SYSADMIN: 'Системный администратор',
};

interface MenuItem { to: string; label: string; roles: Role[] }

const MENU: MenuItem[] = [
  { to: '/search', label: 'Поиск номеров', roles: ['CLIENT', 'BOOKING_ADMIN'] },
  { to: '/my', label: 'Мои путёвки', roles: ['CLIENT'] },
  { to: '/admin-bookings', label: 'Бронирование', roles: ['BOOKING_ADMIN'] },
  { to: '/customers', label: 'Клиенты', roles: ['BOOKING_ADMIN', 'SYSADMIN'] },
  { to: '/doctor', label: 'Лечение', roles: ['DOCTOR'] },
  { to: '/manager', label: 'Доходность', roles: ['MANAGER'] },
  { to: '/pricing', label: 'Тарифы', roles: ['MANAGER'] },
  { to: '/directories', label: 'Справочники', roles: ['SYSADMIN'] },
  { to: '/admin', label: 'Администрирование', roles: ['SYSADMIN'] },
  { to: '/profile', label: 'Профиль', roles: ['CLIENT', 'BOOKING_ADMIN', 'DOCTOR', 'MANAGER', 'SYSADMIN'] },
];

export default function Layout() {
  const { session, logout, hasRole } = useAuth();
  const navigate = useNavigate();
  const [avatarUrl, setAvatarUrl] = useState<string | null>(() => getUserAvatar(session?.username));

  useEffect(() => {
    setAvatarUrl(getUserAvatar(session?.username));
    return onAvatarChange((e) => {
      if (session?.username && String(e.detail?.key) === session.username) {
        setAvatarUrl(e.detail?.avatarUrl || null);
      }
    });
  }, [session?.username]);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="layout">
      <header className="topbar">
        <div className="brand" onClick={() => navigate('/')}>
          <div className="brand-icon">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10c0-6-8-10-8-10S4 6 4 12c0 6 8 10 8 10z"/><path d="M12 2v20"/></svg>
          </div>
          Санаторий<span className="brand-badge">ИИС</span>
        </div>
        {session && (
          <nav aria-label="Основное меню">
            {MENU.filter((m) => hasRole(...m.roles)).map((m) => (
              <NavLink key={m.to} to={m.to} className={({ isActive }) => (isActive ? 'active' : undefined)}>
                {m.label}
              </NavLink>
            ))}
          </nav>
        )}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginLeft: 'auto' }}>
          {session && <NotificationBell />}
          <ThemeToggle />
          {session ? (
            <div
              className="user"
              onClick={() => navigate('/profile')}
              style={{ cursor: 'pointer' }}
              title="Перейти в личный профиль"
            >
              {avatarUrl ? (
                <img src={avatarUrl} alt={session.username} className="user-avatar-img" />
              ) : (
                <div className="user-avatar">{session.username.slice(0, 1).toUpperCase()}</div>
              )}
              <div className="user-info">
                <span className="user-name">{session.username}</span>
                <span className="user-roles">{session.roles.map((r) => ROLE_NAMES[r] ?? r).join(', ')}</span>
              </div>
              <button
                type="button"
                className="user-logout-btn"
                onClick={(e) => {
                  e.stopPropagation();
                  handleLogout();
                }}
              >
                Выйти
              </button>
            </div>
          ) : (
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={() => navigate('/login')}
              style={{ padding: '7px 16px', borderRadius: 'var(--radius-pill)', fontWeight: 650 }}
            >
              Войти
            </button>
          )}
        </div>
      </header>
      <main>
        <Outlet />
      </main>
    </div>
  );
}
