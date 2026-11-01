import { useCallback, useEffect, useState } from 'react';
import { medical } from '../../api/endpoints';
import { DataTable, type Column } from '../DataTable';
import { Badge, Button, Card, ErrorBox, Field, formatDateTime, StatCard, today, useToast } from '../ui';
import { Icon } from '../icons';
import type { ScheduleEntry } from '../../types';

/** Расписание процедурных кабинетов на выбранный день с отметкой выполнения. */
export function DaySchedule() {
  const toast = useToast();
  const [date, setDate] = useState(today());
  const [day, setDay] = useState<ScheduleEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [error, setError] = useState<unknown>(null);

  const loadDay = useCallback(async (d: string) => {
    setError(null);
    setLoading(true);
    try {
      setDay(await medical.day(d));
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadDay(date);
  }, [date, loadDay]);

  async function markDone(slotId: number) {
    setError(null);
    setBusyId(slotId);
    try {
      await medical.done(slotId);
      await loadDay(date);
      toast.success('Сеанс процедуры отмечен как выполненный.');
    } catch (err) {
      setError(err);
    } finally {
      setBusyId(null);
    }
  }

  const doneCount = day.filter((s) => s.done).length;

  const columns: Column<ScheduleEntry>[] = [
    {
      key: 'slot',
      header: 'Время',
      render: (s) => <span className="u-semibold">{formatDateTime(s.slot)}</span>,
      sortValue: (s) => s.slot,
    },
    { key: 'client', header: 'Пациент', render: (s) => s.clientName, sortValue: (s) => s.clientName },
    { key: 'voucher', header: 'Путёвка', render: (s) => `№ ${s.voucherId}`, sortValue: (s) => s.voucherId },
    { key: 'procedure', header: 'Процедура', render: (s) => s.procedure, sortValue: (s) => s.procedure },
    { key: 'cabinet', header: 'Кабинет', render: (s) => s.cabinet, sortValue: (s) => s.cabinet },
    {
      key: 'status',
      header: 'Статус',
      render: (s) => (
        <Badge variant={s.done ? 'good' : 'wait'} icon={s.done ? 'checkCircle' : 'clock'}>
          {s.done ? 'Выполнено' : 'Ожидает проведения'}
        </Badge>
      ),
      sortValue: (s) => (s.done ? 1 : 0),
    },
    {
      key: 'actions',
      header: 'Действия',
      hideHeader: true,
      align: 'right',
      className: 'actions',
      render: (s) =>
        s.done ? (
          <span className="u-ok u-semibold">Завершено</span>
        ) : (
          <Button
            variant="primary"
            size="sm"
            icon={<Icon name="check" size={16} />}
            loading={busyId === s.id}
            onClick={() => void markDone(s.id)}
          >
            Отметить выполнение
          </Button>
        ),
    },
  ];

  return (
    <div className="u-stack-16">
      <div className="kpi-grid u-m0">
        <StatCard label="Сеансов на день" value={loading ? '—' : day.length} color="c-blue" icon={<Icon name="calendar" size={20} />} />
        <StatCard label="Выполнено" value={loading ? '—' : doneCount} color="c-teal" icon={<Icon name="checkCircle" size={20} />} />
        <StatCard label="Ожидают проведения" value={loading ? '—' : day.length - doneCount} color="c-amber" icon={<Icon name="clock" size={20} />} />
      </div>

      <Card title="Расписание процедурных кабинетов на день" subtitle="Отметка посещений и выполнения назначений">
        <ErrorBox error={error} />
        <DataTable
          rows={day}
          columns={columns}
          rowKey={(s) => s.id}
          label="Расписание процедур на день"
          loading={loading}
          searchText={(s) => `${s.clientName} ${s.procedure} ${s.cabinet} ${s.voucherId}`}
          searchPlaceholder="Пациент, процедура, кабинет"
          initialSort={{ key: 'slot', dir: 'asc' }}
          emptyTitle="На выбранную дату сеансов не запланировано"
          emptyDescription="Выберите другую дату или составьте расписание по назначению."
          toolbar={
            <>
              <Field label="Дата" className="dc-date-field">
                <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
              </Field>
              <Button variant="outline" icon={<Icon name="refresh" size={18} />} onClick={() => void loadDay(date)}>
                Обновить
              </Button>
            </>
          }
        />
      </Card>
    </div>
  );
}
