import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { directory } from '../api/endpoints';
import {
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorBox,
  Field,
  Modal,
  SearchBar,
  TableWrap,
} from '../components/ui';
import type { DirectoryRecord, RoomCategory } from '../types';

/** Описание поля справочника для универсального редактора. */
interface FieldSpec {
  key: string;
  label: string;
  type: 'text' | 'number' | 'select';
  required?: boolean;
  placeholder?: string;
}

interface ResourceSpec {
  key: string;
  title: string;
  icon: string;
  description: string;
  fields: FieldSpec[];
}

const RESOURCES: ResourceSpec[] = [
  {
    key: 'room-categories',
    title: 'Категории номеров',
    icon: '🛏️',
    description: 'Категории номерного фонда, базовые вместимости и описания комфортности.',
    fields: [
      { key: 'name', label: 'Название категории', type: 'text', required: true, placeholder: 'Люкс двухкомнатный' },
      { key: 'capacityTotal', label: 'Вместимость (мест в номере)', type: 'number', required: true, placeholder: '2' },
      { key: 'description', label: 'Описание и удобства', type: 'text', placeholder: 'Кондиционер, балкон с видом на лес' },
    ],
  },
  {
    key: 'rooms',
    title: 'Номера',
    icon: '🚪',
    description: 'Конкретные жилые комнаты санатория, привязка к категориям и этажам.',
    fields: [
      { key: 'categoryId', label: 'Категория номера', type: 'select', required: true },
      { key: 'roomNumber', label: 'Номер комнаты', type: 'text', required: true, placeholder: '305' },
      { key: 'floor', label: 'Этаж', type: 'number', placeholder: '3' },
    ],
  },
  {
    key: 'treatment-profiles',
    title: 'Лечебные профили',
    icon: '🩺',
    description: 'Медицинские направления санаторно-курортного оздоровления.',
    fields: [
      { key: 'code', label: 'Код профиля', type: 'text', placeholder: 'CARDIO' },
      { key: 'name', label: 'Наименование профиля', type: 'text', required: true, placeholder: 'Кардиологический' },
    ],
  },
  {
    key: 'cabinets',
    title: 'Кабинеты',
    icon: '🏢',
    description: 'Лечебные и процедурные кабинеты, пропускная способность.',
    fields: [
      { key: 'name', label: 'Название кабинета', type: 'text', required: true, placeholder: 'Кабинет №12 (Водолечебница)' },
      { key: 'slotsPerDay', label: 'Сеансов в день (пропускная способность)', type: 'number', required: true, placeholder: '16' },
    ],
  },
  {
    key: 'procedures',
    title: 'Процедуры',
    icon: '💉',
    description: 'Медицинские и оздоровительные процедуры, длительность и закреплённый кабинет.',
    fields: [
      { key: 'name', label: 'Название процедуры', type: 'text', required: true, placeholder: 'Минеральная ванна' },
      { key: 'durationMin', label: 'Длительность (минут)', type: 'number', required: true, placeholder: '30' },
      { key: 'cabinetId', label: 'Кабинет проведения', type: 'select', required: true },
    ],
  },
  {
    key: 'diets',
    title: 'Диеты',
    icon: '🥗',
    description: 'Столы лечебного и диетического питания.',
    fields: [
      { key: 'code', label: 'Код стола', type: 'text', placeholder: 'DIET-05' },
      { key: 'name', label: 'Название диеты', type: 'text', required: true, placeholder: 'Диета №5 (щадящая)' },
    ],
  },
  {
    key: 'sales-channels',
    title: 'Каналы продаж',
    icon: '🌐',
    description: 'Партнёрские и прямые каналы дистрибуции путёвок, агентские комиссии и квоты.',
    fields: [
      { key: 'name', label: 'Канал продаж', type: 'text', required: true, placeholder: 'Ostrovok.ru' },
      { key: 'commissionPct', label: 'Комиссия партнёра (%)', type: 'number', required: true, placeholder: '15' },
      { key: 'quotaPlaces', label: 'Квота мест', type: 'number', placeholder: '10' },
    ],
  },
  {
    key: 'medical-conditions',
    title: 'Состояния здоровья',
    icon: '📋',
    description: 'Диагнозы, показания и противопоказания гостей.',
    fields: [
      { key: 'code', label: 'Код МКБ / Системный код', type: 'text', required: true, placeholder: 'I10' },
      { key: 'name', label: 'Наименование состояния', type: 'text', required: true, placeholder: 'Артериальная гипертензия' },
    ],
  },
  {
    key: 'customers',
    title: 'Заказчики',
    icon: '🤝',
    description: 'Юридические лица и партнёры, заключающие корпоративные договоры на заезд групп.',
    fields: [
      { key: 'type', label: 'Тип заказчика', type: 'select', required: true },
      { key: 'name', label: 'Название организации / ФИО', type: 'text', required: true, placeholder: 'ОАО «Беларуськалий»' },
      { key: 'contractNo', label: 'Номер договора', type: 'text', placeholder: 'Д-2026/04' },
    ],
  },
];

