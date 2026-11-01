import { useState, type FormEvent } from 'react';
import { Navigate } from 'react-router-dom';
import { auth } from '../api/endpoints';
import { Button, ErrorBox, Field, Notice } from '../components/ui';
import { Icon, type IconName } from '../components/icons';
import { useAuth } from '../hooks/useAuth';
import type { Role } from '../types';

export function homeFor(roles: Role[]): string {
  if (roles.includes('SYSADMIN')) return '/admin';
  if (roles.includes('MANAGER')) return '/manager';
  if (roles.includes('DOCTOR')) return '/doctor';
  if (roles.includes('BOOKING_ADMIN')) return '/admin-bookings';
  return '/search';
}

const DEMO_ROLES: { user: string; title: string; hint: string; icon: IconName }[] = [
  { user: 'client', title: 'Клиент', hint: 'Поиск и бронирование путёвок', icon: 'user' },
  { user: 'admin', title: 'Администратор', hint: 'Бронирование и клиенты', icon: 'clipboard' },
  { user: 'doctor', title: 'Врач', hint: 'Назначения и медкарты', icon: 'stethoscope' },
  { user: 'manager', title: 'Менеджер', hint: 'Доходность и тарифы', icon: 'chart' },
  { user: 'sysadmin', title: 'Сисадмин', hint: 'Справочники и доступы', icon: 'settings' },
];
const DEMO_PASSWORD = 'demo12345';

const BENEFITS: { icon: IconName; title: string; text: string }[] = [
  { icon: 'bed', title: 'Бронирование онлайн', text: 'Свободные номера и цена за сутки в реальном времени' },
  { icon: 'stethoscope', title: 'Лечебные программы', text: 'Назначения врача и расписание процедур в одном месте' },
  { icon: 'shield', title: 'Надёжно и прозрачно', text: 'Электронная медкарта, оплата и возвраты без бумаг' },
];

function BrandArt() {
  return (
    <svg className="login-art" viewBox="0 0 600 220" preserveAspectRatio="xMidYMax slice" aria-hidden="true">
      <defs>
        <linearGradient id="la-sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#ffffff" stopOpacity="0.0" /><stop offset="1" stopColor="#ffffff" stopOpacity="0.14" /></linearGradient>
      </defs>
      <rect width="600" height="220" fill="url(#la-sky)" />
      <circle cx="470" cy="60" r="34" fill="#ffffff" opacity="0.18" />
      <path d="M0 150 L90 80 L170 140 L260 60 L360 150 L450 90 L600 160 V220 H0Z" fill="#ffffff" opacity="0.10" />
      <path d="M0 175 Q80 140 170 170 T340 168 T520 165 T600 172 V220 H0Z" fill="#ffffff" opacity="0.14" />
      <path d="M0 195 Q100 170 200 192 T400 190 T600 192 V220 H0Z" fill="#ffffff" opacity="0.20" />
      <g fill="#ffffff" opacity="0.30"><path d="M60 190 l10 -46 l10 46z" /><path d="M84 190 l8 -34 l8 34z" /><path d="M520 192 l10 -52 l10 52z" /><path d="M544 192 l8 -36 l8 36z" /></g>
    </svg>
  );
}

