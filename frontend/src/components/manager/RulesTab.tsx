import { useState, type FormEvent } from 'react';
import { pricing } from '../../api/endpoints';
import { Button, Card, ErrorBox, Field, formatDateTime, Modal, money, StatusBadge, today, useToast } from '../ui';
import { DataTable, type Column } from '../DataTable';
import { Icon } from '../icons';
import type { PriceReview, RoomCategory } from '../../types';

export type ReviewDecision = 'ACKNOWLEDGE' | 'RULE_ADJUSTED';

/** Таблица рекомендаций цены вне коридора с действиями по решению. */
export function PriceReviewsTable({
  reviews,
  categories,
  caption,
  loading,
  busyId,
  onDecide,
  paginate = true,
}: {
  reviews: PriceReview[];
  categories: RoomCategory[];
  caption: string;
  loading: boolean;
  busyId: number | null;
  onDecide: (id: number, action: ReviewDecision) => void;
  /** false — показывать все строки (короткий список «к решению»). */
  paginate?: boolean;
}) {
  const catName = (id: number) => categories.find((c) => c.id === id)?.name ?? `Категория № ${id}`;
  const columns: Column<PriceReview>[] = [
    { key: 'created', header: 'Создана', render: (r) => formatDateTime(r.created_at), sortValue: (r) => r.created_at },
    { key: 'cat', header: 'Категория', render: (r) => <strong>{catName(r.category_id)}</strong>, sortValue: (r) => catName(r.category_id) },
    { key: 'stay', header: 'Дата заезда', render: (r) => r.stay_date, sortValue: (r) => r.stay_date },
    { key: 'rec', header: 'Рекомендовано', align: 'right', render: (r) => <span className="u-accent u-semibold">{money(r.price_recommended)}</span>, sortValue: (r) => r.price_recommended },
    { key: 'app', header: 'Применено', align: 'right', render: (r) => money(r.price_applied), sortValue: (r) => r.price_applied },
    {
      key: 'delta',
      header: 'Разница',
      align: 'right',
      sortValue: (r) => r.price_recommended - r.price_applied,
      render: (r) => {
        const d = r.price_recommended - r.price_applied;
        return (
          <span className={`mgr-delta ${d >= 0 ? 'u-ok' : 'u-danger'}`}>
            <Icon name={d >= 0 ? 'trendUp' : 'trendDown'} size={16} />
            {d > 0 ? '+' : ''}
            {money(d)}
          </span>
        );
      },
    },
    { key: 'corridor', header: 'Коридор', render: (r) => `${money(r.p_min)} — ${money(r.p_max)}`, className: 'wrap' },
    { key: 'status', header: 'Статус', render: (r) => <StatusBadge status={r.status} />, sortValue: (r) => r.status },
    {
      key: 'actions',
      header: 'Действия',
      hideHeader: true,
      className: 'actions',
      render: (r) =>
        r.status === 'PENDING_REVIEW' ? (
          <div className="mgr-row-actions">
            <Button variant="primary" size="sm" icon={<Icon name="check" size={16} />} loading={busyId === r.id} onClick={() => onDecide(r.id, 'ACKNOWLEDGE')}>
              Принять к сведению
            </Button>
            <Button variant="secondary" size="sm" disabled={busyId === r.id} onClick={() => onDecide(r.id, 'RULE_ADJUSTED')}>
              Правила скорректированы
            </Button>
          </div>
        ) : r.decided_by ? (
          <span className="u-muted-sm">{r.decided_by}</span>
        ) : null,
    },
  ];

  return (
    <DataTable
      rows={reviews}
      columns={columns}
      rowKey={(r) => r.id}
      caption={caption}
      loading={loading}
      pageSize={paginate ? 20 : Math.max(20, reviews.length)}
      searchText={paginate ? (r) => `${catName(r.category_id)} ${r.stay_date} ${r.quote_id}` : undefined}
      searchPlaceholder="Поиск по категории или дате"
      initialSort={{ key: 'created', dir: 'desc' }}
      emptyTitle="Рекомендаций нет"
      emptyDescription="Все применённые цены укладываются в действующие ценовые коридоры."
    />
  );
}

