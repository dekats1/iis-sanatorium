import type { FormEvent } from 'react';
import { Button, ErrorBox, Field, Modal } from '../ui';
import { Icon } from '../icons';
import type { ClientRequest } from '../../types';

const FORM_ID = 'bk-new-client-form';

/** Модалка «Новая карточка гостя». */
export default function NewClientModal({
  isOpen,
  onClose,
  value,
  onChange,
  onSubmit,
  busy,
  error,
}: {
  isOpen: boolean;
  onClose: () => void;
  value: ClientRequest;
  onChange: (next: ClientRequest) => void;
  onSubmit: () => void;
  busy: boolean;
  error: unknown;
}) {
  const submit = (e: FormEvent) => {
    e.preventDefault();
    onSubmit();
  };
  const set = (patch: Partial<ClientRequest>) => onChange({ ...value, ...patch });

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Новая карточка гостя"
      size="md"
      footer={
        <>
          <Button type="button" variant="secondary" onClick={onClose}>
            Отмена
          </Button>
          <Button type="submit" form={FORM_ID} variant="primary" loading={busy} icon={<Icon name="user" size={18} />}>
            Создать гостя
          </Button>
        </>
      }
    >
      <form id={FORM_ID} onSubmit={submit}>
        <ErrorBox error={error} />
        <div className="form-grid-2">
          <Field label="Фамилия" required>
            <input value={value.lastName} required autoComplete="family-name" placeholder="Иванов" onChange={(e) => set({ lastName: e.target.value })} />
          </Field>
          <Field label="Имя" required>
            <input value={value.firstName} required autoComplete="given-name" placeholder="Иван" onChange={(e) => set({ firstName: e.target.value })} />
          </Field>
        </div>
        <div className="form-grid-2">
          <Field label="Отчество">
            <input value={value.middleName ?? ''} autoComplete="additional-name" placeholder="Иванович" onChange={(e) => set({ middleName: e.target.value })} />
          </Field>
          <Field label="Дата рождения" required>
            <input type="date" value={value.birthDate} required onChange={(e) => set({ birthDate: e.target.value })} />
          </Field>
        </div>
        <div className="form-grid-2">
          <Field label="Номер телефона">
            <input type="tel" inputMode="tel" autoComplete="tel" value={value.phone ?? ''} placeholder="+375 29 123-45-67" onChange={(e) => set({ phone: e.target.value })} />
          </Field>
          <Field label="Email">
            <input type="email" autoComplete="email" value={value.email ?? ''} placeholder="guest@example.com" onChange={(e) => set({ email: e.target.value })} />
          </Field>
        </div>
      </form>
    </Modal>
  );
}
