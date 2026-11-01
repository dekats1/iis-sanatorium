import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { admin, directory } from '../api/endpoints';
import { ErrorBox, Field, formatDateTime, TableWrap } from '../components/ui';
import type { AuditRow, Coded, Procedure, Role, RoomCategory, SalesChannel, UserRow } from '../types';

const ALL_ROLES: Role[] = ['CLIENT', 'BOOKING_ADMIN', 'DOCTOR', 'MANAGER', 'SYSADMIN'];

/** Администрирование: учётные записи и роли (ФТ-02), журнал действий (ФТ-20), просмотр справочников. */
export default function AdminPage() {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [audit, setAudit] = useState<AuditRow[]>([]);
  const [auditPage, setAuditPage] = useState(0);
  const [categories, setCategories] = useState<RoomCategory[]>([]);
  const [channels, setChannels] = useState<SalesChannel[]>([]);
  const [procedures, setProcedures] = useState<Procedure[]>([]);
  const [conditions, setConditions] = useState<Coded[]>([]);
  const [error, setError] = useState<unknown>(null);
  const [message, setMessage] = useState('');
  const [form, setForm] = useState({ username: '', password: '', fullName: '', email: '', role: 'CLIENT' as Role });

  const loadUsers = useCallback(async () => {
    try {
      setUsers(await admin.users());
    } catch (err) {
      setError(err);
    }
  }, []);

  useEffect(() => {
    void loadUsers();
    directory.categories().then(setCategories).catch(setError);
    directory.channels().then(setChannels).catch(setError);
    directory.procedures().then(setProcedures).catch(setError);
    directory.conditions().then(setConditions).catch(setError);
  }, [loadUsers]);

  useEffect(() => {
    admin.audit(auditPage).then(setAudit).catch(setError);
  }, [auditPage]);

  async function run(fn: () => Promise<void>, done?: string) {
    setError(null);
    setMessage('');
    try {
      await fn();
      if (done) setMessage(done);
      await loadUsers();
    } catch (err) {
      setError(err);
    }
  }

  function create(e: FormEvent) {
    e.preventDefault();
    void run(async () => {
      await admin.createUser({
        username: form.username, password: form.password, fullName: form.fullName,
        email: form.email || undefined, roles: [form.role],
      });
      setForm({ ...form, username: '', password: '', fullName: '', email: '' });
    }, 'Пользователь создан');
  }

  function toggleRole(u: UserRow, role: Role) {
    const roles = u.roles.includes(role) ? u.roles.filter((r) => r !== role) : [...u.roles, role];
    if (roles.length === 0) {
      setError(new Error('У пользователя должна остаться хотя бы одна роль'));
      return;
    }
    void run(() => admin.setRoles(u.id, roles));
  }

  function resetPassword(u: UserRow) {
    const password = window.prompt(`Новый пароль для ${u.username} (не короче 8 символов)`);
    if (password) void run(() => admin.resetPassword(u.id, password), 'Пароль изменён');
  }

  return (
    <section>
      <h1>Администрирование</h1>
      <ErrorBox error={error} />
      {message && <p className="ok">{message}</p>}

      <h2>Пользователи</h2>
      <TableWrap><table>
        <caption>Таблица. Учётные записи и роли</caption>
        <thead><tr><th>Логин</th><th>ФИО</th><th>Роли</th><th>Активен</th><th /></tr></thead>
        <tbody>
          {users.map((u) => (
            <tr key={u.id}>
              <td>{u.username}</td><td>{u.fullName}</td>
              <td>
                {ALL_ROLES.map((r) => (
                  <label key={r} className="check">
                    <input type="checkbox" checked={u.roles.includes(r)} onChange={() => toggleRole(u, r)} /> {r}
                  </label>
                ))}
              </td>
              <td>{u.active ? 'да' : 'нет'}</td>
              <td className="actions">
                <button type="button" onClick={() => void run(() => admin.setActive(u.id, !u.active))}>
                  {u.active ? 'Заблокировать' : 'Разблокировать'}
                </button>
                <button type="button" onClick={() => resetPassword(u)}>Сменить пароль</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table></TableWrap>
      <form className="card inline" onSubmit={create}>
        <Field label="Логин"><input value={form.username} required minLength={3} maxLength={50} onChange={(e) => setForm({ ...form, username: e.target.value })} /></Field>
        <Field label="Пароль"><input type="password" value={form.password} required minLength={8} maxLength={72} autoComplete="new-password" onChange={(e) => setForm({ ...form, password: e.target.value })} /></Field>
        <Field label="ФИО"><input value={form.fullName} required maxLength={150} onChange={(e) => setForm({ ...form, fullName: e.target.value })} /></Field>
        <Field label="Эл. почта"><input type="email" value={form.email} maxLength={150} onChange={(e) => setForm({ ...form, email: e.target.value })} /></Field>
        <Field label="Роль">
          <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value as Role })}>
            {ALL_ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
          </select>
        </Field>
        <button type="submit" className="primary">Создать</button>
      </form>

      <h2>Справочники (просмотр)</h2>
      <p className="note">Изменение справочников доступно через REST API (/api/directory/…), см. документацию OpenAPI.</p>
      <div className="grid">
        <TableWrap><table>
          <caption>Таблица. Категории номеров</caption>
          <thead><tr><th>Название</th><th>Мест в номере</th></tr></thead>
          <tbody>{categories.map((c) => <tr key={c.id}><td>{c.name}</td><td>{c.capacityTotal}</td></tr>)}</tbody>
        </table></TableWrap>
        <TableWrap><table>
          <caption>Таблица. Каналы продаж</caption>
          <thead><tr><th>Канал</th><th>Комиссия, %</th></tr></thead>
          <tbody>{channels.map((c) => <tr key={c.id}><td>{c.name}</td><td>{c.commissionPct}</td></tr>)}</tbody>
        </table></TableWrap>
        <TableWrap><table>
          <caption>Таблица. Процедуры</caption>
          <thead><tr><th>Название</th><th>Минут</th></tr></thead>
          <tbody>{procedures.map((p) => <tr key={p.id}><td>{p.name}</td><td>{p.durationMin}</td></tr>)}</tbody>
        </table></TableWrap>
        <TableWrap><table>
          <caption>Таблица. Состояния здоровья</caption>
          <thead><tr><th>Код</th><th>Название</th></tr></thead>
          <tbody>{conditions.map((c) => <tr key={c.id}><td>{c.code}</td><td>{c.name}</td></tr>)}</tbody>
        </table></TableWrap>
      </div>

      <h2>Журнал действий</h2>
      <TableWrap><table>
        <caption>Таблица. Журнал действий (страница {auditPage + 1})</caption>
        <thead><tr><th>Время</th><th>Пользователь</th><th>Действие</th><th>Объект</th><th>Детали</th></tr></thead>
        <tbody>
          {audit.length === 0 && <tr><td className="empty" colSpan={5}>Записей нет</td></tr>}
          {audit.map((a) => (
            <tr key={a.id}>
              <td>{formatDateTime(a.createdAt)}</td><td>{a.username ?? '—'}</td><td>{a.action}</td><td>{a.entity}</td><td className="wrap">{a.details ?? ''}</td>
            </tr>
          ))}
        </tbody>
      </table></TableWrap>
      <div className="row">
        <button type="button" disabled={auditPage === 0} onClick={() => setAuditPage((p) => p - 1)}>Назад</button>
        <button type="button" disabled={audit.length < 50} onClick={() => setAuditPage((p) => p + 1)}>Вперёд</button>
      </div>
    </section>
  );
}
