import { Icon } from '../components/icons';
import { useCallback, useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react';
import { directory } from '../api/endpoints';
import { Badge, Button, Card, ErrorBox, useConfirm, useToast } from '../components/ui';
import { DataTable, type Column } from '../components/DataTable';
import RecordFormModal from '../components/directories/RecordFormModal';
import { RESOURCES, TEXT_SELECTS, type RefOptions, type ResourceSpec } from '../components/directories/resources';
import type { DirectoryRecord, RoomCategory } from '../types';

export default function DirectoriesPage() {
  const toast = useToast();
  const [ask, confirmDialog] = useConfirm();
  const [resource, setResource] = useState<ResourceSpec>(RESOURCES[0]);
  const [records, setRecords] = useState<DirectoryRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<unknown>(null);

  // Modal
  const [editingRecord, setEditingRecord] = useState<DirectoryRecord | 'new' | null>(null);
  const [form, setForm] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<unknown>(null);
  const [saving, setSaving] = useState(false);
  const [refOptions, setRefOptions] = useState<RefOptions>({});

  // Загрузка справочников-связей (категории и кабинеты)
  const loadRefs = useCallback(() => {
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

  useEffect(() => {
    loadRefs();
  }, [loadRefs]);

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
    setRecords([]);
    load(resource);
    setEditingRecord(null);
  }, [resource, load]);

  function startEdit(rec: DirectoryRecord | 'new') {
    setError(null);
    setFormError(null);
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
    setFormError(null);

    const body: Record<string, unknown> = editingRecord === 'new' ? {} : { ...editingRecord };
    setSaving(true);
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
        toast.success(`Запись успешно добавлена в «${resource.title}».`);
      } else {
        await directory.update(resource.key, editingRecord.id, body);
        toast.success(`Запись #${editingRecord.id} успешно обновлена.`);
      }

      setEditingRecord(null);
      load(resource);
      if (resource.key === 'room-categories' || resource.key === 'cabinets') loadRefs();
    } catch (err) {
      setFormError(err);
    } finally {
      setSaving(false);
    }
  }

  async function deleteRecord(rec: DirectoryRecord) {
    const ok = await ask({
      title: 'Подтверждение удаления',
      danger: true,
      confirmLabel: 'Да, удалить',
      message: (
        <>
          <p className="u-m0">
            Вы действительно хотите удалить запись <strong>#{rec.id}</strong> из справочника <strong>«{resource.title}»</strong>?
          </p>
          <p className="u-muted-sm u-mt-12 u-m0">
            Внимание: если на эту запись ссылаются другие данные (номера, путёвки, назначения), удаление будет заблокировано базой данных.
          </p>
        </>
      ),
    });
    if (!ok) return;
    setError(null);
    try {
      await directory.remove(resource.key, rec.id);
      toast.success(`Запись #${rec.id} удалена из «${resource.title}».`);
      load(resource);
    } catch (err) {
      setError(err);
    }
  }

  const columns = useMemo<Column<DirectoryRecord>[]>(() => {
    const display = (key: string, rawVal: unknown): ReactNode => {
      const refOpts = refOptions[key];
      if (typeof rawVal === 'boolean') {
        return <Badge variant={rawVal ? 'good' : 'bad'} icon={rawVal ? 'check' : 'close'}>{rawVal ? 'Да' : 'Нет'}</Badge>;
      }
      if (rawVal === null || rawVal === undefined || rawVal === '') return <span className="u-subtle">—</span>;
      if (key === 'type' && resource.key === 'customers') {
        return (
          <Badge variant={rawVal === 'ORG' ? 'info' : 'neutral'} icon={rawVal === 'ORG' ? 'home' : 'user'}>
            {rawVal === 'ORG' ? 'Организация' : 'Физлицо'}
          </Badge>
        );
      }
      if (refOpts) {
        const found = refOpts.find((o) => o.value === Number(rawVal));
        return found ? <span className="u-accent u-semibold">{found.label}</span> : String(rawVal);
      }
      return String(rawVal);
    };

    return [
      { key: 'id', header: 'ID', render: (rec) => <strong className="u-muted">#{rec.id}</strong>, sortValue: (rec) => rec.id },
      ...resource.fields.map<Column<DirectoryRecord>>((f) => ({
        key: f.key,
        header: f.label,
        align: f.type === 'number' ? 'right' : undefined,
        className: f.type === 'text' ? 'wrap' : undefined,
        render: (rec) => display(f.key, rec[f.key]),
        sortValue: (rec) => {
          const v = rec[f.key];
          if (refOptions[f.key]) return refOptions[f.key].find((o) => o.value === Number(v))?.label ?? null;
          return typeof v === 'number' || typeof v === 'string' ? v : null;
        },
      })),
      {
        key: 'actions',
        header: 'Действия',
        hideHeader: true,
        className: 'actions',
        render: (rec) => (
          <>
            <Button variant="outline" size="sm" icon={<Icon name="edit" size={16} />} onClick={() => startEdit(rec)} aria-label={`Править запись #${rec.id}`} title="Править" className="btn-icon-only" />
            <Button variant="danger" size="sm" icon={<Icon name="trash" size={16} />} onClick={() => void deleteRecord(rec)} aria-label={`Удалить запись #${rec.id}`} title="Удалить" className="btn-icon-only" />
          </>
        ),
      },
    ];
    // startEdit/deleteRecord зависят только от resource
  }, [resource, refOptions]);

  const searchText = useCallback(
    (rec: DirectoryRecord) =>
      Object.entries(rec)
        .map(([k, v]) => {
          const label = typeof v === 'number' ? refOptions[k]?.find((o) => o.value === v)?.label : undefined;
          return `${v ?? ''} ${label ?? ''}`;
        })
        .join(' '),
    [refOptions],
  );

  return (
    <section>
      <div className="page-head">
        <div>
          <h1>Справочники санатория (Системные классификаторы)</h1>
          <p className="page-subtitle">
            Управление категориями номеров, процедурами, кабинетами, диетами и тарификацией (доступно системному администратору)
          </p>
        </div>
        <div className="page-actions">
          <Badge variant="info" icon="database">Справочников: {RESOURCES.length}</Badge>
          <Badge variant="neutral" icon="file">Записей: {records.length}</Badge>
        </div>
      </div>

      <div className="dir-layout">
        <nav className="dir-nav" aria-label="Справочники системы">
          <ul>
            {RESOURCES.map((r) => {
              const isActive = r.key === resource.key;
              return (
                <li key={r.key}>
                  <button
                    type="button"
                    className={`dir-nav-item ${isActive ? 'is-active' : ''}`}
                    aria-pressed={isActive}
                    onClick={() => setResource(r)}
                  >
                    <Icon name={r.icon} size={18} />
                    <span>{r.title}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </nav>

        <Card
          className="dir-main"
          title={
            <span className="u-flex-center">
              <Icon name={resource.icon} size={20} />
              {resource.title}
            </span>
          }
          subtitle={resource.description}
          actions={
            <>
              <Button variant="outline" icon={<Icon name="refresh" size={18} />} onClick={() => load(resource)} loading={loading}>
                Обновить
              </Button>
              <Button variant="primary" icon={<Icon name="plus" size={18} />} onClick={() => startEdit('new')}>
                Добавить запись
              </Button>
            </>
          }
        >
          <ErrorBox error={error} />
          <DataTable
            key={resource.key}
            rows={records}
            columns={columns}
            rowKey={(rec) => rec.id}
            label={`Записи справочника «${resource.title}»`}
            searchText={searchText}
            searchPlaceholder={`Поиск по записям «${resource.title}»...`}
            loading={loading}
            initialSort={{ key: 'id', dir: 'asc' }}
            emptyTitle="Записи не найдены"
            emptyDescription={`В справочнике «${resource.title}» пока нет записей.`}
            emptyAction={
              <Button variant="primary" size="sm" icon={<Icon name="plus" size={16} />} onClick={() => startEdit('new')}>
                Добавить первую запись
              </Button>
            }
          />
        </Card>
      </div>

      <RecordFormModal
        isOpen={editingRecord !== null}
        resource={resource}
        editingId={editingRecord !== null && editingRecord !== 'new' ? editingRecord.id : null}
        form={form}
        refOptions={refOptions}
        busy={saving}
        error={formError}
        onChange={setField}
        onSubmit={(e) => void submitForm(e)}
        onClose={() => setEditingRecord(null)}
      />
      {confirmDialog}
    </section>
  );
}
