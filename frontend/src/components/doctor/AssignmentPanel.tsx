import { useEffect, useState, type FormEvent } from 'react';
import { ApiError } from '../../api/client';
import { medical } from '../../api/endpoints';
import { DataTable, type Column } from '../DataTable';
import {
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorBox,
  Field,
  formatDateTime,
  Notice,
  Skeleton,
  SkeletonRows,
  today,
  useToast,
} from '../ui';
import { Icon } from '../icons';
import type { AssignmentItem, AssignmentView, ContraindicationWarning, Procedure, ScheduleEntry } from '../../types';

interface PatientOption {
  voucherId: number;
  clientName: string;
  sessions: number;
}

const scheduleColumns: Column<ScheduleEntry>[] = [
  {
    key: 'slot',
    header: 'Время сеанса',
    render: (s) => <span className="u-semibold">{formatDateTime(s.slot)}</span>,
    sortValue: (s) => s.slot,
  },
  { key: 'procedure', header: 'Процедура', render: (s) => s.procedure, sortValue: (s) => s.procedure },
  { key: 'cabinet', header: 'Кабинет', render: (s) => s.cabinet, sortValue: (s) => s.cabinet },
  {
    key: 'done',
    header: 'Статус',
    render: (s) => (
      <Badge variant={s.done ? 'good' : 'wait'} icon={s.done ? 'checkCircle' : 'clock'}>
        {s.done ? 'Выполнено' : 'Запланировано'}
      </Badge>
    ),
    sortValue: (s) => (s.done ? 1 : 0),
  },
];