const TEXT_SELECTS: Record<string, Record<string, string[]>> = {
  customers: { type: ['ORG', 'PERSON'] },
};

export default function DirectoriesPage() {
  const [resource, setResource] = useState<ResourceSpec>(RESOURCES[0]);
  const [records, setRecords] = useState<DirectoryRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [message, setMessage] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  // Modals
  const [editingRecord, setEditingRecord] = useState<DirectoryRecord | 'new' | null>(null);
  const [recordToDelete, setRecordToDelete] = useState<DirectoryRecord | null>(null);
  const [form, setForm] = useState<Record<string, string>>({});
  const [refOptions, setRefOptions] = useState<Record<string, { value: number; label: string }[]>>({});

  // Загрузка справочников-связей (категории и кабинеты)
  useEffect(() => {
    directory
      .categories()
      .then((cs: RoomCategory[]) =>
        setRefOptions((o) => ({ ...o, categoryId: cs.map((c) => ({ value: c.id, label: c.name })) }))
      )
      .catch(() => undefined);

    directory
      .cabinets()
      .then((cs: { id: number; name: string }[]) =>
        setRefOptions((o) => ({ ...o, cabinetId: cs.map((c) => ({ value: c.id, label: c.name })) }))
      )
      .catch(() => undefined);
  }, []);

  const load = useCallback((res: ResourceSpec) => {
    setLoading(true);
    setError(null);
    directory
      .list(res.key)
      .then((data) => {
        setRecords(data);
      })
      .catch(setError)
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load(resource);
    setEditingRecord(null);
    setSearchQuery('');
  }, [resource, load]);

  function startEdit(rec: DirectoryRecord | 'new') {
    setError(null);
    setMessage('');
    if (rec === 'new') {
      const initial: Record<string, string> = {};
      if (resource.key === 'customers') {
        initial['type'] = 'ORG';
      }
      setForm(initial);
    } else {
      const next: Record<string, string> = {};
      for (const f of resource.fields) {
        const v = rec[f.key];
        next[f.key] = v === null || v === undefined ? '' : String(v);
      }
      setForm(next);
    }
    setEditingRecord(rec);
  }

  const setField = (key: string, value: string) => setForm((f) => ({ ...f, [key]: value }));

  async function submitForm(e: FormEvent) {
    e.preventDefault();
    if (editingRecord === null) return;
    setError(null);
    setMessage('');

    const body: Record<string, unknown> = editingRecord === 'new' ? {} : { ...editingRecord };
    try {
      for (const f of resource.fields) {
        const raw = form[f.key] ?? '';
        const isTextSelect = Boolean(TEXT_SELECTS[resource.key]?.[f.key]);
        if (f.type === 'number' || (f.type === 'select' && !isTextSelect)) {
          body[f.key] = raw === '' ? null : Number(raw);
        } else {
          body[f.key] = raw === '' ? null : raw;
        }
      }

      if (editingRecord === 'new') {
        await directory.create(resource.key, body);
        setMessage(`Запись успешно добавлена в «${resource.title}».`);
      } else {
        await directory.update(resource.key, editingRecord.id, body);
        setMessage(`Запись #${editingRecord.id} успешно обновлена.`);
      }

      setEditingRecord(null);
      load(resource);
    } catch (err) {
      setError(err);
    }
  }

  async function confirmDelete() {
    if (!recordToDelete) return;
    setError(null);
    setMessage('');
    try {
      await directory.remove(resource.key, recordToDelete.id);
      setMessage(`Запись #${recordToDelete.id} удалена из «${resource.title}».`);
      setRecordToDelete(null);
      load(resource);
    } catch (err) {
      setError(err);
    }
  }

  // Live filtered records by search query
  const filteredRecords = useMemo(() => {
    if (!searchQuery) return records;
    const q = searchQuery.toLowerCase().trim();
    return records.filter((rec) => {
      return Object.entries(rec).some(([k, val]) => {
        if (k === 'id' && String(val).includes(q)) return true;
        if (typeof val === 'string' && val.toLowerCase().includes(q)) return true;
        if (typeof val === 'number') {
          // Check resolved ref value as well
          const opts = refOptions[k];
          if (opts) {
            const found = opts.find((o) => o.value === val);
            if (found && found.label.toLowerCase().includes(q)) return true;
          }
          return String(val).includes(q);
        }
        return false;
      });
    });
  }, [records, searchQuery, refOptions]);

  const optionsFor = (key: string) => refOptions[key] ?? [];

  return (
    <section>
      {/* Page Header */}
      <div className="page-head">
        <div>
          <h1>Справочники санатория (Системные классификаторы)</h1>
          <p className="card-subtitle">
            Управление категориями номеров, процедурами, кабинетами, диетами и тарификацией (доступно системному администратору)
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Badge variant="info">Справочников: {RESOURCES.length}</Badge>
          <Badge variant="neutral">Записей: {records.length}</Badge>
        </div>
      </div>

      <ErrorBox error={error} />
      {message && <p className="ok">{message}</p>}

      {/* Modern Directory Selection Pills */}
      <div className="dir-pill-list" role="tablist" aria-label="Справочники системы">
        {RESOURCES.map((r) => {
          const isActive = r.key === resource.key;
          return (
            <button
              key={r.key}
              type="button"
              role="tab"
              aria-selected={isActive}
              className={`dir-pill-btn ${isActive ? 'active' : ''}`}
              onClick={() => setResource(r)}
            >
              <span>{r.icon}</span>
              <span>{r.title}</span>
            </button>
          );
        })}
      </div>

      {/* Main Card with Records */}
      <Card
        title={
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span>{resource.icon}</span>
            <span>{resource.title}</span>
          </div>
        }
        subtitle={resource.description}
      >
        {/* Toolbar: Search, Add, Refresh */}
        <div className="filter-toolbar">
          <SearchBar
            value={searchQuery}
            onChange={setSearchQuery}
            placeholder={`Поиск по записям «${resource.title}»...`}
          />

          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <Button variant="primary" onClick={() => startEdit('new')}>
              + Добавить запись
            </Button>
            <Button variant="outline" onClick={() => load(resource)} disabled={loading}>
              {loading ? 'Загрузка…' : 'Обновить'}
            </Button>
          </div>
        </div>

        {/* Table of Records */}
        <TableWrap>
          <table>
            <thead>
              <tr>
                <th style={{ width: 60 }}>ID</th>
                {resource.fields.map((f) => (
                  <th key={f.key}>{f.label}</th>
                ))}
                <th style={{ textAlign: 'right' }}>Действия</th>
              </tr>
            </thead>
            <tbody>
              {filteredRecords.length === 0 ? (
                <tr>
                  <td colSpan={resource.fields.length + 2}>
                    <EmptyState
                      title="Записи не найдены"
                      description={
                        searchQuery
                          ? 'По вашему поисковому запросу ничего не найдено.'
                          : `В справочнике «${resource.title}» пока нет записей.`
                      }
                      action={
                        <Button variant="primary" size="sm" onClick={() => startEdit('new')}>
                          Добавить первую запись
                        </Button>
                      }
                    />
                  </td>
                </tr>
              ) : (
                filteredRecords.map((rec) => (
                  <tr key={rec.id}>
                    <td>
                      <strong style={{ color: 'var(--text-muted)' }}>#{rec.id}</strong>
                    </td>
                    {resource.fields.map((f) => {
                      const refOpts = refOptions[f.key];
                      const rawVal = rec[f.key];
                      let displayNode: React.ReactNode;

                      if (typeof rawVal === 'boolean') {
                        displayNode = <Badge variant={rawVal ? 'good' : 'bad'}>{rawVal ? 'Да' : 'Нет'}</Badge>;
                      } else if (rawVal === null || rawVal === undefined || rawVal === '') {
                        displayNode = <span style={{ color: 'var(--text-subtle)' }}>—</span>;
                      } else if (f.key === 'type' && resource.key === 'customers') {
                        displayNode = (
                          <Badge variant={rawVal === 'ORG' ? 'info' : 'neutral'}>
                            {rawVal === 'ORG' ? 'Организация' : 'Физлицо'}
                          </Badge>
                        );
                      } else if (refOpts) {
                        const found = refOpts.find((o) => o.value === Number(rawVal));
                        displayNode = found ? (
                          <span style={{ fontWeight: 600, color: 'var(--accent)' }}>{found.label}</span>
                        ) : (
                          String(rawVal)
                        );
                      } else {
                        displayNode = String(rawVal);
                      }

                      return <td key={f.key}>{displayNode}</td>;
                    })}

                    <td style={{ textAlign: 'right' }} className="actions">
                      <Button variant="outline" size="sm" onClick={() => startEdit(rec)}>
                        Править
                      </Button>
                      <Button variant="danger" size="sm" onClick={() => setRecordToDelete(rec)}>
                        Удалить
                      </Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </TableWrap>
      </Card>

      {/* Modal: Create or Edit Record */}
      <Modal
        isOpen={editingRecord !== null}
        onClose={() => setEditingRecord(null)}
        title={
          editingRecord === 'new'
            ? `Новая запись: ${resource.title}`
            : `Редактирование записи #${(editingRecord as DirectoryRecord)?.id ?? ''}`
        }
        size="md"
      >
        {editingRecord !== null && (
          <form onSubmit={submitForm}>
            {resource.fields.map((f) => (
              <Field key={f.key} label={f.label} required={f.required}>
                {f.type === 'select' && TEXT_SELECTS[resource.key]?.[f.key] ? (
                  <select
                    value={form[f.key] ?? 'ORG'}
                    onChange={(e) => setField(f.key, e.target.value)}
                    required={f.required}
                  >
                    {TEXT_SELECTS[resource.key][f.key].map((v) => (
                      <option key={v} value={v}>
                        {v === 'ORG' ? 'Организация (Юр. лицо)' : 'Физическое лицо'}
                      </option>
                    ))}
                  </select>
                ) : f.type === 'select' ? (
                  <select
                    value={form[f.key] ?? ''}
                    onChange={(e) => setField(f.key, e.target.value)}
                    required={f.required}
                  >
                    <option value="">— Выберите значение —</option>
                    {optionsFor(f.key).map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    type={f.type === 'number' ? 'number' : 'text'}
                    placeholder={f.placeholder}
                    value={form[f.key] ?? ''}
                    onChange={(e) => setField(f.key, e.target.value)}
                    required={f.required}
                  />
                )}
              </Field>
            ))}

            <div
              style={{
                display: 'flex',
                justifyContent: 'flex-end',
                gap: 10,
                marginTop: 22,
                paddingTop: 16,
                borderTop: '1px solid var(--line)',
              }}
            >
              <Button type="button" variant="secondary" onClick={() => setEditingRecord(null)}>
                Отмена
              </Button>
              <Button type="submit" variant="primary">
                {editingRecord === 'new' ? 'Создать запись' : 'Сохранить изменения'}
              </Button>
            </div>
          </form>
        )}
      </Modal>

      {/* Modal: Confirm Delete Record */}
      <Modal
        isOpen={recordToDelete !== null}
        onClose={() => setRecordToDelete(null)}
        title="Подтверждение удаления"
        size="sm"
      >
        {recordToDelete && (
          <div>
            <p style={{ margin: '0 0 16px', lineHeight: 1.5 }}>
              Вы действительно хотите удалить запись <strong>#{recordToDelete.id}</strong> из справочника{' '}
              <strong>«{resource.title}»</strong>?
            </p>
            <p style={{ color: 'var(--danger)', fontSize: '0.85rem', margin: '0 0 20px' }}>
              Внимание: если на эту запись ссылаются другие данные (номера, путёвки, назначения), удаление будет заблокировано базой данных.
            </p>

            <div
              style={{
                display: 'flex',
                justifyContent: 'flex-end',
                gap: 10,
                paddingTop: 14,
                borderTop: '1px solid var(--line)',
              }}
            >
              <Button variant="secondary" onClick={() => setRecordToDelete(null)}>
                Отмена
              </Button>
              <Button variant="danger" onClick={() => void confirmDelete()}>
                Да, удалить
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </section>
  );
}
