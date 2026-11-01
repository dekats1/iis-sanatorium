import { useState, type FormEvent } from 'react';
import { packages } from '../../api/endpoints';
import { Badge, Button, Card, EmptyState, ErrorBox, Field, Modal, money, Skeleton, useConfirm, useToast } from '../ui';
import { Icon } from '../icons';
import type { RoomCategory, SanatoriumPackage } from '../../types';

const EMPTY_FORM = {
  name: '',
  description: '',
  categoryId: 1,
  profileId: 1,
  durationNights: 10,
  basePrice: 1200,
  packagePrice: 1020,
  badge: 'Новинка',
};

export default function PackagesTab({
  list,
  onListChange,
  categories,
  loading,
}: {
  list: SanatoriumPackage[];
  onListChange: (l: SanatoriumPackage[]) => void;
  categories: RoomCategory[];
  loading: boolean;
}) {
  const toast = useToast();
  const [ask, confirmDialog] = useConfirm();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [error, setError] = useState<unknown>(null);
  const [formError, setFormError] = useState<unknown>(null);
  const [busyId, setBusyId] = useState<number | null>(null);

  const discount = form.basePrice > 0 ? Math.round(((form.basePrice - form.packagePrice) / form.basePrice) * 100) : 0;

  async function handleSave(e: FormEvent) {
    e.preventDefault();
    setFormError(null);
    setSaving(true);
    try {
      const cat = categories.find((c) => c.id === Number(form.categoryId));
      const created = await packages.create({
        name: form.name,
        description: form.description,
        categoryId: Number(form.categoryId),
        categoryName: cat?.name ?? 'Стандарт',
        profileId: Number(form.profileId),
        profileName: 'Профиль оздоровления',
        durationNights: Number(form.durationNights),
        includedProcedures: [
          { procedureId: 1, procedureName: 'Минеральная ванна', sessions: 5 },
          { procedureId: 2, procedureName: 'Спелеотерапия', sessions: 6 },
        ],
        basePrice: Number(form.basePrice),
        packagePrice: Number(form.packagePrice),
        discountPercent: Math.max(0, discount),
        isActive: true,
        badge: form.badge || undefined,
      });
      onListChange(await packages.list());
      setOpen(false);
      setForm(EMPTY_FORM);
      toast.success(`Пакет «${created.name}» создан и опубликован.`);
    } catch (err) {
      setFormError(err);
    } finally {
      setSaving(false);
    }
  }

  async function handleToggle(id: number) {
    setError(null);
    setBusyId(id);
    try {
      await packages.toggleActive(id);
      onListChange(await packages.list());
    } catch (err) {
      setError(err);
    } finally {
      setBusyId(null);
    }
  }

  async function handleDelete(pkg: SanatoriumPackage) {
    if (!(await ask({ title: 'Удаление пакета', message: `Удалить оздоровительный пакет «${pkg.name}»? Действие нельзя отменить.`, confirmLabel: 'Удалить', danger: true }))) return;
    setError(null);
    try {
      await packages.remove(pkg.id);
      onListChange(await packages.list());
      toast.success('Пакет удалён.');
    } catch (err) {
      setError(err);
    }
  }

  const openModal = () => {
    setFormError(null);
    setOpen(true);
  };

  return (
    <>
      {confirmDialog}
      <Card
        title="Пакетные предложения"
        subtitle="Туры объединяют проживание, питание и курс процедур со специальной пакетной скидкой"
        actions={
          <Button variant="primary" icon={<Icon name="plus" size={18} />} onClick={openModal}>
            Создать пакет
          </Button>
        }
      >
        <ErrorBox error={error} />
        {loading ? (
          <div className="mgr-card-grid">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} height={260} />
            ))}
          </div>
        ) : list.length === 0 ? (
          <EmptyState
            title="Пакетов пока нет"
            description="Соберите первый пакет: категория номера, длительность и цена со скидкой."
            action={
              <Button variant="primary" icon={<Icon name="plus" size={18} />} onClick={openModal}>
                Создать пакет
              </Button>
            }
          />
        ) : (
          <ul className="mgr-card-grid">
            {list.map((pkg) => (
              <li key={pkg.id} className={`mgr-pkg ${pkg.isActive ? '' : 'is-hidden'}`}>
                <div className="mgr-pkg-head">
                  <h4>{pkg.name}</h4>
                  {pkg.badge && <Badge variant="info" icon="sparkles">{pkg.badge}</Badge>}
                </div>
                <div className="chip-row">
                  <Badge variant="neutral" icon="calendar">{pkg.durationNights} ночей</Badge>
                  <Badge variant="neutral" icon="bed">{pkg.categoryName}</Badge>
                  <Badge variant={pkg.isActive ? 'good' : 'bad'} icon={pkg.isActive ? 'eye' : 'lock'}>
                    {pkg.isActive ? 'Активен' : 'Скрыт'}
                  </Badge>
                </div>
                <p className="mgr-pkg-desc">{pkg.description}</p>
                <div>
                  <div className="mgr-label">Процедуры курса</div>
                  <ul className="mgr-proc-list">
                    {pkg.includedProcedures.map((it, idx) => (
                      <li key={idx}>
                        <Icon name="check" size={16} />
                        {it.procedureName} — {it.sessions} сеансов
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="mgr-pkg-foot">
                  <div>
                    <div className="mgr-price-old">{money(pkg.basePrice)}</div>
                    <div className="mgr-price">{money(pkg.packagePrice)}</div>
                    <div className="u-ok u-semibold u-text-sm">Скидка {pkg.discountPercent}%</div>
                  </div>
                  <div className="u-inline-gap">
                    <Button variant="outline" size="sm" icon={<Icon name={pkg.isActive ? 'lock' : 'eye'} size={16} />} loading={busyId === pkg.id} onClick={() => void handleToggle(pkg.id)}>
                      {pkg.isActive ? 'Скрыть' : 'Включить'}
                    </Button>
                    <Button variant="danger" size="sm" icon={<Icon name="trash" size={16} />} aria-label={`Удалить пакет «${pkg.name}»`} onClick={() => void handleDelete(pkg)} />
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Modal
        isOpen={open}
        onClose={() => setOpen(false)}
        title="Новый оздоровительный пакет"
        size="md"
        footer={
          <>
            <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
              Отмена
            </Button>
            <Button type="submit" form="mgr-package-form" variant="primary" loading={saving}>
              Опубликовать пакет
            </Button>
          </>
        }
      >
        <form id="mgr-package-form" onSubmit={(e) => void handleSave(e)}>
          <Field label="Название пакета" required>
            <input value={form.name} required placeholder="Здоровое сердце (Премиум)" onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </Field>
          <Field label="Описание и назначение" required>
            <textarea rows={3} required placeholder="Опишите оздоровительное воздействие программы" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </Field>
          <div className="form-grid-2">
            <Field label="Категория номера" required>
              <select value={form.categoryId} onChange={(e) => setForm({ ...form, categoryId: Number(e.target.value) })}>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Длительность (ночей)" required>
              <input type="number" min={3} max={30} value={form.durationNights} required onChange={(e) => setForm({ ...form, durationNights: Number(e.target.value) })} />
            </Field>
            <Field label="Цена по отдельности, BYN" required>
              <input type="number" min={100} value={form.basePrice} required onChange={(e) => setForm({ ...form, basePrice: Number(e.target.value) })} />
            </Field>
            <Field label="Пакетная цена, BYN" required hint={discount > 0 ? `Скидка ${discount}%` : undefined}>
              <input type="number" min={50} value={form.packagePrice} required onChange={(e) => setForm({ ...form, packagePrice: Number(e.target.value) })} />
            </Field>
          </div>
          <Field label="Промо-бейдж" hint="Например: Хит продаж, Выгода 15%">
            <input value={form.badge} placeholder="Хит сезона" onChange={(e) => setForm({ ...form, badge: e.target.value })} />
          </Field>
          <ErrorBox error={formError} />
        </form>
      </Modal>
    </>
  );
}
