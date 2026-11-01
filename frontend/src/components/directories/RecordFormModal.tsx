import type { FormEvent } from 'react';
import { Button, ErrorBox, Field, Modal } from '../ui';
import { CUSTOMER_TYPE_NAMES, TEXT_SELECTS, type RefOptions, type ResourceSpec } from './resources';

/** Модальное окно создания / редактирования записи справочника. */
export default function RecordFormModal({
  isOpen,
  resource,
  editingId,
  form,
  refOptions,
  busy,
  error,
  onChange,
  onSubmit,
  onClose,
}: {
  isOpen: boolean;
  resource: ResourceSpec;
  /** null — новая запись. */
  editingId: number | null;
  form: Record<string, string>;
  refOptions: RefOptions;
  busy: boolean;
  error: unknown;
  onChange: (key: string, value: string) => void;
  onSubmit: (e: FormEvent) => void;
  onClose: () => void;
}) {
  const isNew = editingId === null;
  const formId = 'directory-record-form';
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isNew ? `Новая запись: ${resource.title}` : `Редактирование записи #${editingId}`}
      size="md"
      footer={
        <>
          <Button type="button" variant="secondary" onClick={onClose}>
            Отмена
          </Button>
          <Button type="submit" form={formId} variant="primary" loading={busy}>
            {isNew ? 'Создать запись' : 'Сохранить изменения'}
          </Button>
        </>
      }
    >
      <ErrorBox error={error} />
      <form id={formId} onSubmit={onSubmit}>
        {resource.fields.map((f, idx) => {
          const textOptions = TEXT_SELECTS[resource.key]?.[f.key];
          const opts = refOptions[f.key] ?? [];
          const autofocus = idx === 0 ? { 'data-autofocus': true } : {};
          return (
            <Field
              key={f.key}
              label={f.label}
              required={f.required}
              hint={f.hint ?? (f.type === 'select' && !textOptions && opts.length === 0 ? 'Список пуст — сначала заполните связанный справочник' : undefined)}
            >
              {f.type === 'select' && textOptions ? (
                <select value={form[f.key] ?? 'ORG'} onChange={(e) => onChange(f.key, e.target.value)} required={f.required} disabled={busy} {...autofocus}>
                  {textOptions.map((v) => (
                    <option key={v} value={v}>
                      {CUSTOMER_TYPE_NAMES[v] ?? v}
                    </option>
                  ))}
                </select>
              ) : f.type === 'select' ? (
                <select value={form[f.key] ?? ''} onChange={(e) => onChange(f.key, e.target.value)} required={f.required} disabled={busy} {...autofocus}>
                  <option value="">— Выберите значение —</option>
                  {opts.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  type={f.type === 'number' ? 'number' : 'text'}
                  inputMode={f.type === 'number' ? 'decimal' : undefined}
                  placeholder={f.placeholder}
                  value={form[f.key] ?? ''}
                  onChange={(e) => onChange(f.key, e.target.value)}
                  required={f.required}
                  disabled={busy}
                  {...autofocus}
                />
              )}
            </Field>
          );
        })}
      </form>
    </Modal>
  );
}
