import { useCallback, useEffect, useId, useState, type FormEvent } from 'react';
import { clients, directory } from '../api/endpoints';
import { DataTable, type Column } from '../components/DataTable';
import { Badge, Button, Card, ErrorBox, Field, Modal, SearchBar, StatCard, Tabs, useConfirm, useToast } from '../components/ui';
import { Icon } from '../components/icons';
import { ClientCardModal } from '../components/customers/ClientCardModal';
import { ClientFormFields, EMPTY_CLIENT, toRequest, type ClientFormState } from '../components/customers/ClientFormFields';
import { useAuth } from '../hooks/useAuth';
import type { ClientView, Coded, Customer } from '../types';

const TYPE_NAMES: Record<string, string> = { ORG: 'Организация (юрлицо)', PERSON: 'Физическое лицо' };

type Section = 'clients' | 'customers';

export default function CustomersPage() {
  const toast = useToast();
  const [ask, confirmDialog] = useConfirm();
  const { hasRole } = useAuth();
  // Создание, правка и удаление заказчиков доступны только SYSADMIN (у BOOKING_ADMIN сервер отвечает 403).
  const canWrite = hasRole('SYSADMIN');
  const createFormId = useId();
  const customerFormId = useId();

  const [activeSection, setActiveSection] = useState<Section>('clients');
  const [error, setError] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);

  // Гости
  const [searchQuery, setSearchQuery] = useState('');
  const [clientList, setClientList] = useState<ClientView[]>([]);
  const [clientsLoading, setClientsLoading] = useState(true);
  const [selectedClient, setSelectedClient] = useState<ClientView | null>(null);
  const [allConditions, setAllConditions] = useState<Coded[]>([]);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [newClientForm, setNewClientForm] = useState<ClientFormState>(EMPTY_CLIENT);
  const [createError, setCreateError] = useState<unknown>(null);

  // Корпоративные заказчики
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [customersLoading, setCustomersLoading] = useState(true);
  const [customerModalOpen, setCustomerModalOpen] = useState(false);
  const [custForm, setCustForm] = useState({ type: 'ORG' as Customer['type'], name: '', contractNo: '' });
  const [custEditId, setCustEditId] = useState<number | null>(null);
  const [custError, setCustError] = useState<unknown>(null);

  const loadCustomers = useCallback(async () => {
    try {
      setCustomers(await directory.customers());
    } catch (err) {
      setError(err);
    } finally {
      setCustomersLoading(false);
    }
  }, []);

  const loadClients = useCallback(async (query = '') => {
    setClientsLoading(true);
    try {
      setClientList(await clients.search(query));
    } catch (err) {
      setError(err);
    } finally {
      setClientsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadCustomers();
    void loadClients();
    directory.conditions().then(setAllConditions).catch(setError);
  }, [loadCustomers, loadClients]);

  function openCreateClient() {
    setCreateError(null);
    setCreateModalOpen(true);
  }

  async function handleCreateClient(e: FormEvent) {
    e.preventDefault();
    setCreateError(null);
    setBusy(true);
    try {
      const created = await clients.create(toRequest(newClientForm));
      setNewClientForm(EMPTY_CLIENT);
      setCreateModalOpen(false);
      toast.success(`Гость ${created.lastName} ${created.firstName} зарегистрирован (№ ${created.id}).`);
      await loadClients();
      setSelectedClient(created);
    } catch (err) {
      setCreateError(err);
    } finally {
      setBusy(false);
    }
  }

  function startCreateCustomer() {
    setCustEditId(null);
    setCustError(null);
    setCustForm({ type: 'ORG', name: '', contractNo: '' });
    setCustomerModalOpen(true);
  }

  function startEditCustomer(c: Customer) {
    setCustEditId(c.id);
    setCustError(null);
    setCustForm({ type: c.type, name: c.name, contractNo: c.contractNo ?? '' });
    setCustomerModalOpen(true);
  }

  async function saveCustomer(e: FormEvent) {
    e.preventDefault();
    if (!canWrite) return;
    setCustError(null);
    setBusy(true);
    try {
      const body = { type: custForm.type, name: custForm.name, contractNo: custForm.contractNo || null };
      if (custEditId === null) {
        await directory.create('customers', body);
        toast.success('Корпоративный заказчик добавлен.');
      } else {
        await directory.update('customers', custEditId, body);
        toast.success('Данные заказчика обновлены.');
      }
      setCustomerModalOpen(false);
      await loadCustomers();
    } catch (err) {
      setCustError(err);
    } finally {
      setBusy(false);
    }
  }

  async function removeCustomer(c: Customer) {
    if (!canWrite) return;
    if (!(await ask({ title: 'Удаление заказчика', message: `Удалить заказчика «${c.name}»? Действие нельзя отменить.`, confirmLabel: 'Удалить', danger: true }))) return;
    setError(null);
    try {
      await directory.remove('customers', c.id);
      toast.success('Заказчик удалён.');
      await loadCustomers();
    } catch (err) {
      setError(err);
    }
  }

  const clientColumns: Column<ClientView>[] = [
    { key: 'id', header: 'ID', render: (c) => <span className="u-muted">№ {c.id}</span>, sortValue: (c) => c.id },
    {
      key: 'name',
      header: 'ФИО гостя',
      render: (c) => (
        <span className="u-semibold">
          {c.lastName} {c.firstName} {c.middleName ?? ''}
        </span>
      ),
      sortValue: (c) => `${c.lastName} ${c.firstName}`,
    },
    { key: 'birth', header: 'Дата рождения', render: (c) => c.birthDate, sortValue: (c) => c.birthDate },
    { key: 'phone', header: 'Телефон', render: (c) => c.phone || <span className="u-subtle">—</span>, sortValue: (c) => c.phone },
    { key: 'email', header: 'Email', render: (c) => c.email || <span className="u-subtle">—</span>, sortValue: (c) => c.email },
    { key: 'citizenship', header: 'Гражданство', render: (c) => c.citizenship || 'РБ', sortValue: (c) => c.citizenship },
    {
      key: 'actions',
      header: 'Действия',
      hideHeader: true,
      align: 'right',
      className: 'actions',
      render: (c) => (
        <Button
          variant="outline"
          size="sm"
          icon={<Icon name="file" size={16} />}
          onClick={(e) => {
            e.stopPropagation();
            setSelectedClient(c);
          }}
        >
          Карточка
        </Button>
      ),
    },
  ];

  const customerColumns: Column<Customer>[] = [
    { key: 'id', header: 'ID', render: (c) => <span className="u-muted">№ {c.id}</span>, sortValue: (c) => c.id },
    {
      key: 'type',
      header: 'Тип',
      render: (c) => (
        <Badge variant={c.type === 'ORG' ? 'info' : 'neutral'} icon={c.type === 'ORG' ? 'home' : 'user'}>
          {TYPE_NAMES[c.type] ?? c.type}
        </Badge>
      ),
      sortValue: (c) => c.type,
    },
    { key: 'name', header: 'Наименование', className: 'wrap', render: (c) => <span className="u-semibold">{c.name}</span>, sortValue: (c) => c.name },
    {
      key: 'contract',
      header: 'Номер договора',
      render: (c) => c.contractNo ?? <span className="u-subtle">Без договора</span>,
      sortValue: (c) => c.contractNo,
    },
    ...(canWrite
      ? [
          {
            key: 'actions',
            header: 'Действия',
            hideHeader: true,
            align: 'right' as const,
            className: 'actions',
            render: (c: Customer) => (
              <span className="u-inline-gap">
                <Button variant="outline" size="sm" icon={<Icon name="edit" size={16} />} onClick={() => startEditCustomer(c)}>
                  Править
                </Button>
                <Button variant="ghost" size="sm" icon={<Icon name="trash" size={16} />} onClick={() => void removeCustomer(c)} aria-label={`Удалить заказчика ${c.name}`}>
                  Удалить
                </Button>
              </span>
            ),
          },
        ]
      : []),
  ];

  const withPhone = clientList.filter((c) => c.phone).length;
  const withEmail = clientList.filter((c) => c.email).length;
  const withContract = customers.filter((c) => c.contractNo).length;

  return (
    <section>
      {confirmDialog}
      <div className="page-head">
        <div>
          <h1>Гости и заказчики</h1>
          <p className="page-subtitle">Профили гостей, медкарты, программа лояльности и договоры с организациями</p>
        </div>
        <div className="page-actions">
          {activeSection === 'clients' ? (
            <Button variant="primary" icon={<Icon name="plus" size={18} />} onClick={openCreateClient}>
              Новый гость
            </Button>
          ) : (
            canWrite && (
              <Button variant="primary" icon={<Icon name="plus" size={18} />} onClick={startCreateCustomer}>
                Новый заказчик
              </Button>
            )
          )}
        </div>
        <Tabs<Section>
          label="Разделы базы гостей"
          value={activeSection}
          onChange={setActiveSection}
          tabs={[
            { id: 'clients', label: 'Физические лица', icon: 'users', count: clientList.length },
            { id: 'customers', label: 'Корпоративные заказчики', icon: 'home', count: customers.length },
          ]}
        />
      </div>

      <ErrorBox error={error} />

      {activeSection === 'clients' && (
        <>
          <div className="kpi-grid">
            <StatCard label="Гостей в выборке" value={clientsLoading ? '—' : clientList.length} color="c-blue" icon={<Icon name="users" size={20} />} />
            <StatCard label="С телефоном" value={clientsLoading ? '—' : withPhone} color="c-teal" icon={<Icon name="phone" size={20} />} />
            <StatCard label="С адресом email" value={clientsLoading ? '—' : withEmail} color="c-amber" icon={<Icon name="mail" size={20} />} />
          </div>

          <Card title="База гостей санатория" subtitle="Нажмите на строку, чтобы открыть карточку гостя">
            <DataTable
              rows={clientList}
              columns={clientColumns}
              rowKey={(c) => c.id}
              label="База гостей санатория"
              loading={clientsLoading}
              onRowClick={(c) => setSelectedClient(c)}
              initialSort={{ key: 'name', dir: 'asc' }}
              emptyTitle="Гости не найдены"
              emptyDescription="Измените поисковый запрос или зарегистрируйте нового гостя."
              emptyAction={
                <Button variant="primary" size="sm" icon={<Icon name="plus" size={16} />} onClick={openCreateClient}>
                  Добавить гостя
                </Button>
              }
              toolbar={
                <div className="dc-client-search">
                  <SearchBar
                    value={searchQuery}
                    onChange={(val) => {
                      setSearchQuery(val);
                      void loadClients(val);
                    }}
                    placeholder="Фамилия, имя, телефон"
                    label="Поиск гостей по фамилии, имени, телефону"
                  />
                  <Button variant="outline" icon={<Icon name="refresh" size={18} />} onClick={() => void loadClients(searchQuery)}>
                    Обновить
                  </Button>
                </div>
              }
            />
          </Card>
        </>
      )}

      {activeSection === 'customers' && (
        <>
          <div className="kpi-grid">
            <StatCard label="Заказчиков" value={customersLoading ? '—' : customers.length} color="c-blue" icon={<Icon name="home" size={20} />} />
            <StatCard label="С договором" value={customersLoading ? '—' : withContract} color="c-teal" icon={<Icon name="file" size={20} />} />
          </div>
          <Card title="Корпоративные заказчики и партнёры" subtitle="Организации, заключающие договоры на оздоровление сотрудников">
            <DataTable
              rows={customers}
              columns={customerColumns}
              rowKey={(c) => c.id}
              label="Корпоративные заказчики"
              loading={customersLoading}
              searchText={(c) => `${c.name} ${c.contractNo ?? ''}`}
              searchPlaceholder="Наименование или номер договора"
              initialSort={{ key: 'name', dir: 'asc' }}
              emptyTitle="Список заказчиков пуст"
              emptyDescription={canWrite ? 'Добавьте первую организацию-партнёра.' : 'Заказчиков добавляет системный администратор.'}
              emptyAction={
                canWrite ? (
                  <Button variant="primary" size="sm" icon={<Icon name="plus" size={16} />} onClick={startCreateCustomer}>
                    Новый заказчик
                  </Button>
                ) : undefined
              }
            />
          </Card>
        </>
      )}

      <ClientCardModal
        client={selectedClient}
        allConditions={allConditions}
        onClose={() => setSelectedClient(null)}
        onSaved={() => loadClients(searchQuery)}
      />

      <Modal
        isOpen={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        title="Регистрация нового гостя"
        size="md"
        footer={
          <>
            <Button variant="secondary" onClick={() => setCreateModalOpen(false)}>
              Отмена
            </Button>
            <Button type="submit" form={createFormId} variant="primary" loading={busy}>
              Зарегистрировать гостя
            </Button>
          </>
        }
      >
        <form id={createFormId} onSubmit={handleCreateClient}>
          <ClientFormFields value={newClientForm} onChange={setNewClientForm} withPlaceholders />
          <ErrorBox error={createError} />
        </form>
      </Modal>

      {canWrite && (
        <Modal
          isOpen={customerModalOpen}
          onClose={() => setCustomerModalOpen(false)}
          title={custEditId === null ? 'Новый корпоративный заказчик' : `Правка заказчика № ${custEditId}`}
          size="md"
          footer={
            <>
              <Button variant="secondary" onClick={() => setCustomerModalOpen(false)}>
                Отмена
              </Button>
              <Button type="submit" form={customerFormId} variant="primary" loading={busy}>
                Сохранить
              </Button>
            </>
          }
        >
          <form id={customerFormId} onSubmit={saveCustomer}>
            <Field label="Тип контрагента" required>
              <select value={custForm.type} onChange={(e) => setCustForm({ ...custForm, type: e.target.value as Customer['type'] })}>
                <option value="ORG">Организация (юридическое лицо)</option>
                <option value="PERSON">Физическое лицо (индивидуальный договор)</option>
              </select>
            </Field>
            <Field label="Наименование" required>
              <input value={custForm.name} required placeholder="ОАО «Беларуськалий»" onChange={(e) => setCustForm({ ...custForm, name: e.target.value })} />
            </Field>
            <Field label="Номер договора">
              <input value={custForm.contractNo} placeholder="Д-2026/01-САК" onChange={(e) => setCustForm({ ...custForm, contractNo: e.target.value })} />
            </Field>
            <ErrorBox error={custError} />
          </form>
        </Modal>
      )}
    </section>
  );
}
