import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { admin, directory } from '../api/endpoints';
import { Badge, Button, Card, ErrorBox, Field, formatDateTime, Modal, useConfirm, useToast } from '../components/ui';
import { DataTable, type Column } from '../components/DataTable';
import { Icon } from '../components/icons';
import type { AuditRow, Coded, Procedure, Role, RoomCategory, SalesChannel, UserRow } from '../types';

const ALL_ROLES: Role[] = ['CLIENT', 'BOOKING_ADMIN', 'DOCTOR', 'MANAGER', 'SYSADMIN'];

const ROLE_NAMES: Record<Role, string> = {
  CLIENT: 'Клиент',
  BOOKING_ADMIN: 'Бронирование',
  DOCTOR: 'Врач',
  MANAGER: 'Менеджер',
  SYSADMIN: 'Сисадмин',
};

const AUDIT_PAGE = 50;

const AUDIT_COLUMNS: Column<AuditRow>[] = [
  { key: 'time', header: 'Время', render: (a) => formatDateTime(a.createdAt), sortValue: (a) => a.createdAt },
  { key: 'user', header: 'Пользователь', render: (a) => a.username ?? '—', sortValue: (a) => a.username },
  { key: 'action', header: 'Действие', render: (a) => <Badge variant="neutral">{a.action}</Badge>, sortValue: (a) => a.action },
  { key: 'entity', header: 'Объект', render: (a) => a.entity, sortValue: (a) => a.entity },
  { key: 'details', header: 'Детали', className: 'wrap', render: (a) => a.details ?? '' },
];

