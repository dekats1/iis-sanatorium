import { useMemo, useState, type FormEvent } from 'react';
import { staff } from '../../api/endpoints';
import { Badge, Button, Card, EmptyState, ErrorBox, Field, Modal, SearchBar, Skeleton, StatCard, useToast } from '../ui';
import { Icon } from '../icons';
import type { StaffMember, StaffStatus } from '../../types';
import { ShareBar } from './charts';

const STATUS: Record<StaffStatus, { label: string; tone: 'good' | 'info' | 'bad'; icon: 'checkCircle' | 'sun' | 'heart' }> = {
  ON_SHIFT: { label: 'На смене', tone: 'good', icon: 'checkCircle' },
  VACATION: { label: 'В отпуске', tone: 'info', icon: 'sun' },
  SICK_LEAVE: { label: 'Больничный', tone: 'bad', icon: 'heart' },
};

const EMPTY_STAFF = {
  fullName: '',
  role: 'Врач-терапевт',
  cabinetName: 'Кабинет №10',
  shiftHours: '08:30 – 16:30',
  maxSlotsPerDay: 16,
  assignedSlotsToday: 10,
  rating: 4.9,
};

export default function StaffTab({ list, onListChange, loading }: { list: StaffMember[]; onListChange: (l: StaffMember[]) => void; loading: boolean }) {
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(EMPTY_STAFF);
  const [query, setQuery] = useState('');
  const [error, setError] = useState<unknown>(null);
  const [formError, setFormError] = useState<unknown>(null);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? list.filter((m) => `${m.fullName} ${m.role} ${m.cabinetName}`.toLowerCase().includes(q)) : list;
  }, [list, query]);

  const onShift = list.filter((m) => m.status === 'ON_SHIFT');
  const avgUtil = onShift.length > 0 ? onShift.reduce((s, m) => s + m.utilizationPercent, 0) / onShift.length : 0;
  const overloaded = onShift.filter((m) => m.utilizationPercent >= 90).length;

  async function changeStatus(id: number, st: StaffStatus) {
    setError(null);
    try {
      await staff.updateStatus(id, st);
      onListChange(await staff.list());
      toast.success('Статус сотрудника обновлён.');
    } catch (err) {
      setError(err);
    }
  }

  async function handleAdd(e: FormEvent) {
    e.preventDefault();
    setFormError(null);
    setSaving(true);
    try {
      await staff.add({
        fullName: form.fullName,
        role: form.role,
        cabinetName: form.cabinetName,
        shiftHours: form.shiftHours,
        status: 'ON_SHIFT',
        assignedSlotsToday: Number(form.assignedSlotsToday),
        maxSlotsPerDay: Number(form.maxSlotsPerDay),
        rating: Number(form.rating),
      });
      onListChange(await staff.list());
      setOpen(false);
      toast.success(`Сотрудник ${form.fullName} добавлен в график смен.`);
      setForm(EMPTY_STAFF);
    } catch (err) {
      setFormError(err);
    } finally {
      setSaving(false);
    }
  }

  const openModal = () => {
    setFormError(null);
    setOpen(true);
  };

  return (
    <>
      <div className="kpi-grid">
        <StatCard label="Сотрудников" value={list.length} color="c-blue" icon={<Icon name="users" size={20} />} />
        <StatCard label="На смене сегодня" value={onShift.length} color="c-teal" icon={<Icon name="checkCircle" size={20} />} />
        <StatCard label="Средняя загрузка смены" value={`${avgUtil.toFixed(0)}%`} color={avgUtil >= 90 ? 'c-red' : 'c-teal'} icon={<Icon name="pulse" size={20} />} />
        <StatCard label="Перегружены (≥ 90%)" value={overloaded} color={overloaded > 0 ? 'c-red' : 'default'} icon={<Icon name="alertTriangle" size={20} />} />
      </div>

      <Card
        title="Медицинский персонал и смены"
        subtitle="График смен, закреплённые кабинеты и занятость специалистов"
        actions={
          <Button variant="primary" icon={<Icon name="plus" size={18} />} onClick={openModal}>
            Новый сотрудник
          </Button>
        }
      >
        <div className="table-toolbar">
          <SearchBar value={query} onChange={setQuery} placeholder="Поиск по ФИО, должности, кабинету" label="Поиск сотрудника" />
          <span className="table-count">{shown.length === list.length ? `Всего: ${list.length}` : `Найдено: ${shown.length} из ${list.length}`}</span>
        </div>
        <ErrorBox error={error} />

        {loading ? (
          <div className="mgr-card-grid">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} height={220} />
            ))}
          </div>
        ) : shown.length === 0 ? (
          <EmptyState
            title={list.length === 0 ? 'Сотрудников пока нет' : 'Никого не найдено'}
            description={list.length === 0 ? 'Добавьте специалиста, чтобы планировать смены.' : 'Измените условия поиска.'}
            action={list.length === 0 ? <Button variant="primary" onClick={openModal}>Новый сотрудник</Button> : undefined}
          />
        ) : (
          <ul className="mgr-card-grid">
            {shown.map((m) => {
              const st = STATUS[m.status];
              const tone = m.utilizationPercent >= 90 ? 'danger' : m.utilizationPercent >= 60 ? 'ok' : 'warn';
              return (
                <li key={m.id} className="mgr-staff">
                  <div className="mgr-staff-head">
                    <div>
                      <h4>{m.fullName}</h4>
                      <div className="u-muted-sm">{m.role}</div>
                    </div>
                    <Badge variant={st.tone} icon={st.icon}>
                      {st.label}
                    </Badge>
                  </div>
                  <ul className="meta-list">
                    <li>
                      <Icon name="mapPin" size={16} /> {m.cabinetName}
                    </li>
                    <li>
                      <Icon name="clock" size={16} /> Смена: {m.shiftHours}
                    </li>
                    <li>
                      <Icon name="star" size={16} /> Рейтинг: <strong>{m.rating} / 5</strong>
                    </li>
                  </ul>
                  <div>
                    <div className="u-between u-text-sm">
                      <span>Загрузка сегодня</span>
                      <span className="u-semibold">
                        {m.assignedSlotsToday} / {m.maxSlotsPerDay} ({m.utilizationPercent}%)
                      </span>
                    </div>
                    <ShareBar value={m.utilizationPercent} tone={tone} label={`Загрузка ${m.fullName}`} />
                  </div>
                  <Field label="Статус" className="u-m0">
                    <select value={m.status} onChange={(e) => void changeStatus(m.id, e.target.value as StaffStatus)}>
                      <option value="ON_SHIFT">На смене</option>
                      <option value="VACATION">В отпуске</option>
                      <option value="SICK_LEAVE">Больничный</option>
                    </select>
                  </Field>
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      <Modal
        isOpen={open}
        onClose={() => setOpen(false)}
        title="Добавление сотрудника в график"
        size="md"
        footer={
          <>
            <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
              Отмена
            </Button>
            <Button type="submit" form="mgr-staff-form" variant="primary" loading={saving}>
              Сохранить сотрудника
            </Button>
          </>
        }
      >
        <form id="mgr-staff-form" onSubmit={(e) => void handleAdd(e)}>
          <Field label="ФИО сотрудника" required>
            <input value={form.fullName} required placeholder="Новикова Ирина Петровна" onChange={(e) => setForm({ ...form, fullName: e.target.value })} />
          </Field>
          <div className="form-grid-2">
            <Field label="Должность / специализация" required>
              <input value={form.role} required placeholder="Врач-физиотерапевт" onChange={(e) => setForm({ ...form, role: e.target.value })} />
            </Field>
            <Field label="Закреплённый кабинет" required>
              <input value={form.cabinetName} required placeholder="Кабинет №15" onChange={(e) => setForm({ ...form, cabinetName: e.target.value })} />
            </Field>
            <Field label="Часы смены" required>
              <input value={form.shiftHours} required placeholder="08:00 – 16:30" onChange={(e) => setForm({ ...form, shiftHours: e.target.value })} />
            </Field>
            <Field label="Максимум сеансов в день" required>
              <input type="number" min={1} max={30} value={form.maxSlotsPerDay} required onChange={(e) => setForm({ ...form, maxSlotsPerDay: Number(e.target.value) })} />
            </Field>
          </div>
          <ErrorBox error={formError} />
        </form>
      </Modal>
    </>
  );
}
