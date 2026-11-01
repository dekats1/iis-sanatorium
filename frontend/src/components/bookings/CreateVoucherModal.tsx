import type { FormEvent } from 'react';
import { Button, ErrorBox, Field, Modal } from '../ui';
import { Icon } from '../icons';
import type { ClientView, Coded, Customer, RoomCategory, SalesChannel } from '../../types';

export interface VoucherForm {
  clientId: string;
  categoryId: string;
  profileId: string;
  channelId: string;
  dietId: string;
  customerId: string;
  checkIn: string;
  checkOut: string;
  places: number;
}

/** Проверка формы оформления путёвки (те же правила, что и раньше на странице). */
export function validateVoucherForm(form: VoucherForm, categories: RoomCategory[]) {
  const chosenCategory = categories.find((c) => String(c.id) === form.categoryId) ?? null;
  const capacityExceeded = chosenCategory !== null && form.places > chosenCategory.capacityTotal;
  const valid =
    Boolean(form.clientId) &&
    Boolean(form.categoryId) &&
    Boolean(form.profileId) &&
    Boolean(form.channelId) &&
    Boolean(form.checkIn) &&
    Boolean(form.checkOut) &&
    form.checkOut > form.checkIn &&
    form.places >= 1 &&
    !capacityExceeded;
  return { chosenCategory, capacityExceeded, valid };
}

const FORM_ID = 'bk-create-voucher-form';

export default function CreateVoucherModal({
  isOpen,
  onClose,
  form,
  onChange,
  onSubmit,
  onCreateClient,
  clientList,
  categories,
  profiles,
  diets,
  channels,
  customers,
  busy,
  error,
}: {
  isOpen: boolean;
  onClose: () => void;
  form: VoucherForm;
  onChange: (patch: Partial<VoucherForm>) => void;
  onSubmit: () => void;
  onCreateClient: () => void;
  clientList: ClientView[];
  categories: RoomCategory[];
  profiles: Coded[];
  diets: Coded[];
  channels: SalesChannel[];
  customers: Customer[];
  busy: boolean;
  error: unknown;
}) {
  const { chosenCategory, capacityExceeded, valid } = validateVoucherForm(form, categories);
  const datesInvalid = Boolean(form.checkIn && form.checkOut) && form.checkOut <= form.checkIn;

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!valid) return;
    onSubmit();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Оформление новой путёвки"
      size="md"
      footer={
        <>
          <Button type="button" variant="secondary" onClick={onClose}>
            Отмена
          </Button>
          <Button type="submit" form={FORM_ID} variant="primary" disabled={!valid} loading={busy} icon={<Icon name="ticket" size={18} />}>
            Оформить путёвку
          </Button>
        </>
      }
    >
      <form id={FORM_ID} onSubmit={submit} noValidate>
        <ErrorBox error={error} />
        <div className="bk-form-head">
          <span className="u-muted-sm">Выберите существующего гостя или создайте нового</span>
          <Button type="button" variant="link" size="sm" icon={<Icon name="plus" size={16} />} onClick={onCreateClient}>
            Создать гостя
          </Button>
        </div>

        <Field label="Гость (Клиент)" required hint={!form.clientId ? 'Необходимо выбрать клиента' : undefined}>
          <select value={form.clientId} onChange={(e) => onChange({ clientId: e.target.value })} required>
            <option value="">— Выберите гостя из базы —</option>
            {clientList.map((c) => (
              <option key={c.id} value={c.id}>
                {c.lastName} {c.firstName} {c.middleName ?? ''} ({c.phone || c.birthDate || `#${c.id}`})
              </option>
            ))}
          </select>
        </Field>

        <Field
          label="Категория номера"
          required
          hint={chosenCategory ? `Максимум ${chosenCategory.capacityTotal} мест в номере` : undefined}
        >
          <select value={form.categoryId} onChange={(e) => onChange({ categoryId: e.target.value })} required>
            <option value="">— Выберите категорию номера —</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} (до {c.capacityTotal} чел.)
              </option>
            ))}
          </select>
        </Field>

        <div className="form-grid-2">
          <Field label="Дата заезда" required>
            <input type="date" value={form.checkIn} onChange={(e) => onChange({ checkIn: e.target.value })} required />
          </Field>
          <Field label="Дата выезда" required error={datesInvalid ? 'Дата выезда должна быть позже даты заезда' : undefined}>
            <input type="date" value={form.checkOut} onChange={(e) => onChange({ checkOut: e.target.value })} required />
          </Field>
        </div>

        <div className="form-grid-2">
          <Field
            label="Количество мест"
            required
            error={capacityExceeded ? `Превышена вместимость категории (${chosenCategory?.capacityTotal})` : undefined}
          >
            <input
              type="number"
              min={1}
              max={chosenCategory ? chosenCategory.capacityTotal : 10}
              value={form.places}
              onChange={(e) => onChange({ places: Number(e.target.value) })}
              required
            />
          </Field>
          <Field label="Канал продаж" required>
            <select value={form.channelId} onChange={(e) => onChange({ channelId: e.target.value })} required>
              {channels.map((ch) => (
                <option key={ch.id} value={ch.id}>
                  {ch.name} ({ch.commissionPct}%)
                </option>
              ))}
            </select>
          </Field>
        </div>

        <div className="form-grid-2">
          <Field label="Лечебный профиль" required>
            <select value={form.profileId} onChange={(e) => onChange({ profileId: e.target.value })} required>
              {profiles.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="План питания (Диета)">
            <select value={form.dietId} onChange={(e) => onChange({ dietId: e.target.value })}>
              <option value="">— По умолчанию (Обычный стол) —</option>
              {diets.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name} ({d.code})
                </option>
              ))}
            </select>
          </Field>
        </div>

        {customers.length > 0 && (
          <Field label="Корпоративный заказчик (B2B)">
            <select value={form.customerId} onChange={(e) => onChange({ customerId: e.target.value })}>
              <option value="">— Индивидуальный клиент —</option>
              {customers.map((cust) => (
                <option key={cust.id} value={cust.id}>
                  {cust.name} {cust.contractNo ? `(дог. ${cust.contractNo})` : ''}
                </option>
              ))}
            </select>
          </Field>
        )}
      </form>
    </Modal>
  );
}
