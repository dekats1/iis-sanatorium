import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type HTMLAttributes,
  type ReactNode,
} from 'react';
import { Icon, type IconName } from './icons';

/* ------------------------------------------------------------------ */
/* Spinner / Skeleton                                                  */
/* ------------------------------------------------------------------ */

export function Spinner({ size = 16, label }: { size?: number; label?: string }) {
  return (
    <span className="spinner" role={label ? 'status' : undefined} aria-label={label} style={{ width: size, height: size }} />
  );
}

export function Skeleton({ width, height = 16, className = '' }: { width?: number | string; height?: number | string; className?: string }) {
  return <span className={`skeleton ${className}`} style={{ width, height }} aria-hidden="true" />;
}

/** Скелетон-заглушка таблицы/списка: сохраняет высоту, поэтому вёрстка не «прыгает». */
export function SkeletonRows({ rows = 5 }: { rows?: number }) {
  return (
    <div className="skeleton-rows" role="status" aria-label="Загрузка данных">
      {Array.from({ length: rows }, (_, i) => (
        <Skeleton key={i} height={40} />
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Modal / Drawer / ConfirmDialog                                      */
/* ------------------------------------------------------------------ */

const FOCUSABLE =
  'a[href],button:not([disabled]),input:not([disabled]):not([type="hidden"]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';

/** Фокус-ловушка, Esc, блокировка прокрутки фона и возврат фокуса. */
function useDialogBehavior(isOpen: boolean, onClose: () => void) {
  const ref = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    if (!isOpen) return undefined;
    const previous = document.activeElement as HTMLElement | null;
    const node = ref.current;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const first = node?.querySelector<HTMLElement>('[data-autofocus]') ?? node?.querySelector<HTMLElement>(FOCUSABLE);
    (first ?? node)?.focus();

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        closeRef.current();
        return;
      }
      if (e.key !== 'Tab' || !node) return;
      const items = Array.from(node.querySelectorAll<HTMLElement>(FOCUSABLE)).filter((el) => el.offsetParent !== null);
      if (items.length === 0) {
        e.preventDefault();
        return;
      }
      const firstEl = items[0];
      const lastEl = items[items.length - 1];
      if (e.shiftKey && document.activeElement === firstEl) {
        e.preventDefault();
        lastEl.focus();
      } else if (!e.shiftKey && document.activeElement === lastEl) {
        e.preventDefault();
        firstEl.focus();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
      previous?.focus?.();
    };
  }, [isOpen]);

  return ref;
}

export function Modal({
  isOpen,
  onClose,
  title,
  children,
  size = 'md',
  footer,
}: {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  size?: 'sm' | 'md' | 'lg';
  footer?: ReactNode;
}) {
  const titleId = useId();
  const ref = useDialogBehavior(isOpen, onClose);
  if (!isOpen) return null;
  return (
    <div className="modal-overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div
        ref={ref}
        className={`modal-content modal-${size}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
      >
        <div className="modal-header">
          <h3 id={titleId}>{title}</h3>
          <button type="button" onClick={onClose} className="icon-btn" aria-label="Закрыть">
            <Icon name="close" size={18} />
          </button>
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-footer">{footer}</div>}
      </div>
    </div>
  );
}

export function Drawer({
  isOpen,
  onClose,
  title,
  children,
  side = 'right',
}: {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  side?: 'left' | 'right';
}) {
  const titleId = useId();
  const ref = useDialogBehavior(isOpen, onClose);
  if (!isOpen) return null;
  return (
    <div className="drawer-overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <aside ref={ref} className={`drawer drawer-${side}`} role="dialog" aria-modal="true" aria-labelledby={titleId} tabIndex={-1}>
        <div className="modal-header">
          <h3 id={titleId}>{title}</h3>
          <button type="button" onClick={onClose} className="icon-btn" aria-label="Закрыть">
            <Icon name="close" size={18} />
          </button>
        </div>
        <div className="modal-body">{children}</div>
      </aside>
    </div>
  );
}

/** Подтверждение опасных действий вместо window.confirm. */
export function ConfirmDialog({
  isOpen,
  title,
  message,
  confirmLabel = 'Подтвердить',
  cancelLabel = 'Отмена',
  danger = false,
  busy = false,
  onConfirm,
  onCancel,
}: {
  isOpen: boolean;
  title: string;
  message: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onCancel}
      title={title}
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={onCancel} data-autofocus>
            {cancelLabel}
          </Button>
          <Button variant={danger ? 'danger' : 'primary'} onClick={onConfirm} loading={busy}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      <div className="confirm-body">
        <span className={`confirm-icon ${danger ? 'is-danger' : ''}`}>
          <Icon name={danger ? 'alertTriangle' : 'info'} size={22} />
        </span>
        <div>{message}</div>
      </div>
    </Modal>
  );
}

/** Хук-обёртка: `const [ask, dialog] = useConfirm()`; `ask({...}).then(ok => ...)`. */
export function useConfirm() {
  const [state, setState] = useState<{
    title: string;
    message: ReactNode;
    confirmLabel?: string;
    danger?: boolean;
    resolve: (v: boolean) => void;
  } | null>(null);

  const ask = useCallback(
    (opts: { title: string; message: ReactNode; confirmLabel?: string; danger?: boolean }) =>
      new Promise<boolean>((resolve) => setState({ ...opts, resolve })),
    [],
  );
  const close = (v: boolean) => {
    state?.resolve(v);
    setState(null);
  };
  const dialog = (
    <ConfirmDialog
      isOpen={state !== null}
      title={state?.title ?? ''}
      message={state?.message}
      confirmLabel={state?.confirmLabel}
      danger={state?.danger}
      onConfirm={() => close(true)}
      onCancel={() => close(false)}
    />
  );
  return [ask, dialog] as const;
}

/* ------------------------------------------------------------------ */
/* Toast                                                               */
/* ------------------------------------------------------------------ */

type ToastKind = 'success' | 'error' | 'info' | 'warning';
interface ToastItem { id: number; kind: ToastKind; text: string }
const ToastContext = createContext<((kind: ToastKind, text: string) => void) | null>(null);

const TOAST_ICON: Record<ToastKind, IconName> = {
  success: 'checkCircle',
  error: 'xCircle',
  info: 'info',
  warning: 'alertTriangle',
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const counter = useRef(0);
  const push = useCallback((kind: ToastKind, text: string) => {
    const id = ++counter.current;
    setItems((l) => [...l.slice(-3), { id, kind, text }]);
    window.setTimeout(() => setItems((l) => l.filter((t) => t.id !== id)), 5000);
  }, []);
  return (
    <ToastContext.Provider value={push}>
      {children}
      <div className="toast-region" aria-live="polite" aria-atomic="false">
        {items.map((t) => (
          <div key={t.id} className={`toast toast-${t.kind}`} role={t.kind === 'error' ? 'alert' : 'status'}>
            <Icon name={TOAST_ICON[t.kind]} size={20} />
            <span>{t.text}</span>
            <button type="button" className="icon-btn" aria-label="Закрыть уведомление" onClick={() => setItems((l) => l.filter((x) => x.id !== t.id))}>
              <Icon name="close" size={16} />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const push = useContext(ToastContext);
  return useMemo(
    () => ({
      success: (t: string) => push?.('success', t),
      error: (t: string) => push?.('error', t),
      info: (t: string) => push?.('info', t),
      warning: (t: string) => push?.('warning', t),
    }),
    [push],
  );
}

/* ------------------------------------------------------------------ */
/* Button                                                              */
/* ------------------------------------------------------------------ */

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'default' | 'primary' | 'danger' | 'link' | 'secondary' | 'outline' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  icon?: ReactNode;
  loading?: boolean;
}

export function Button({ variant = 'default', size = 'md', icon, loading = false, className = '', children, disabled, ...props }: ButtonProps) {
  const classes = [
    'btn',
    variant === 'default' ? 'secondary' : variant,
    size !== 'md' ? `btn-${size}` : '',
    loading ? 'is-loading' : '',
    className,
  ].filter(Boolean).join(' ');

  return (
    <button className={classes} disabled={disabled || loading} aria-busy={loading || undefined} {...props}>
      {loading ? <Spinner /> : icon ? <span className="btn-icon">{icon}</span> : null}
      {children}
    </button>
  );
}

/* ------------------------------------------------------------------ */
/* Messages                                                            */
/* ------------------------------------------------------------------ */

export function ErrorBox({ error }: { error: unknown }) {
  if (!error) return null;
  const text = error instanceof Error ? error.message : typeof error === 'string' ? error : 'Непредвиденная ошибка. Повторите действие позже.';
  return (
    <div className="error" role="alert">
      <Icon name="alertCircle" size={18} />
      <span>{text}</span>
    </div>
  );
}

export function Notice({ tone = 'info', children }: { tone?: 'info' | 'success' | 'warning'; children: ReactNode }) {
  const icon: IconName = tone === 'success' ? 'checkCircle' : tone === 'warning' ? 'alertTriangle' : 'info';
  return (
    <div className={`notice notice-${tone}`} role={tone === 'info' ? 'note' : 'status'}>
      <Icon name={icon} size={18} />
      <div>{children}</div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Form                                                                */
/* ------------------------------------------------------------------ */

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
    <label className={`field ${error ? 'has-error' : ''} ${className}`} style={style} {...props}>
      <span className="field-label">
        {label}
        {required && <span className="field-required" aria-hidden="true"> *</span>}
      </span>
      {children}
      {hint && !error && <span className="field-hint">{hint}</span>}
      {error && (
        <span className="field-error" role="alert">
          <Icon name="alertCircle" size={14} /> {error}
        </span>
      )}
    </label>
  );
}

export function SearchBar({
  value,
  onChange,
  placeholder = 'Поиск...',
  label = 'Поиск',
}: {
  value: string;
  onChange: (val: string) => void;
  placeholder?: string;
  label?: string;
}) {
  return (
    <div className="search-bar">
      <Icon name="search" size={18} className="search-icon" />
      <input type="search" value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} aria-label={label} className="search-input" />
      {value && (
        <button type="button" className="search-clear-btn" onClick={() => onChange('')} aria-label="Очистить поиск">
          <Icon name="close" size={16} />
        </button>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Cards / KPI                                                         */
/* ------------------------------------------------------------------ */

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
            {subtitle && <div className="card-subtitle">{subtitle}</div>}
          </div>
          {actions && <div className="card-actions">{actions}</div>}
        </div>
      )}
      {children}
    </div>
  );
}

/** Мини-график тренда (чистый SVG). */
export function Sparkline({ values, tone = 'primary', width = 96, height = 32 }: { values: number[]; tone?: 'primary' | 'ok' | 'warn' | 'danger'; width?: number; height?: number }) {
  if (values.length < 2) return null;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const pad = 3;
  const pts = values.map((v, i) => [pad + (i * (width - pad * 2)) / (values.length - 1), height - pad - ((v - min) / span) * (height - pad * 2)] as const);
  const line = pts.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`).join(' ');
  const area = `${line} L${pts[pts.length - 1][0].toFixed(1)} ${height} L${pts[0][0].toFixed(1)} ${height} Z`;
  const [lx, ly] = pts[pts.length - 1];
  return (
    <svg className={`sparkline tone-${tone}`} width={width} height={height} viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Динамика показателя">
      <path d={area} className="sparkline-area" />
      <path d={line} className="sparkline-line" fill="none" />
      <circle cx={lx} cy={ly} r={2.5} className="sparkline-dot" />
    </svg>
  );
}

export function StatCard({
  label,
  value,
  subvalue,
  color = 'default',
  icon,
  trend,
}: {
  label: string;
  value: ReactNode;
  subvalue?: ReactNode;
  color?: 'default' | 'c-blue' | 'c-teal' | 'c-amber' | 'c-red';
  icon?: ReactNode;
  trend?: number[];
}) {
  const tone = color === 'c-red' ? 'danger' : color === 'c-amber' ? 'warn' : color === 'c-teal' ? 'ok' : 'primary';
  return (
    <div className={`kpi-card ${color !== 'default' ? color : ''}`}>
      <div className="kpi-card-top">
        <span className="kpi-label">{label}</span>
        {icon && <span className="kpi-icon">{icon}</span>}
      </div>
      <div className="kpi-value">{value}</div>
      <div className="kpi-foot">
        {subvalue && <div className="kpi-subvalue">{subvalue}</div>}
        {trend && <Sparkline values={trend} tone={tone} />}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Badge / Status                                                      */
/* ------------------------------------------------------------------ */

type Tone = 'good' | 'wait' | 'bad' | 'info' | 'neutral';

export function Badge({
  variant = 'neutral',
  children,
  className = '',
  icon,
  ...props
}: HTMLAttributes<HTMLSpanElement> & {
  variant?: Tone | 'success' | 'danger' | 'warning' | 'primary';
  icon?: IconName;
  children: ReactNode;
}) {
  const norm =
    variant === 'success' ? 'good' :
    variant === 'danger' ? 'bad' :
    variant === 'warning' ? 'wait' :
    variant === 'primary' ? 'info' :
    variant;
  return (
    <span className={`badge ${norm} ${className}`} {...props}>
      {icon && <Icon name={icon} size={14} />}
      {children}
    </span>
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

const GOOD = ['CONFIRMED', 'COMPLETED', 'FULFILLED', 'ACKNOWLEDGED', 'RULE_ADJUSTED', 'CHECKED_IN'];
const WAIT = ['AWAITING_PAYMENT', 'PENDING_REVIEW', 'OPEN', 'NOTIFIED', 'DRAFT'];
const BAD = ['CANCELLED', 'EXPIRED', 'CLOSED'];

/** Единый маппинг статус → тон + иконка (смысл не передаётся только цветом). */
export function statusMeta(status: string): { tone: Tone; icon: IconName } {
  if (GOOD.includes(status)) return { tone: 'good', icon: status === 'CHECKED_IN' ? 'key' : 'checkCircle' };
  if (WAIT.includes(status)) return { tone: 'wait', icon: 'clock' };
  if (BAD.includes(status)) return { tone: 'bad', icon: 'xCircle' };
  return { tone: 'info', icon: 'info' };
}

export function StatusBadge({ status }: { status: string }) {
  const { tone, icon } = statusMeta(status);
  return (
    <span className={`badge ${tone}`}>
      <Icon name={icon} size={14} />
      {statusName(status)}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/* EmptyState                                                          */
/* ------------------------------------------------------------------ */

export function EmptyIllustration() {
  return (
    <svg className="empty-illustration" width="120" height="96" viewBox="0 0 120 96" fill="none" aria-hidden="true">
      <ellipse cx="60" cy="86" rx="40" ry="6" className="ei-shadow" />
      <rect x="22" y="22" width="76" height="56" rx="10" className="ei-card" />
      <rect x="32" y="34" width="34" height="6" rx="3" className="ei-bar" />
      <rect x="32" y="46" width="56" height="5" rx="2.5" className="ei-line" />
      <rect x="32" y="57" width="44" height="5" rx="2.5" className="ei-line" />
      <circle cx="90" cy="26" r="14" className="ei-badge" />
      <path d="m84 26 4 4 8-8" className="ei-check" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M16 18v8M12 22h8" className="ei-spark" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
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
      <div className="empty-state-icon">{icon ?? <EmptyIllustration />}</div>
      <h4>{title}</h4>
      {description && <p>{description}</p>}
      {action && <div className="empty-state-action">{action}</div>}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Tabs / Stepper / Pagination                                         */
/* ------------------------------------------------------------------ */

export function Tabs<T extends string>({
  tabs,
  value,
  onChange,
  label,
}: {
  tabs: { id: T; label: string; icon?: IconName; count?: number }[];
  value: T;
  onChange: (id: T) => void;
  label?: string;
}) {
  return (
    <div className="tabs" role="tablist" aria-label={label}>
      {tabs.map((t) => (
        <button
          key={t.id}
          type="button"
          role="tab"
          aria-selected={value === t.id}
          className={`tab ${value === t.id ? 'active' : ''}`}
          onClick={() => onChange(t.id)}
        >
          {t.icon && <Icon name={t.icon} size={18} />}
          {t.label}
          {t.count !== undefined && <span className="tab-count">{t.count}</span>}
        </button>
      ))}
    </div>
  );
}

export function Stepper({ steps, current }: { steps: string[]; current: number }) {
  return (
    <ol className="stepper" aria-label="Шаги оформления">
      {steps.map((s, i) => {
        const state = i < current ? 'done' : i === current ? 'current' : 'todo';
        return (
          <li key={s} className={`step step-${state}`} aria-current={state === 'current' ? 'step' : undefined}>
            <span className="step-dot">{state === 'done' ? <Icon name="check" size={16} /> : i + 1}</span>
            <span className="step-label">{s}</span>
          </li>
        );
      })}
    </ol>
  );
}

export function Pagination({ page, pageCount, onChange }: { page: number; pageCount: number; onChange: (p: number) => void }) {
  if (pageCount <= 1) return null;
  const pages: (number | '…')[] = [];
  for (let p = 1; p <= pageCount; p++) {
    if (p === 1 || p === pageCount || Math.abs(p - page) <= 1) pages.push(p);
    else if (pages[pages.length - 1] !== '…') pages.push('…');
  }
  return (
    <nav className="pagination" aria-label="Постраничная навигация">
      <button type="button" className="page-btn" disabled={page <= 1} onClick={() => onChange(page - 1)} aria-label="Предыдущая страница">
        <Icon name="chevronLeft" size={18} />
      </button>
      {pages.map((p, i) =>
        p === '…' ? (
          <span key={`e${i}`} className="page-gap">…</span>
        ) : (
          <button key={p} type="button" className={`page-btn ${p === page ? 'active' : ''}`} aria-current={p === page ? 'page' : undefined} onClick={() => onChange(p)}>
            {p}
          </button>
        ),
      )}
      <button type="button" className="page-btn" disabled={page >= pageCount} onClick={() => onChange(page + 1)} aria-label="Следующая страница">
        <Icon name="chevronRight" size={18} />
      </button>
    </nav>
  );
}

/** Таблица в прокручиваемой рамке: на узком экране не ломает вёрстку. */
export function TableWrap({ children }: { children: ReactNode }) {
  return <div className="table-wrap">{children}</div>;
}

/* ------------------------------------------------------------------ */
/* Theme                                                               */
/* ------------------------------------------------------------------ */

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

  return (
    <button
      type="button"
      className="icon-btn"
      onClick={() => setTheme((prev) => (prev === 'light' ? 'dark' : 'light'))}
      title={theme === 'dark' ? 'Включить светлую тему' : 'Включить тёмную тему'}
      aria-label="Переключение темы оформления"
    >
      <Icon name={theme === 'dark' ? 'sun' : 'moon'} size={20} />
    </button>
  );
}

/* ------------------------------------------------------------------ */
/* Formatters                                                          */
/* ------------------------------------------------------------------ */

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
