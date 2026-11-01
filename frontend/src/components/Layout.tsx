import { useEffect, useRef, useState } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { ThemeToggle, ToastProvider } from './ui';
import { Icon, type IconName } from './icons';
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

interface MenuItem { to: string; label: string; icon: IconName; roles: Role[] }
interface MenuGroup { title: string; items: MenuItem[] }

const ALL: Role[] = ['CLIENT', 'BOOKING_ADMIN', 'DOCTOR', 'MANAGER', 'SYSADMIN'];

const GROUPS: MenuGroup[] = [
  {
    title: 'Бронирование',
    items: [
      { to: '/search', label: 'Поиск номеров', icon: 'search', roles: ['CLIENT', 'BOOKING_ADMIN'] },
      { to: '/my', label: 'Мои путёвки', icon: 'ticket', roles: ['CLIENT'] },
      { to: '/admin-bookings', label: 'Бронирование', icon: 'clipboard', roles: ['BOOKING_ADMIN'] },
      { to: '/customers', label: 'Клиенты', icon: 'users', roles: ['BOOKING_ADMIN', 'SYSADMIN'] },
    ],
  },
  {
    title: 'Лечение',
    items: [{ to: '/doctor', label: 'Лечение', icon: 'stethoscope', roles: ['DOCTOR'] }],
  },
  {
    title: 'Аналитика',
    items: [
      { to: '/manager', label: 'Доходность', icon: 'chart', roles: ['MANAGER'] },
      { to: '/pricing', label: 'Тарифы', icon: 'tag', roles: ['MANAGER'] },
    ],
  },
  {
    title: 'Система',
    items: [
      { to: '/directories', label: 'Справочники', icon: 'book', roles: ['SYSADMIN'] },
      { to: '/admin', label: 'Администрирование', icon: 'settings', roles: ['SYSADMIN'] },
    ],
  },
  {
    title: 'Аккаунт',
    items: [{ to: '/profile', label: 'Профиль', icon: 'user', roles: ALL }],
  },
];

const SECTION_BY_PATH = new Map<string, { label: string; group: string }>();
GROUPS.forEach((g) => g.items.forEach((i) => SECTION_BY_PATH.set(i.to, { label: i.label, group: g.title })));
SECTION_BY_PATH.set('/booking', { label: 'Оформление путёвки', group: 'Бронирование' });

function readCollapsed(): boolean {
  try {
    return localStorage.getItem('sanatorium_sidebar') === 'collapsed';
  } catch {
    return false;
  }
}

function Brand({ onClick }: { onClick?: () => void }) {
  return (
    <Link to="/" className="brand" onClick={onClick} aria-label="Санаторий ИИС — на главную">
      <span className="brand-icon"><Icon name="leaf" size={22} /></span>
      <span className="brand-text">Санаторий<span className="brand-badge">ИИС</span></span>
    </Link>
  );
}

function UserMenu({ onLogout }: { onLogout: () => void }) {
  const { session } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(() => getUserAvatar(session?.username));

  useEffect(() => {
    setAvatarUrl(getUserAvatar(session?.username));
    return onAvatarChange((e) => {
      if (session?.username && String(e.detail?.key) === session.username) setAvatarUrl(e.detail?.avatarUrl || null);
    });
  }, [session?.username]);

  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey); };
  }, [open]);

  if (!session) return null;
  return (
    <div className="user-menu" ref={ref}>
      <button type="button" className="user-trigger" aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        {avatarUrl ? (
          <img src={avatarUrl} alt="" className="user-avatar-img" />
        ) : (
          <span className="user-avatar" aria-hidden="true">{session.username.slice(0, 1).toUpperCase()}</span>
        )}
        <span className="user-info">
          <span className="user-name">{session.username}</span>
          <span className="user-roles">{session.roles.map((r) => ROLE_NAMES[r] ?? r).join(', ')}</span>
        </span>
        <Icon name="chevronDown" size={16} className="user-caret" />
      </button>
      {open && (
        <div className="user-dropdown" role="menu">
          <div className="user-dropdown-head">
            <strong>{session.username}</strong>
            <span>{session.roles.map((r) => ROLE_NAMES[r] ?? r).join(', ')}</span>
          </div>
          <button type="button" role="menuitem" className="menu-item" onClick={() => { setOpen(false); navigate('/profile'); }}>
            <Icon name="user" size={18} /> Личный профиль
          </button>
          <button type="button" role="menuitem" className="menu-item danger" onClick={onLogout}>
            <Icon name="logout" size={18} /> Выйти
          </button>
        </div>
      )}
    </div>
  );
}

