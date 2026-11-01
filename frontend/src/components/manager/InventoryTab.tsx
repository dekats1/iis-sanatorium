import { useState, type FormEvent } from 'react';
import { inventory } from '../../api/endpoints';
import { Badge, Button, Card, ErrorBox, Field, Modal, StatCard, useToast } from '../ui';
import { DataTable, type Column } from '../DataTable';
import { Icon } from '../icons';
import type { ConsumableItem, StockStatus } from '../../types';
import { ShareBar } from './charts';

const STOCK: Record<StockStatus, { label: string; tone: 'good' | 'wait' | 'bad'; icon: 'checkCircle' | 'alertTriangle' | 'alertCircle'; bar: 'ok' | 'warn' | 'danger' }> = {
  IN_STOCK: { label: 'В норме', tone: 'good', icon: 'checkCircle', bar: 'ok' },
  LOW_STOCK: { label: 'Заканчивается', tone: 'wait', icon: 'alertTriangle', bar: 'warn' },
  CRITICAL: { label: 'Дефицит', tone: 'bad', icon: 'alertCircle', bar: 'danger' },
};

const EMPTY_ITEM = {
  sku: 'MED-NEW-01',
  name: '',
  category: 'Бальнеология',
  cabinetId: 1,
  cabinetName: 'Кабинет №1',
  unit: 'кг',
  stockQuantity: 50,
  minThreshold: 20,
};

