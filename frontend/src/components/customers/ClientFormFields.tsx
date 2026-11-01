import { Field } from '../ui';
import type { ClientRequest, ClientView } from '../../types';

export interface ClientFormState {
  lastName: string;
  firstName: string;
  middleName: string;
  birthDate: string;
  phone: string;
  email: string;
  citizenship: string;
}

export const EMPTY_CLIENT: ClientFormState = {
  lastName: '',
  firstName: '',
  middleName: '',
  birthDate: '',
  phone: '',
  email: '',
  citizenship: '',
};

export function clientToForm(c: ClientView): ClientFormState {
  return {
    lastName: c.lastName,
    firstName: c.firstName,
    middleName: c.middleName ?? '',
    birthDate: c.birthDate,
    phone: c.phone ?? '',
    email: c.email ?? '',
    citizenship: c.citizenship ?? '',
  };
}

export function toRequest(f: ClientFormState): ClientRequest {
  return {
    lastName: f.lastName,
    firstName: f.firstName,
    middleName: f.middleName || undefined,
    birthDate: f.birthDate,
    phone: f.phone || undefined,
    email: f.email || undefined,
    citizenship: f.citizenship || undefined,
  };
}

/** Поля анкеты гостя — общие для регистрации и правки профиля. */
export function ClientFormFields({
  value,
  onChange,
  withPlaceholders = false,
}: {
  value: ClientFormState;
  onChange: (next: ClientFormState) => void;
  withPlaceholders?: boolean;
}) {
  const set = (key: keyof ClientFormState) => (e: { target: { value: string } }) => onChange({ ...value, [key]: e.target.value });
  const ph = (text: string) => (withPlaceholders ? text : undefined);
  return (
    <>
      <div className="form-grid">
        <Field label="Фамилия" required>
          <input value={value.lastName} required autoComplete="family-name" placeholder={ph('Смирнов')} onChange={set('lastName')} />
        </Field>
        <Field label="Имя" required>
          <input value={value.firstName} required autoComplete="given-name" placeholder={ph('Алексей')} onChange={set('firstName')} />
        </Field>
        <Field label="Отчество">
          <input value={value.middleName} autoComplete="additional-name" placeholder={ph('Сергеевич')} onChange={set('middleName')} />
        </Field>
      </div>
      <div className="form-grid">
        <Field label="Дата рождения" required>
          <input type="date" value={value.birthDate} required onChange={set('birthDate')} />
        </Field>
        <Field label="Гражданство">
          <input value={value.citizenship} placeholder={ph('Республика Беларусь')} onChange={set('citizenship')} />
        </Field>
      </div>
      <div className="form-grid">
        <Field label="Телефон">
          <input type="tel" value={value.phone} autoComplete="tel" placeholder={ph('+375 29 111-22-33')} onChange={set('phone')} />
        </Field>
        <Field label="Email">
          <input type="email" value={value.email} autoComplete="email" placeholder={ph('client@mail.ru')} onChange={set('email')} />
        </Field>
      </div>
    </>
  );
}
