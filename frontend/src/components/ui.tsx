import { useEffect, useState, type ReactNode, type ButtonHTMLAttributes, type HTMLAttributes } from 'react';

export function Modal({
  isOpen,
  onClose,
  title,
  children,
  size = 'md',
}: {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  size?: 'sm' | 'md' | 'lg';
}) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose} role="dialog" aria-modal="true" aria-labelledby="modal-title">
      <div className={`modal-content modal-${size}`} onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3 id="modal-title">{title}</h3>
          <button type="button" onClick={onClose} className="modal-close-btn" aria-label="Закрыть">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
        <div className="modal-body">{children}</div>
      </div>
    </div>
  );
}

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'default' | 'primary' | 'danger' | 'link' | 'secondary' | 'outline' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  icon?: ReactNode;
}

export function Button({ variant = 'default', size = 'md', icon, className = '', children, ...props }: ButtonProps) {
  const classes = [
    variant === 'ghost' ? 'outline' : variant,
    size !== 'md' ? `btn-${size}` : '',
    icon ? 'btn-with-icon' : '',
    className,
  ].filter(Boolean).join(' ');

  return (
    <button className={classes} {...props}>
      {icon && <span className="btn-icon">{icon}</span>}
      {children}
    </button>
  );
}

export function ErrorBox({ error }: { error: unknown }) {
  if (!error) return null;
  const text = error instanceof Error ? error.message : typeof error === 'string' ? error : 'Непредвиденная ошибка';
  return (
    <div className="error" role="alert">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
        <circle cx="12" cy="12" r="10" />
        <line x1="12" y1="8" x2="12" y2="12" />
        <line x1="12" y1="16" x2="12.01" y2="16" />
      </svg>
      <span>{text}</span>
    </div>
  );
}

export function Field({
  label,
  hint,
  required,
  error,
  children,
  className = '',
  style,
  ...props
}: HTMLAttributes<HTMLLabelElement> & {
  label: string;
  hint?: string;
  required?: boolean;
  error?: string;
  children: ReactNode;
}) {
  return (
    <label className={`field ${className}`} style={style} {...props}>
      <span className="field-label">
        {label}
        {required && <span className="field-required"> *</span>}
      </span>
      {children}
      {hint && !error && <span className="field-hint">{hint}</span>}
      {error && <span className="field-error">{error}</span>}
    </label>
  );
}

export function Card({
  title,
  subtitle,
  actions,
  children,
  className = '',
  ...props
}: Omit<HTMLAttributes<HTMLDivElement>, 'title'> & {
  title?: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className={`card ${className}`} {...props}>
      {(title || subtitle || actions) && (
        <div className="card-header-bar">
          <div>
            {title && <h3 className="card-title">{title}</h3>}
            {subtitle && <p className="card-subtitle">{subtitle}</p>}
          </div>
          {actions && <div className="card-actions">{actions}</div>}
        </div>
      )}
      {children}
    </div>
  );
}

export function StatCard({
  label,
  value,
  subvalue,
  color = 'default',
  icon,
}: {
  label: string;
  value: ReactNode;
  subvalue?: ReactNode;
  color?: 'default' | 'c-blue' | 'c-teal' | 'c-amber' | 'c-red';
  icon?: ReactNode;
}) {
  return (
    <div className={`kpi-card ${color !== 'default' ? color : ''}`}>
      <div className="kpi-card-top">
        <span className="kpi-label">{label}</span>
        {icon && <span className="kpi-icon">{icon}</span>}
      </div>
      <div className="kpi-value">{value}</div>
      {subvalue && <div className="kpi-subvalue">{subvalue}</div>}
    </div>
  );
}

export function Badge({
  variant = 'neutral',
  children,
  className = '',
  style,
  ...props
}: HTMLAttributes<HTMLSpanElement> & {
  variant?: 'good' | 'wait' | 'bad' | 'info' | 'neutral' | 'success' | 'danger' | 'warning' | 'primary';
  children: ReactNode;
}) {
  const norm =
    variant === 'success' ? 'good' :
    variant === 'danger' ? 'bad' :
    variant === 'warning' ? 'wait' :
    variant === 'primary' ? 'info' :
    variant;
  return <span className={`badge ${norm} ${className}`} style={style} {...props}>{children}</span>;
}

