import { useState, type FormEvent } from 'react';
import { Navigate } from 'react-router-dom';
import { auth } from '../api/endpoints';
import { ErrorBox, Field } from '../components/ui';
import { useAuth } from '../hooks/useAuth';
import type { Role } from '../types';

export function homeFor(roles: Role[]): string {
  if (roles.includes('SYSADMIN')) return '/admin';
  if (roles.includes('MANAGER')) return '/manager';
  if (roles.includes('DOCTOR')) return '/doctor';
  if (roles.includes('BOOKING_ADMIN')) return '/admin-bookings';
  return '/search';
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

  return (
    <div className="hero">
      <div className="hero-art" aria-hidden="true" />
      <section className="card narrow">
        <h1>{mode === 'login' ? 'Вход' : 'Регистрация клиента'}</h1>
        <form onSubmit={submit}>
          <Field label="Логин">
            <input value={form.username} onChange={set('username')} required minLength={3} maxLength={50} autoComplete="username" />
          </Field>
          <Field label="Пароль">
            <input type="password" value={form.password} onChange={set('password')} required
                   minLength={mode === 'register' ? 8 : 1} maxLength={72}
                   autoComplete={mode === 'login' ? 'current-password' : 'new-password'} />
          </Field>
          {mode === 'register' && (
            <>
              <Field label="Фамилия"><input value={form.lastName} onChange={set('lastName')} required maxLength={80} /></Field>
              <Field label="Имя"><input value={form.firstName} onChange={set('firstName')} required maxLength={80} /></Field>
              <Field label="Отчество"><input value={form.middleName} onChange={set('middleName')} maxLength={80} /></Field>
              <Field label="Дата рождения">
                <input type="date" value={form.birthDate} onChange={set('birthDate')} required />
              </Field>
              <Field label="Эл. почта"><input type="email" value={form.email} onChange={set('email')} maxLength={150} /></Field>
              <Field label="Телефон"><input value={form.phone} onChange={set('phone')} maxLength={30} /></Field>
            </>
          )}
          <ErrorBox error={error} />
          {info && <p className="ok">{info}</p>}
          <div className="row">
            <button type="submit" className="primary" disabled={busy}>{mode === 'login' ? 'Войти' : 'Зарегистрироваться'}</button>
            <button type="button" className="link" onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); setError(null); }}>
              {mode === 'login' ? 'Регистрация клиента' : 'Уже есть учётная запись'}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