export default function LoginPage() {
  const { session, login } = useAuth();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [error, setError] = useState<unknown>(null);
  const [info, setInfo] = useState('');
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    username: '', password: '', lastName: '', firstName: '', middleName: '', birthDate: '', email: '', phone: '',
  });

  if (session) return <Navigate to={homeFor(session.roles)} replace />;

  const set = (key: keyof typeof form) => (e: { target: { value: string } }) =>
    setForm((f) => ({ ...f, [key]: e.target.value }));

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setInfo('');
    setBusy(true);
    try {
      if (mode === 'login') {
        await login(form.username, form.password);
      } else {
        await auth.register({
          username: form.username,
          password: form.password,
          lastName: form.lastName,
          firstName: form.firstName,
          middleName: form.middleName || undefined,
          birthDate: form.birthDate,
          email: form.email || undefined,
          phone: form.phone || undefined,
        });
        setInfo('Регистрация выполнена. Теперь войдите под своим логином.');
        setMode('login');
      }
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  }

  async function quickLogin(user: string) {
    setError(null);
    setInfo('');
    setBusy(true);
    setForm((f) => ({ ...f, username: user, password: DEMO_PASSWORD }));
    try {
      await login(user, DEMO_PASSWORD);
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="login">
      <aside className="login-brand">
        <div className="login-brand-inner">
          <div className="brand-lockup">
            <span className="brand-icon"><Icon name="leaf" size={22} /></span>
            <span className="brand-text">Санаторий<span className="brand-badge on-dark">ИИС</span></span>
          </div>
          <h2 className="login-tagline">Здоровье начинается с хорошего отдыха</h2>
          <p className="login-lead">Информационная система санатория: от выбора номера до курса лечения.</p>
          <ul className="benefits">
            {BENEFITS.map((b) => (
              <li key={b.title}>
                <span className="benefit-icon"><Icon name={b.icon} size={20} /></span>
                <span><strong>{b.title}</strong><span className="benefit-text">{b.text}</span></span>
              </li>
            ))}
          </ul>
        </div>
        <BrandArt />
      </aside>

      <section className="login-panel">
        <div className="login-form-wrap">
          <h1>{mode === 'login' ? 'Вход' : 'Регистрация клиента'}</h1>
          <p className="login-sub">{mode === 'login' ? 'Введите логин и пароль или выберите демо-роль ниже.' : 'Заполните данные — это займёт минуту.'}</p>
          <form onSubmit={submit}>
            <Field label="Логин">
              <input value={form.username} onChange={set('username')} required minLength={3} maxLength={50} autoComplete="username" />
            </Field>
            <Field label="Пароль" hint={mode === 'register' ? 'Не короче 8 символов' : undefined}>
              <input type="password" value={form.password} onChange={set('password')} required
                     minLength={mode === 'register' ? 8 : 1} maxLength={72}
                     autoComplete={mode === 'login' ? 'current-password' : 'new-password'} />
            </Field>
            {mode === 'register' && (
              <div className="form-grid">
                <Field label="Фамилия"><input value={form.lastName} onChange={set('lastName')} required maxLength={80} /></Field>
                <Field label="Имя"><input value={form.firstName} onChange={set('firstName')} required maxLength={80} /></Field>
                <Field label="Отчество"><input value={form.middleName} onChange={set('middleName')} maxLength={80} /></Field>
                <Field label="Дата рождения"><input type="date" value={form.birthDate} onChange={set('birthDate')} required /></Field>
                <Field label="Эл. почта"><input type="email" value={form.email} onChange={set('email')} maxLength={150} /></Field>
                <Field label="Телефон"><input value={form.phone} onChange={set('phone')} maxLength={30} /></Field>
              </div>
            )}
            <ErrorBox error={error} />
            {info && <Notice tone="success">{info}</Notice>}
            <div className="login-actions">
              <Button type="submit" variant="primary" size="lg" loading={busy}>{mode === 'login' ? 'Войти' : 'Зарегистрироваться'}</Button>
              <button type="button" className="link" onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); setError(null); }}>
                {mode === 'login' ? 'Регистрация клиента' : 'Уже есть учётная запись'}
              </button>
            </div>
          </form>

          {mode === 'login' && (
            <div className="demo-box">
              <div className="demo-title"><Icon name="key" size={16} /> Демо-доступ: нажмите на роль (пароль {DEMO_PASSWORD})</div>
              <div className="demo-roles">
                {DEMO_ROLES.map((r) => (
                  <button key={r.user} type="button" className="demo-role" disabled={busy} onClick={() => void quickLogin(r.user)} aria-label={`Демо-роль: ${r.title}`}>
                    <span className="demo-role-icon"><Icon name={r.icon} size={20} /></span>
                    <span className="demo-role-text"><strong>{r.title}</strong><span>{r.hint}</span></span>
                    <code>{r.user}</code>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