export default function InventoryTab({ items, onItemsChange, loading }: { items: ConsumableItem[]; onItemsChange: (l: ConsumableItem[]) => void; loading: boolean }) {
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [item, setItem] = useState(EMPTY_ITEM);
  const [error, setError] = useState<unknown>(null);
  const [formError, setFormError] = useState<unknown>(null);
  const [busy, setBusy] = useState<string | null>(null);

  async function run(key: string, fn: () => Promise<unknown>, ok: string) {
    setError(null);
    setBusy(key);
    try {
      await fn();
      onItemsChange(await inventory.list());
      toast.success(ok);
    } catch (err) {
      setError(err);
    } finally {
      setBusy(null);
    }
  }

  async function handleAdd(e: FormEvent) {
    e.preventDefault();
    setFormError(null);
    setSaving(true);
    try {
      await inventory.add({
        sku: item.sku,
        name: item.name,
        category: item.category,
        cabinetId: Number(item.cabinetId),
        cabinetName: item.cabinetName,
        unit: item.unit,
        stockQuantity: Number(item.stockQuantity),
        minThreshold: Number(item.minThreshold),
      });
      onItemsChange(await inventory.list());
      setOpen(false);
      toast.success(`Позиция «${item.name}» добавлена на склад.`);
      setItem(EMPTY_ITEM);
    } catch (err) {
      setFormError(err);
    } finally {
      setSaving(false);
    }
  }

  const count = (s: StockStatus) => items.filter((i) => i.status === s).length;

  const columns: Column<ConsumableItem>[] = [
    { key: 'sku', header: 'Артикул', render: (i) => <code className="mgr-code">{i.sku}</code>, sortValue: (i) => i.sku },
    { key: 'name', header: 'Наименование', render: (i) => <strong>{i.name}</strong>, sortValue: (i) => i.name, className: 'wrap' },
    { key: 'category', header: 'Категория', render: (i) => i.category, sortValue: (i) => i.category },
    { key: 'cabinet', header: 'Кабинет', render: (i) => i.cabinetName, sortValue: (i) => i.cabinetName },
    {
      key: 'stock',
      header: 'Остаток',
      sortValue: (i) => i.stockQuantity,
      render: (i) => (
        <div className="mgr-stock">
          <span className="u-semibold">
            {i.stockQuantity} {i.unit}
          </span>
          <ShareBar value={i.minThreshold > 0 ? Math.min(100, (i.stockQuantity / (i.minThreshold * 2)) * 100) : 100} tone={STOCK[i.status].bar} label={`Остаток относительно порога ${i.minThreshold} ${i.unit}`} />
        </div>
      ),
    },
    { key: 'min', header: 'Мин. порог', align: 'right', render: (i) => `${i.minThreshold} ${i.unit}`, sortValue: (i) => i.minThreshold },
    {
      key: 'status',
      header: 'Статус',
      sortValue: (i) => (i.status === 'CRITICAL' ? 0 : i.status === 'LOW_STOCK' ? 1 : 2),
      render: (i) => (
        <Badge variant={STOCK[i.status].tone} icon={STOCK[i.status].icon}>
          {STOCK[i.status].label}
        </Badge>
      ),
    },
    {
      key: 'actions',
      header: 'Действия',
      hideHeader: true,
      className: 'actions',
      render: (i) => (
        <div className="mgr-row-actions">
          <Button variant="outline" size="sm" icon={<Icon name="plus" size={16} />} loading={busy === `r${i.id}`} title="Оприходовать партию +10" onClick={() => void run(`r${i.id}`, () => inventory.restock(i.id, 10), 'Партия оприходована на склад.')}>
            Приход 10
          </Button>
          <Button variant="secondary" size="sm" icon={<Icon name="minus" size={16} />} loading={busy === `w${i.id}`} title="Списать расход на процедуры −5" onClick={() => void run(`w${i.id}`, () => inventory.writeOff(i.id, 5), 'Расход материалов списан со склада.')}>
            Списать 5
          </Button>
        </div>
      ),
    },
  ];

  return (
    <>
      <div className="kpi-grid">
        <StatCard label="Всего наименований" value={items.length} color="c-blue" icon={<Icon name="package" size={20} />} />
        <StatCard label="В норме" value={count('IN_STOCK')} color="c-teal" icon={<Icon name="checkCircle" size={20} />} />
        <StatCard label="Низкий остаток" value={count('LOW_STOCK')} color="c-amber" icon={<Icon name="alertTriangle" size={20} />} />
        <StatCard label="Критический дефицит" value={count('CRITICAL')} color="c-red" icon={<Icon name="alertCircle" size={20} />} />
      </div>

      <Card
        title="Склад лечебных материалов и расходников"
        subtitle="Контроль остатков, пополнение запасов и списание"
        actions={
          <Button variant="primary" icon={<Icon name="plus" size={18} />} onClick={() => { setFormError(null); setOpen(true); }}>
            Добавить расходник
          </Button>
        }
      >
        <ErrorBox error={error} />
        <DataTable
          rows={items}
          columns={columns}
          rowKey={(i) => i.id}
          label="Складские остатки"
          loading={loading}
          searchText={(i) => `${i.sku} ${i.name} ${i.category} ${i.cabinetName}`}
          searchPlaceholder="Поиск по артикулу, названию, кабинету"
          initialSort={{ key: 'status', dir: 'asc' }}
          emptyTitle="Склад пуст"
          emptyDescription="Добавьте первую позицию расходных материалов."
        />
      </Card>

      <Modal
        isOpen={open}
        onClose={() => setOpen(false)}
        title="Новая позиция складского учёта"
        size="md"
        footer={
          <>
            <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
              Отмена
            </Button>
            <Button type="submit" form="mgr-inventory-form" variant="primary" loading={saving}>
              Добавить на склад
            </Button>
          </>
        }
      >
        <form id="mgr-inventory-form" onSubmit={(e) => void handleAdd(e)}>
          <div className="form-grid-2">
            <Field label="Артикул (SKU)" required>
              <input value={item.sku} required onChange={(e) => setItem({ ...item, sku: e.target.value })} />
            </Field>
            <Field label="Наименование материала" required>
              <input value={item.name} required placeholder="Парафин медицинский" onChange={(e) => setItem({ ...item, name: e.target.value })} />
            </Field>
            <Field label="Категория" required>
              <select value={item.category} onChange={(e) => setItem({ ...item, category: e.target.value })}>
                {['Бальнеология', 'Грязелечение', 'Массаж', 'Фитобар', 'Расходные материалы'].map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Единица измерения" required>
              <select value={item.unit} onChange={(e) => setItem({ ...item, unit: e.target.value })}>
                {['кг', 'л', 'шт', 'упак', 'рулон'].map((u) => (
                  <option key={u} value={u}>
                    {u}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Начальный остаток" required>
              <input type="number" min={0} value={item.stockQuantity} required onChange={(e) => setItem({ ...item, stockQuantity: Number(e.target.value) })} />
            </Field>
            <Field label="Минимальный запас" required>
              <input type="number" min={1} value={item.minThreshold} required onChange={(e) => setItem({ ...item, minThreshold: Number(e.target.value) })} />
            </Field>
          </div>
          <Field label="Кабинет расхода" required>
            <input value={item.cabinetName} required placeholder="Кабинет парафинолечения №7" onChange={(e) => setItem({ ...item, cabinetName: e.target.value })} />
          </Field>
          <ErrorBox error={formError} />
        </form>
      </Modal>
    </>
  );
}