/** Назначения по путёвке: поиск, новое назначение с контролем противопоказаний и составление расписания. */
export function AssignmentPanel({ procedures, proceduresLoading }: { procedures: Procedure[]; proceduresLoading: boolean }) {
  const toast = useToast();
  const [voucherId, setVoucherId] = useState('');
  const [loadedVoucher, setLoadedVoucher] = useState<number | null>(null);
  const [assignments, setAssignments] = useState<AssignmentView[]>([]);
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<AssignmentItem[] | null>(null);
  const [warnings, setWarnings] = useState<ContraindicationWarning[]>([]);
  const [createdId, setCreatedId] = useState<number | null>(null);
  const [schedule, setSchedule] = useState<{ assignmentId: number; entries: ScheduleEntry[] } | null>(null);
  const [planningId, setPlanningId] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [formError, setFormError] = useState<unknown>(null);

  // Пациенты для быстрого выбора: из расписания процедур на неделю (отдельного списка заселённых у врача нет).
  const [patients, setPatients] = useState<PatientOption[] | null>(null);
  useEffect(() => {
    let alive = true;
    void Promise.allSettled(Array.from({ length: 7 }, (_, i) => medical.day(today(i)))).then((results) => {
      if (!alive) return;
      const byVoucher = new Map<number, PatientOption>();
      for (const r of results) {
        if (r.status !== 'fulfilled') continue;
        for (const s of r.value) {
          const cur = byVoucher.get(s.voucherId);
          if (cur) cur.sessions += 1;
          else byVoucher.set(s.voucherId, { voucherId: s.voucherId, clientName: s.clientName, sessions: 1 });
        }
      }
      setPatients([...byVoucher.values()].sort((a, b) => a.clientName.localeCompare(b.clientName, 'ru')));
    });
    return () => {
      alive = false;
    };
  }, []);

  const defaultItem = (): AssignmentItem => ({ procedureId: procedures[0]?.id ?? 0, sessions: 5 });
  // Пока справочник процедур не загружен, строка формы берёт первую процедуру по умолчанию.
  const rows = items ?? [defaultItem()];

  async function loadAssignments(id: number) {
    setError(null);
    setLoading(true);
    try {
      setAssignments(await medical.byVoucher(id));
      setLoadedVoucher(id);
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  }

  async function find(e: FormEvent) {
    e.preventDefault();
    if (!voucherId) return;
    setCreatedId(null);
    setWarnings([]);
    setSchedule(null);
    setFormError(null);
    await loadAssignments(Number(voucherId));
  }

  async function assign(confirm: boolean) {
    if (loadedVoucher === null) return;
    setFormError(null);
    setCreatedId(null);
    if (rows.some((it) => !it.procedureId)) {
      setFormError(new Error('Выберите процедуру'));
      return;
    }
    setSaving(true);
    try {
      const created = await medical.create({ voucherId: loadedVoucher, items: rows, confirmContraindications: confirm });
      setWarnings([]);
      setCreatedId(created.id);
      setItems(null);
      await loadAssignments(loadedVoucher);
    } catch (err) {
      if (err instanceof ApiError && err.status === 409 && err.warnings.length > 0) {
        setWarnings(err.warnings);
      } else {
        setFormError(err);
      }
    } finally {
      setSaving(false);
    }
  }

  async function plan(a: AssignmentView) {
    setError(null);
    setPlanningId(a.id);
    try {
      const res = await medical.plan(a.id);
      setSchedule({ assignmentId: a.id, entries: res });
      toast.success(`Расписание для назначения № ${a.id} составлено (${res.length} сеансов)`);
    } catch (err) {
      setError(err);
    } finally {
      setPlanningId(null);
    }
  }

  const setItem = (i: number, patch: Partial<AssignmentItem>) =>
    setItems(rows.map((it, idx) => (idx === i ? { ...it, ...patch } : it)));

  return (
    <div className="u-stack-16">
      <Card>
        <form className="inline inline-top" onSubmit={find}>
          <Field
            label="Пациент из расписания"
            hint={patients && patients.length === 0 ? 'На ближайшую неделю сеансов нет — введите номер вручную' : 'Сеансы на 7 дней вперёд'}
            className="dc-patient-field"
          >
            {patients === null ? (
              <Skeleton height={44} />
            ) : (
              <select
                value={patients.some((p) => String(p.voucherId) === voucherId) ? voucherId : ''}
                disabled={patients.length === 0}
                onChange={(e) => {
                  if (e.target.value) setVoucherId(e.target.value);
                }}
              >
                <option value="">— Выберите пациента —</option>
                {patients.map((p) => (
                  <option key={p.voucherId} value={p.voucherId}>
                    {p.clientName} — путёвка № {p.voucherId} ({p.sessions} сеанс.)
                  </option>
                ))}
              </select>
            )}
          </Field>
          <Field label="Номер путёвки" hint="Подставляется при выборе пациента" className="dc-voucher-field">
            <input
              type="number"
              min={1}
              inputMode="numeric"
              value={voucherId}
              onChange={(e) => setVoucherId(e.target.value)}
              placeholder="Например, 1"
              required
            />
          </Field>
          <Button type="submit" variant="primary" icon={<Icon name="search" size={18} />} loading={loading}>
            Показать назначения
          </Button>
        </form>
      </Card>

      <ErrorBox error={error} />

      {loadedVoucher === null && !loading && (
        <Card>
          <EmptyState
            icon={<Icon name="clipboard" size={40} />}
            title="Выберите пациента"
            description="Укажите пациента из расписания или номер путёвки, чтобы увидеть назначения и добавить новые процедуры."
          />
        </Card>
      )}

      {loadedVoucher !== null && (
        <div className="dc-assign-layout">
          <Card
            title="Новое назначение"
            subtitle={`Путёвка № ${loadedVoucher}: процедуры и количество сеансов`}
            className="dc-assign-form"
          >
            {proceduresLoading ? (
              <div className="u-stack-12">
                <Skeleton height={44} />
                <Skeleton height={44} width="60%" />
              </div>
            ) : (
              <form
                className="u-stack-12"
                onSubmit={(e) => {
                  e.preventDefault();
                  void assign(false);
                }}
              >
                {rows.map((it, i) => (
                  <div key={i} className="dc-proc-row">
                    <Field label={`Процедура ${rows.length > 1 ? i + 1 : ''}`.trim()} className="dc-proc-select">
                      <select value={it.procedureId} onChange={(e) => setItem(i, { procedureId: Number(e.target.value) })}>
                        {procedures.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name} ({p.durationMin} мин)
                          </option>
                        ))}
                      </select>
                    </Field>
                    <Field label="Сеансов" className="dc-proc-count">
                      <input
                        type="number"
                        min={1}
                        max={30}
                        value={it.sessions}
                        onChange={(e) => setItem(i, { sessions: Number(e.target.value) })}
                      />
                    </Field>
                    {rows.length > 1 && (
                      <button
                        type="button"
                        className="icon-btn dc-proc-remove"
                        aria-label={`Убрать процедуру ${i + 1}`}
                        onClick={() => setItems(rows.filter((_, idx) => idx !== i))}
                      >
                        <Icon name="trash" size={18} />
                      </button>
                    )}
                  </div>
                ))}

                <div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    icon={<Icon name="plus" size={16} />}
                    onClick={() => setItems([...rows, defaultItem()])}
                  >
                    Добавить процедуру
                  </Button>
                </div>

                {warnings.length > 0 && (
                  <div className="dc-alert" role="alert">
                    <div className="dc-alert-title">
                      <Icon name="alertTriangle" size={18} />
                      <span>Обнаружены противопоказания:</span>
                    </div>
                    <ul className="dc-alert-list">
                      {warnings.map((w) => (
                        <li key={`${w.procedureId}-${w.conditionId}`}>
                          <strong>{w.procedure}</strong> — противопоказана при состоянии «{w.condition}»
                        </li>
                      ))}
                    </ul>
                    <Button variant="danger" size="sm" type="button" loading={saving} onClick={() => void assign(true)}>
                      Назначить несмотря на противопоказания
                    </Button>
                  </div>
                )}

                <ErrorBox error={formError} />
                {createdId !== null && <Notice tone="success">Назначение № {createdId} создано</Notice>}

                <div className="row row-end">
                  <Button type="submit" variant="primary" loading={saving && warnings.length === 0} icon={<Icon name="check" size={18} />}>
                    Назначить
                  </Button>
                </div>
              </form>
            )}
          </Card>

          <section className="dc-assign-list" aria-label={`Назначения по путёвке № ${loadedVoucher}`}>
            <h2 className="dc-section-title">Назначения по путёвке № {loadedVoucher}</h2>
            {loading && assignments.length === 0 ? (
              <SkeletonRows rows={3} />
            ) : assignments.length === 0 ? (
              <Card>
                <EmptyState
                  icon={<Icon name="clipboard" size={40} />}
                  title="Назначений пока нет"
                  description="Выберите процедуры в форме «Новое назначение» и нажмите «Назначить»."
                />
              </Card>
            ) : (
              <div className="u-stack-12">
                {assignments.map((a) => (
                  <Card
                    key={a.id}
                    title={`Назначение № ${a.id}`}
                    subtitle={`Создано ${formatDateTime(a.createdAt)}`}
                    actions={
                      <Button
                        variant={schedule?.assignmentId === a.id ? 'secondary' : 'primary'}
                        size="sm"
                        icon={<Icon name="calendar" size={16} />}
                        loading={planningId === a.id}
                        onClick={() => void plan(a)}
                      >
                        Составить расписание
                      </Button>
                    }
                    className="dc-assign-card"
                  >
                    <ul className="dc-proc-list">
                      {a.items.map((it) => (
                        <li key={it.procedureId}>
                          <span>{it.procedure}</span>
                          <Badge variant="neutral">{it.sessionsPlanned} сеанс.</Badge>
                        </li>
                      ))}
                    </ul>
                  </Card>
                ))}
              </div>
            )}
          </section>
        </div>
      )}

      {schedule && (
        <Card title="График процедур" subtitle="Временные слоты и распределение по кабинетам">
          <DataTable
            rows={schedule.entries}
            columns={scheduleColumns}
            rowKey={(s) => s.id}
            caption={`Расписание сеансов назначения № ${schedule.assignmentId}`}
            initialSort={{ key: 'slot', dir: 'asc' }}
            emptyTitle="Свободных слотов не найдено"
            emptyDescription="Попробуйте составить расписание позже или уменьшите число сеансов."
          />
        </Card>
      )}
    </div>
  );
}