/** Администрирование: учётные записи и роли (ФТ-02), журнал действий (ФТ-20), просмотр справочников. */
export default function AdminPage() {
  const toast = useToast();
  const [ask, confirmDialog] = useConfirm();
  const [users, setUsers] = useState<UserRow[]>([]);
  const [usersLoading, setUsersLoading] = useState(true);
  const [audit, setAudit] = useState<AuditRow[]>([]);
  const [auditLoading, setAuditLoading] = useState(true);
  const [auditPage, setAuditPage] = useState(0);
  const [categories, setCategories] = useState<RoomCategory[]>([]);
  const [channels, setChannels] = useState<SalesChannel[]>([]);
  const [procedures, setProcedures] = useState<Procedure[]>([]);
  const [conditions, setConditions] = useState<Coded[]>([]);
  const [error, setError] = useState<unknown>(null);
  const [createError, setCreateError] = useState<unknown>(null);
  const [creating, setCreating] = useState(false);
  const [pwUser, setPwUser] = useState<UserRow | null>(null);
  const [pwValue, setPwValue] = useState('');
  const [form, setForm] = useState({ username: '', password: '', fullName: '', email: '', role: 'CLIENT' as Role });

  const loadUsers = useCallback(async () => {
    try {
      setUsers(await admin.users());
    } catch (err) {
      setError(err);
    } finally {
      setUsersLoading(false);
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
    setAuditLoading(true);
    admin.audit(auditPage).then(setAudit).catch(setError).finally(() => setAuditLoading(false));
  }, [auditPage]);

  async function run(fn: () => Promise<void>, done?: string) {
    setError(null);
    try {
      await fn();
      if (done) toast.success(done);
      await loadUsers();
    } catch (err) {
      setError(err);
    }
  }

  async function create(e: FormEvent) {
    e.preventDefault();
    setCreateError(null);
    setCreating(true);
    try {
      await admin.createUser({
        username: form.username, password: form.password, fullName: form.fullName,
        email: form.email || undefined, roles: [form.role],
      });
      setForm({ ...form, username: '', password: '', fullName: '', email: '' });
      toast.success('Пользователь создан');
      await loadUsers();
    } catch (err) {
      setCreateError(err);
    } finally {
      setCreating(false);
    }
  }

  function toggleRole(u: UserRow, role: Role) {
    const roles = u.roles.includes(role) ? u.roles.filter((r) => r !== role) : [...u.roles, role];
    if (roles.length === 0) {
      setError(new Error('У пользователя должна остаться хотя бы одна роль'));
      return;
    }
    void run(() => admin.setRoles(u.id, roles));
  }

  async function toggleActive(u: UserRow) {
    if (u.active) {
      const ok = await ask({
        title: 'Заблокировать пользователя?',
        message: <>Пользователь <strong>{u.username}</strong> не сможет войти в систему, пока его не разблокируют.</>,
        confirmLabel: 'Заблокировать',
        danger: true,
      });
      if (!ok) return;
    }
    await run(() => admin.setActive(u.id, !u.active), u.active ? `Пользователь ${u.username} заблокирован` : `Пользователь ${u.username} разблокирован`);
  }

  function resetPassword(u: UserRow) {
    setPwUser(u);
    setPwValue('');
  }

  async function submitPassword(e: FormEvent) {
    e.preventDefault();
    if (!pwUser) return;
    const target = pwUser;
    setPwUser(null);
    await run(() => admin.resetPassword(target.id, pwValue), 'Пароль изменён');
  }

  const userColumns: Column<UserRow>[] = [
    { key: 'username', header: 'Логин', render: (u) => <strong>{u.username}</strong>, sortValue: (u) => u.username },
    { key: 'fullName', header: 'ФИО', className: 'wrap', render: (u) => u.fullName, sortValue: (u) => u.fullName },
    {
      key: 'roles',
      header: 'Роли',
      render: (u) => (
        <div className="chip-row admin-roles" role="group" aria-label={`Роли пользователя ${u.username}`}>
          {ALL_ROLES.map((r) => {
            const on = u.roles.includes(r);
            return (
              <button key={r} type="button" className="chip" aria-pressed={on} title={r} onClick={() => toggleRole(u, r)}>
                {on && <Icon name="check" size={14} />} {ROLE_NAMES[r]}
              </button>
            );
          })}
        </div>
      ),
    },
    {
      key: 'active',
      header: 'Активен',
      render: (u) => (
        <Badge variant={u.active ? 'good' : 'bad'} icon={u.active ? 'checkCircle' : 'lock'}>{u.active ? 'Активен' : 'Заблокирован'}</Badge>
      ),
      sortValue: (u) => (u.active ? 1 : 0),
    },
    {
      key: 'actions',
      header: 'Действия',
      hideHeader: true,
      className: 'actions',
      render: (u) => (
        <>
          <Button size="sm" variant={u.active ? 'danger' : 'outline'} icon={<Icon name={u.active ? 'lock' : 'key'} size={16} />} onClick={() => void toggleActive(u)}>
            {u.active ? 'Заблокировать' : 'Разблокировать'}
          </Button>
          <Button size="sm" variant="outline" icon={<Icon name="key" size={16} />} onClick={() => resetPassword(u)}>Сменить пароль</Button>
        </>
      ),
    },
  ];

  return (
    <section>
      <div className="page-head">
        <div>
          <h1>Администрирование</h1>
          <p className="page-subtitle">Учётные записи, роли и журнал действий системы.</p>
        </div>
      </div>
      <ErrorBox error={error} />

      <Modal
        isOpen={pwUser !== null}
        onClose={() => setPwUser(null)}
        title="Смена пароля"
        size="sm"
        footer={<><Button variant="secondary" onClick={() => setPwUser(null)}>Отмена</Button><Button variant="primary" type="submit" form="pw-form">Сохранить пароль</Button></>}
      >
        <form id="pw-form" onSubmit={(e) => void submitPassword(e)}>
          <Field label={`Новый пароль для ${pwUser?.username ?? ''}`} hint="Не короче 8 символов" required>
            <input type="password" value={pwValue} onChange={(e) => setPwValue(e.target.value)} minLength={8} maxLength={72} required autoComplete="new-password" data-autofocus />
          </Field>
        </form>
      </Modal>

      <h2>Пользователи</h2>
      <Card>
        <DataTable
          rows={users}
          columns={userColumns}
          rowKey={(u) => u.id}
          caption="Таблица. Учётные записи и роли"
          searchText={(u) => `${u.username} ${u.fullName ?? ''} ${u.email ?? ''}`}
          searchPlaceholder="Поиск по логину или ФИО"
          loading={usersLoading}
          initialSort={{ key: 'username', dir: 'asc' }}
          emptyTitle="Пользователи не найдены"
        />
      </Card>

      <Card title="Новый пользователь" subtitle="Учётная запись создаётся с одной ролью; дополнительные роли назначаются в таблице выше">
        <ErrorBox error={createError} />
        <form onSubmit={(e) => void create(e)}>
          <div className="form-grid">
            <Field label="Логин" hint="От 3 до 50 символов" required><input value={form.username} required minLength={3} maxLength={50} autoComplete="off" disabled={creating} onChange={(e) => setForm({ ...form, username: e.target.value })} /></Field>
            <Field label="Пароль" hint="Не короче 8 символов" required><input type="password" value={form.password} required minLength={8} maxLength={72} autoComplete="new-password" disabled={creating} onChange={(e) => setForm({ ...form, password: e.target.value })} /></Field>
            <Field label="ФИО" required><input value={form.fullName} required maxLength={150} disabled={creating} onChange={(e) => setForm({ ...form, fullName: e.target.value })} /></Field>
            <Field label="Эл. почта" hint="Необязательно"><input type="email" value={form.email} maxLength={150} disabled={creating} onChange={(e) => setForm({ ...form, email: e.target.value })} /></Field>
            <Field label="Роль">
              <select value={form.role} disabled={creating} onChange={(e) => setForm({ ...form, role: e.target.value as Role })}>
                {ALL_ROLES.map((r) => <option key={r} value={r}>{ROLE_NAMES[r]} ({r})</option>)}
              </select>
            </Field>
          </div>
          <div className="row row-end">
            <Button type="submit" variant="primary" loading={creating} icon={<Icon name="plus" size={18} />}>Создать</Button>
          </div>
        </form>
      </Card>

      <h2>Справочники (просмотр)</h2>
      <p className="note">Изменение справочников доступно через REST API (/api/directory/…), см. документацию OpenAPI.</p>
      <div className="admin-dir-grid">
        <Card>
          <DataTable rows={categories} rowKey={(c) => c.id} caption="Таблица. Категории номеров" pageSize={10} dense
            columns={[
              { key: 'name', header: 'Название', render: (c) => c.name, sortValue: (c) => c.name },
              { key: 'cap', header: 'Мест в номере', align: 'right', render: (c) => c.capacityTotal, sortValue: (c) => c.capacityTotal },
            ]} />
        </Card>
        <Card>
          <DataTable rows={channels} rowKey={(c) => c.id} caption="Таблица. Каналы продаж" pageSize={10} dense
            columns={[
              { key: 'name', header: 'Канал', render: (c) => c.name, sortValue: (c) => c.name },
              { key: 'pct', header: 'Комиссия, %', align: 'right', render: (c) => c.commissionPct, sortValue: (c) => c.commissionPct },
            ]} />
        </Card>
        <Card>
          <DataTable rows={procedures} rowKey={(p) => p.id} caption="Таблица. Процедуры" pageSize={10} dense
            columns={[
              { key: 'name', header: 'Название', render: (p) => p.name, sortValue: (p) => p.name },
              { key: 'min', header: 'Минут', align: 'right', render: (p) => p.durationMin, sortValue: (p) => p.durationMin },
            ]} />
        </Card>
        <Card>
          <DataTable rows={conditions} rowKey={(c) => c.id} caption="Таблица. Состояния здоровья" pageSize={10} dense
            columns={[
              { key: 'code', header: 'Код', render: (c) => c.code, sortValue: (c) => c.code },
              { key: 'name', header: 'Название', className: 'wrap', render: (c) => c.name, sortValue: (c) => c.name },
            ]} />
        </Card>
      </div>

      <h2>Журнал действий</h2>
      <Card>
        <DataTable
          rows={audit}
          columns={AUDIT_COLUMNS}
          rowKey={(a) => a.id}
          caption={`Таблица. Журнал действий (страница ${auditPage + 1})`}
          searchText={(a) => `${a.username ?? ''} ${a.action} ${a.entity} ${a.details ?? ''}`}
          searchPlaceholder="Поиск по журналу на этой странице"
          pageSize={AUDIT_PAGE}
          loading={auditLoading}
          emptyTitle="Записей нет"
          toolbar={
            <>
              <Button size="sm" variant="outline" icon={<Icon name="chevronLeft" size={16} />} disabled={auditPage === 0 || auditLoading} onClick={() => setAuditPage((p) => p - 1)}>Назад</Button>
              <Button size="sm" variant="outline" disabled={audit.length < AUDIT_PAGE || auditLoading} onClick={() => setAuditPage((p) => p + 1)}>
                Вперёд <Icon name="chevronRight" size={16} />
              </Button>
            </>
          }
        />
      </Card>
      {confirmDialog}
    </section>
  );
}