export default function RulesTab({
  reviews,
  categories,
  categoryId,
  onCategoryChange,
  filter,
  onFilterChange,
  loading,
  busyId,
  onDecide,
  error,
}: {
  reviews: PriceReview[];
  categories: RoomCategory[];
  categoryId: string;
  onCategoryChange: (id: string) => void;
  filter: 'PENDING_REVIEW' | 'ALL';
  onFilterChange: (f: 'PENDING_REVIEW' | 'ALL') => void;
  loading: boolean;
  busyId: number | null;
  onDecide: (id: number, action: ReviewDecision) => void;
  error: unknown;
}) {
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<unknown>(null);
  const [rule, setRule] = useState({ from: today(), to: today(90), pMin: '', pMax: '', minLos: '1', closed: false });

  async function saveCorridor(e: FormEvent) {
    e.preventDefault();
    setFormError(null);
    const pMin = Number(rule.pMin);
    const pMax = Number(rule.pMax);
    if (pMin > pMax) {
      setFormError(new Error('Минимальная цена не может превышать максимальную.'));
      return;
    }
    if (rule.to < rule.from) {
      setFormError(new Error('Дата окончания периода не может быть раньше даты начала.'));
      return;
    }
    setSaving(true);
    try {
      await pricing.createCorridor({
        category_id: Number(categoryId),
        date_from: rule.from,
        date_to: rule.to,
        p_min: pMin,
        p_max: pMax,
        min_los: Number(rule.minLos),
        closed: rule.closed,
      });
      toast.success('Ценовой коридор сохранён и активирован.');
      setOpen(false);
    } catch (err) {
      setFormError(err);
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <Card
        title="Согласование рекомендаций цены"
        subtitle="Цены, рассчитанные вне действующего коридора, ждут решения менеджера"
        actions={
          <Button variant="primary" icon={<Icon name="plus" size={18} />} onClick={() => setOpen(true)}>
            Ценовой коридор
          </Button>
        }
      >
        <div className="chip-row u-mb-16" role="group" aria-label="Фильтр рекомендаций">
          <button type="button" className="chip" aria-pressed={filter === 'PENDING_REVIEW'} onClick={() => onFilterChange('PENDING_REVIEW')}>
            Требуют решения
          </button>
          <button type="button" className="chip" aria-pressed={filter === 'ALL'} onClick={() => onFilterChange('ALL')}>
            Все рекомендации
          </button>
        </div>
        <ErrorBox error={error} />
        <PriceReviewsTable
          reviews={reviews}
          categories={categories}
          caption={filter === 'PENDING_REVIEW' ? 'Рекомендации цены, ожидающие решения' : 'Все рекомендации цены'}
          loading={loading}
          busyId={busyId}
          onDecide={onDecide}
        />
      </Card>

      <Modal
        isOpen={open}
        onClose={() => setOpen(false)}
        title="Установка ценового коридора"
        size="md"
        footer={
          <>
            <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
              Отмена
            </Button>
            <Button type="submit" form="mgr-corridor-form" variant="primary" loading={saving}>
              Сохранить коридор
            </Button>
          </>
        }
      >
        <form id="mgr-corridor-form" onSubmit={(e) => void saveCorridor(e)}>
          <Field label="Категория номера" required>
            <select value={categoryId} onChange={(e) => onCategoryChange(e.target.value)} required>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </Field>
          <div className="form-grid-2">
            <Field label="Период с" required>
              <input type="date" value={rule.from} required onChange={(e) => setRule({ ...rule, from: e.target.value })} />
            </Field>
            <Field label="Период по" required>
              <input type="date" value={rule.to} required onChange={(e) => setRule({ ...rule, to: e.target.value })} />
            </Field>
            <Field label="Мин. цена (P_min), BYN" required>
              <input type="number" min={0} step="0.01" placeholder="50.00" value={rule.pMin} required onChange={(e) => setRule({ ...rule, pMin: e.target.value })} />
            </Field>
            <Field label="Макс. цена (P_max), BYN" required>
              <input type="number" min={0} step="0.01" placeholder="250.00" value={rule.pMax} required onChange={(e) => setRule({ ...rule, pMax: e.target.value })} />
            </Field>
            <Field label="Мин. срок проживания (Min LOS), ночей" required>
              <input type="number" min={1} value={rule.minLos} required onChange={(e) => setRule({ ...rule, minLos: e.target.value })} />
            </Field>
            <label className="check mgr-check">
              <input type="checkbox" checked={rule.closed} onChange={(e) => setRule({ ...rule, closed: e.target.checked })} />
              <span>Закрыть продажу на период</span>
            </label>
          </div>
          <ErrorBox error={formError} />
        </form>
      </Modal>
    </>
  );
}