export function EmptyState({
  title,
  description,
  action,
  icon,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  icon?: ReactNode;
}) {
  return (
    <div className="empty-state">
      <div className="empty-state-icon">
        {icon ?? (
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <line x1="8" y1="12" x2="16" y2="12" />
          </svg>
        )}
      </div>
      <h4>{title}</h4>
      {description && <p>{description}</p>}
      {action && <div className="empty-state-action">{action}</div>}
    </div>
  );
}

export function SearchBar({
  value,
  onChange,
  placeholder = 'Поиск...',
}: {
  value: string;
  onChange: (val: string) => void;
  placeholder?: string;
}) {
  return (
    <div className="search-bar">
      <svg className="search-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="11" cy="11" r="8" />
        <line x1="21" y1="21" x2="16.65" y2="16.65" />
      </svg>
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="search-input"
      />
      {value && (
        <button type="button" className="search-clear-btn" onClick={() => onChange('')} aria-label="Очистить поиск">
          ×
        </button>
      )}
    </div>
  );
}

export function ThemeToggle() {
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    const saved = localStorage.getItem('sanatorium_theme');
    if (saved === 'dark' || saved === 'light') return saved;
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  });

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('sanatorium_theme', theme);
  }, [theme]);

  const toggle = () => {
    setTheme((prev) => (prev === 'light' ? 'dark' : 'light'));
  };

  return (
    <button
      type="button"
      className="theme-toggle-btn"
      onClick={toggle}
      title={theme === 'dark' ? 'Включить светлую тему' : 'Включить тёмную тему'}
      aria-label="Переключение темы оформления"
    >
      {theme === 'dark' ? (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="5" />
          <line x1="12" y1="1" x2="12" y2="3" />
          <line x1="12" y1="21" x2="12" y2="23" />
          <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
          <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
          <line x1="1" y1="12" x2="3" y2="12" />
          <line x1="21" y1="12" x2="23" y2="12" />
          <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
          <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
        </svg>
      ) : (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
        </svg>
      )}
    </button>
  );
}

const STATUS_NAMES: Record<string, string> = {
  DRAFT: 'Черновик',
  AWAITING_PAYMENT: 'Ожидает оплаты',
  CONFIRMED: 'Подтверждена',
  CHECKED_IN: 'Заселён',
  COMPLETED: 'Завершена',
  CANCELLED: 'Отменена',
  EXPIRED: 'Просрочена',
  PENDING_REVIEW: 'На рассмотрении',
  ACKNOWLEDGED: 'Принято к сведению',
  RULE_ADJUSTED: 'Правила изменены',
  OPEN: 'Ожидает мест',
  NOTIFIED: 'Уведомлён',
  CLOSED: 'Закрыта',
};

export function statusName(status: string): string {
  return STATUS_NAMES[status] ?? status;
}

export function money(value: number | null | undefined, currency = 'BYN'): string {
  if (value === null || value === undefined) return '—';
  return `${value.toLocaleString('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${currency}`;
}

export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('ru-RU', { dateStyle: 'short', timeStyle: 'short' });
}

export function today(offsetDays = 0): string {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

const GOOD = ['CONFIRMED', 'COMPLETED', 'FULFILLED', 'ACKNOWLEDGED', 'RULE_ADJUSTED', 'CHECKED_IN'];
const WAIT = ['AWAITING_PAYMENT', 'PENDING_REVIEW', 'OPEN', 'NOTIFIED', 'DRAFT'];
const BAD = ['CANCELLED', 'EXPIRED', 'CLOSED'];

export function StatusBadge({ status }: { status: string }) {
  const kind = GOOD.includes(status) ? 'good' : WAIT.includes(status) ? 'wait' : BAD.includes(status) ? 'bad' : 'info';
  return <span className={`badge ${kind}`}>{statusName(status)}</span>;
}

/** Таблица в прокручиваемой рамке: на узком экране не ломает вёрстку. */
export function TableWrap({ children }: { children: ReactNode }) {
  return <div className="table-wrap">{children}</div>;
}