export default function Layout() {
  const { session, logout, hasRole } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(readCollapsed);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => { setMobileOpen(false); }, [location.pathname]);
  useEffect(() => {
    if (!mobileOpen) return undefined;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setMobileOpen(false); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [mobileOpen]);

  const toggleCollapsed = () => {
    setCollapsed((c) => {
      try { localStorage.setItem('sanatorium_sidebar', c ? 'expanded' : 'collapsed'); } catch { /* недоступно */ }
      return !c;
    });
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  // Гость (страница входа): без оболочки.
  if (!session) {
    return (
      <ToastProvider>
        <main id="main" className="guest-main"><Outlet /></main>
      </ToastProvider>
    );
  }

  const section = SECTION_BY_PATH.get(location.pathname);
  const visibleGroups = GROUPS
    .map((g) => ({ ...g, items: g.items.filter((m) => hasRole(...m.roles)) }))
    .filter((g) => g.items.length > 0);

  return (
    <ToastProvider>
      <div className={`shell ${collapsed ? 'is-collapsed' : ''} ${mobileOpen ? 'is-mobile-open' : ''}`}>
        <a href="#main" className="skip-link">Перейти к содержимому</a>
        <aside className="sidebar" id="sidebar">
          <div className="sidebar-head">
            <Brand />
            <button type="button" className="icon-btn sidebar-close" aria-label="Закрыть меню" onClick={() => setMobileOpen(false)}>
              <Icon name="close" size={20} />
            </button>
          </div>
          <nav className="sidebar-nav" aria-label="Основное меню">
            {visibleGroups.map((g) => (
              <div className="nav-group" key={g.title}>
                <div className="nav-group-title">{g.title}</div>
                {g.items.map((m) => (
                  <NavLink key={m.to} to={m.to} className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`} title={m.label}>
                    <Icon name={m.icon} size={20} />
                    <span className="nav-label">{m.label}</span>
                  </NavLink>
                ))}
              </div>
            ))}
          </nav>
          <button type="button" className="sidebar-collapse" onClick={toggleCollapsed} aria-pressed={collapsed} title={collapsed ? 'Развернуть меню' : 'Свернуть меню'}>
            <Icon name="panelLeft" size={20} />
            <span className="nav-label">{collapsed ? 'Развернуть' : 'Свернуть меню'}</span>
          </button>
        </aside>
        {mobileOpen && <div className="sidebar-scrim" onClick={() => setMobileOpen(false)} aria-hidden="true" />}

        <div className="shell-body">
          <header className="topbar">
            <button type="button" className="icon-btn topbar-burger" aria-label="Открыть меню" aria-expanded={mobileOpen} aria-controls="sidebar" onClick={() => setMobileOpen(true)}>
              <Icon name="menu" size={22} />
            </button>
            <nav className="breadcrumbs" aria-label="Навигационная цепочка">
              <span className="crumb-root">Санаторий</span>
              {section && (
                <>
                  <Icon name="chevronRight" size={14} className="crumb-sep" />
                  <span className="crumb-group">{section.group}</span>
                  <Icon name="chevronRight" size={14} className="crumb-sep" />
                  <span className="crumb-current" aria-current="page">{section.label}</span>
                </>
              )}
            </nav>
            <div className="topbar-actions">
              <NotificationBell />
              <ThemeToggle />
              <UserMenu onLogout={handleLogout} />
            </div>
          </header>
          <main id="main" tabIndex={-1}>
            <Outlet />
          </main>
        </div>
      </div>
    </ToastProvider>
  );
}
