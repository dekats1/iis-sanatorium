import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { clients, directory, ehr, loyalty } from '../api/endpoints';
import {
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorBox,
  Field,
  formatDateTime,
  Modal,
  SearchBar,
  StatCard,
  TableWrap,
} from '../components/ui';
import { useAuth } from '../hooks/useAuth';
import type {
  BonusTransaction,
  ClientRequest,
  ClientView,
  Coded,
  ConditionView,
  Customer,
  EhrRecord,
  LoyaltyAccount,
} from '../types';

const TYPE_NAMES: Record<string, string> = { ORG: 'Организация (Юрлицо)', PERSON: 'Физическое лицо' };

interface ClientFormState {
  lastName: string;
  firstName: string;
  middleName: string;
  birthDate: string;
  phone: string;
  email: string;
  citizenship: string;
}

const EMPTY_CLIENT: ClientFormState = {
  lastName: '',
  firstName: '',
  middleName: '',
  birthDate: '',
  phone: '',
  email: '',
  citizenship: '',
};

function clientToForm(c: ClientView): ClientFormState {
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

function toRequest(f: ClientFormState): ClientRequest {
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

export default function CustomersPage() {
  const { hasRole } = useAuth();
  const canWrite = hasRole('SYSADMIN');

  const [activeSection, setActiveSection] = useState<'clients' | 'customers'>('clients');
  const [error, setError] = useState<unknown>(null);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  // Clients state
  const [searchQuery, setSearchQuery] = useState('');
  const [clientList, setClientList] = useState<ClientView[]>([]);
  const [selectedClient, setSelectedClient] = useState<ClientView | null>(null);
  const [clientTab, setClientTab] = useState<'profile' | 'ehr' | 'loyalty'>('profile');

  // Edit / Create client
  const [editForm, setEditForm] = useState<ClientFormState>(EMPTY_CLIENT);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [newClientForm, setNewClientForm] = useState<ClientFormState>(EMPTY_CLIENT);

  // Conditions & EHR
  const [conditions, setConditions] = useState<ConditionView[]>([]);
  const [allConditions, setAllConditions] = useState<Coded[]>([]);
  const [newConditionId, setNewConditionId] = useState('');
  const [clientEhr, setClientEhr] = useState<EhrRecord | null>(null);

  // Loyalty
  const [clientLoyalty, setClientLoyalty] = useState<LoyaltyAccount | null>(null);
  const [clientTransactions, setClientTransactions] = useState<BonusTransaction[]>([]);
  const [bonusModalOpen, setBonusModalOpen] = useState(false);
  const [bonusAmount, setBonusAmount] = useState('100');
  const [bonusDescription, setBonusDescription] = useState('Поощрительное начисление баллов');

  // Corporate customers state
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [customerModalOpen, setCustomerModalOpen] = useState(false);
  const [custForm, setCustForm] = useState({ type: 'ORG' as Customer['type'], name: '', contractNo: '' });
  const [custEditId, setCustEditId] = useState<number | null>(null);

  const loadCustomers = useCallback(async () => {
    try {
      setCustomers(await directory.customers());
    } catch (err) {
      setError(err);
    }
  }, []);

  const loadClients = useCallback(async (query = '') => {
    try {
      setClientList(await clients.search(query));
    } catch (err) {
      setError(err);
    }
  }, []);

  useEffect(() => {
    void loadCustomers();
    void loadClients();
    directory.conditions().then(setAllConditions).catch(setError);
  }, [loadCustomers, loadClients]);

  async function openClientModal(c: ClientView) {
    setError(null);
    setMessage('');
    setSelectedClient(c);
    setEditForm(clientToForm(c));
    try {
      const [full, conds, ehrData, lAcc, lTx] = await Promise.all([
        clients.one(c.id),
        clients.conditions(c.id),
        ehr.get(c.id),
        loyalty.account(c.id),
        loyalty.transactions(c.id),
      ]);
      setSelectedClient(full);
      setConditions(conds);
      setClientEhr(ehrData);
      setClientLoyalty(lAcc);
      setClientTransactions(lTx);
    } catch (err) {
      setError(err);
    }
  }

  async function saveClientProfile(e: FormEvent) {
    e.preventDefault();
    if (!selectedClient) return;
    setError(null);
    setMessage('');
    setBusy(true);
    try {
      const updated = await clients.update(selectedClient.id, toRequest(editForm));
      setSelectedClient(updated);
      setMessage('Данные клиента успешно сохранены.');
      await loadClients(searchQuery);
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  }

  async function handleCreateClient(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setMessage('');
    setBusy(true);
    try {
      const created = await clients.create(toRequest(newClientForm));
      setNewClientForm(EMPTY_CLIENT);
      setCreateModalOpen(false);
      setMessage(`Клиент ${created.lastName} ${created.firstName} успешно зарегистрирован (#${created.id}).`);
      await loadClients();
      await openClientModal(created);
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  }

  async function addCondition() {
    if (!selectedClient || !newConditionId) return;
    setError(null);
    setMessage('');
    try {
      await clients.addCondition(selectedClient.id, Number(newConditionId));
      setNewConditionId('');
      setConditions(await clients.conditions(selectedClient.id));
      setMessage('Медицинское состояние добавлено в карту гостя.');
    } catch (err) {
      setError(err);
    }
  }

  async function removeCondition(conditionId: number) {
    if (!selectedClient) return;
    setError(null);
    setMessage('');
    try {
      await clients.removeCondition(selectedClient.id, conditionId);
      setConditions(await clients.conditions(selectedClient.id));
      setMessage('Медицинское состояние удалено.');
    } catch (err) {
      setError(err);
    }
  }

  async function handleAddLoyaltyBonus(e: FormEvent) {
    e.preventDefault();
    if (!selectedClient) return;
    setError(null);
    try {
      const amount = Number(bonusAmount);
      await loyalty.addBonus(selectedClient.id, amount, bonusDescription);
      const [lAcc, lTx] = await Promise.all([
        loyalty.account(selectedClient.id),
        loyalty.transactions(selectedClient.id),
      ]);
      setClientLoyalty(lAcc);
      setClientTransactions(lTx);
      setBonusModalOpen(false);
      setMessage(`Гостю успешно начислено ${amount} бонусных баллов!`);
    } catch (err) {
      setError(err);
    }
  }

  // Customer handlers
  function startCreateCustomer() {
    setCustEditId(null);
    setCustForm({ type: 'ORG', name: '', contractNo: '' });
    setCustomerModalOpen(true);
  }

  function startEditCustomer(c: Customer) {
    setCustEditId(c.id);
    setCustForm({ type: c.type, name: c.name, contractNo: c.contractNo ?? '' });
    setCustomerModalOpen(true);
  }

  async function saveCustomer(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setMessage('');
    setBusy(true);
    try {
      const body = { type: custForm.type, name: custForm.name, contractNo: custForm.contractNo || null };
      if (custEditId === null) {
        await directory.create('customers', body);
        setMessage('Корпоративный заказчик успешно добавлен.');
      } else {
        await directory.update('customers', custEditId, body);
        setMessage('Данные заказчика успешно обновлены.');
      }
      setCustomerModalOpen(false);
      await loadCustomers();
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  }

  async function removeCustomer(c: Customer) {
    if (!window.confirm(`Удалить заказчика «${c.name}»?`)) return;
    setError(null);
    setMessage('');
    try {
      await directory.remove('customers', c.id);
      setMessage('Заказчик удалён.');
      await loadCustomers();
    } catch (err) {
      setError(err);
    }
  }

  return (
    <section>
      {/* Page Header */}
      <div className="page-head">
        <div>
          <h1>Гости и заказчики (CRM, EHR & Loyalty)</h1>
          <p className="card-subtitle">
            Управление профилями гостей, медицинскими картами (EHR), бонусами программы лояльности и договорами B2B
          </p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          {activeSection === 'clients' ? (
            <Button variant="primary" onClick={() => setCreateModalOpen(true)}>
              + Новый гость
            </Button>
          ) : (
            canWrite && (
              <Button variant="primary" onClick={startCreateCustomer}>
                + Новый заказчик
              </Button>
            )
          )}
        </div>
      </div>

      <ErrorBox error={error} />
      {message && <p className="ok">{message}</p>}

      {/* Tabs: Clients / Corporate Customers */}
      <div className="tabs">
        <button
          type="button"
          className={`tab ${activeSection === 'clients' ? 'active' : ''}`}
          onClick={() => setActiveSection('clients')}
        >
          Физические лица ({clientList.length})
        </button>
        <button
          type="button"
          className={`tab ${activeSection === 'customers' ? 'active' : ''}`}
          onClick={() => setActiveSection('customers')}
        >
          Корпоративные заказчики ({customers.length})
        </button>
      </div>

      {/* SECTION 1: Clients */}
      {activeSection === 'clients' && (
        <>
          <div className="kpi-grid">
            <StatCard label="Всего гостей в базе" value={clientList.length} color="c-blue" icon="👥" />
            <StatCard label="Участников программы лояльности" value={clientList.length} color="c-teal" icon="⭐" />
            <StatCard label="Заполненных мед. карт (EHR)" value={clientList.length} color="default" icon="🩺" />
          </div>

          <Card title="База гостей санатория">
            <div className="filter-toolbar">
              <SearchBar
                value={searchQuery}
                onChange={(val) => {
                  setSearchQuery(val);
                  void loadClients(val);
                }}
                placeholder="Поиск по фамилии, имени, телефону..."
              />
              <Button variant="outline" size="sm" onClick={() => void loadClients(searchQuery)}>
                Обновить
              </Button>
            </div>

            <TableWrap>
              <table>
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>ФИО Гостя</th>
                    <th>Дата рождения</th>
                    <th>Телефон</th>
                    <th>Email</th>
                    <th>Гражданство</th>
                    <th style={{ textAlign: 'right' }}>Действия</th>
                  </tr>
                </thead>
                <tbody>
                  {clientList.length === 0 ? (
                    <tr>
                      <td colSpan={7}>
                        <EmptyState
                          title="Гости не найдены"
                          description="Попробуйте изменить поисковый запрос или добавьте нового гостя."
                          action={
                            <Button variant="primary" size="sm" onClick={() => setCreateModalOpen(true)}>
                              Добавить гостя
                            </Button>
                          }
                        />
                      </td>
                    </tr>
                  ) : (
                    clientList.map((c) => (
                      <tr
                        key={c.id}
                        style={{ cursor: 'pointer' }}
                        onClick={() => void openClientModal(c)}
                      >
                        <td>
                          <strong>#{c.id}</strong>
                        </td>
                        <td>
                          <strong>
                            {c.lastName} {c.firstName} {c.middleName ?? ''}
                          </strong>
                        </td>
                        <td>{c.birthDate}</td>
                        <td>{c.phone || <span style={{ color: 'var(--text-subtle)' }}>—</span>}</td>
                        <td>{c.email || <span style={{ color: 'var(--text-subtle)' }}>—</span>}</td>
                        <td>{c.citizenship || 'РБ'}</td>
                        <td style={{ textAlign: 'right' }} className="actions" onClick={(e) => e.stopPropagation()}>
                          <Button variant="outline" size="sm" onClick={() => void openClientModal(c)}>
                            Карточка
                          </Button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </TableWrap>
          </Card>
        </>
      )}

      {/* SECTION 2: Corporate Customers */}
      {activeSection === 'customers' && (
        <Card title="Корпоративные заказчики и партнёры">
          <p className="card-subtitle" style={{ marginBottom: 16 }}>
            Юридические лица и организации, заключающие договоры на оздоровление сотрудников
          </p>

          <TableWrap>
            <table>
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Тип заказчика</th>
                  <th>Наименование организации / Партнёра</th>
                  <th>Номер договора</th>
                  {canWrite && <th style={{ textAlign: 'right' }}>Действия</th>}
                </tr>
              </thead>
              <tbody>
                {customers.length === 0 ? (
                  <tr>
                    <td colSpan={canWrite ? 5 : 4}>
                      <EmptyState title="Список заказчиков пуст" />
                    </td>
                  </tr>
                ) : (
                  customers.map((c) => (
                    <tr key={c.id}>
                      <td>#{c.id}</td>
                      <td>
                        <Badge variant={c.type === 'ORG' ? 'info' : 'neutral'}>
                          {TYPE_NAMES[c.type] ?? c.type}
                        </Badge>
                      </td>
                      <td>
                        <strong>{c.name}</strong>
                      </td>
                      <td>{c.contractNo ?? <span style={{ color: 'var(--text-subtle)' }}>Без договора</span>}</td>
                      {canWrite && (
                        <td style={{ textAlign: 'right' }} className="actions">
                          <Button variant="outline" size="sm" onClick={() => startEditCustomer(c)}>
                            Править
                          </Button>
                          <Button variant="danger" size="sm" onClick={() => void removeCustomer(c)}>
                            Удалить
                          </Button>
                        </td>
                      )}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </TableWrap>
        </Card>
      )}

      {/* Modal: Client Details (Profile, EHR, Loyalty) */}
      <Modal
        isOpen={selectedClient !== null}
        onClose={() => setSelectedClient(null)}
        title={
          selectedClient
            ? `Карточка гостя: ${selectedClient.lastName} ${selectedClient.firstName} (#${selectedClient.id})`
            : ''
        }
        size="lg"
      >
        {selectedClient && (
          <div>
            <div className="tabs" style={{ margin: '0 0 18px' }}>
              <button
                type="button"
                className={`tab ${clientTab === 'profile' ? 'active' : ''}`}
                onClick={() => setClientTab('profile')}
              >
                Профиль и контакты
              </button>
              <button
                type="button"
                className={`tab ${clientTab === 'ehr' ? 'active' : ''}`}
                onClick={() => setClientTab('ehr')}
              >
                Медкарта (EHR) & Диагнозы
              </button>
              <button
                type="button"
                className={`tab ${clientTab === 'loyalty' ? 'active' : ''}`}
                onClick={() => setClientTab('loyalty')}
              >
                Лояльность ({clientLoyalty ? `${clientLoyalty.balance} б.` : '...'})
              </button>
            </div>

            {/* TAB 1: Profile & Contacts */}
            {clientTab === 'profile' && (
              <form onSubmit={saveClientProfile}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14 }}>
                  <Field label="Фамилия" required>
                    <input
                      value={editForm.lastName}
                      required
                      onChange={(e) => setEditForm({ ...editForm, lastName: e.target.value })}
                    />
                  </Field>
                  <Field label="Имя" required>
                    <input
                      value={editForm.firstName}
                      required
                      onChange={(e) => setEditForm({ ...editForm, firstName: e.target.value })}
                    />
                  </Field>
                  <Field label="Отчество">
                    <input
                      value={editForm.middleName}
                      onChange={(e) => setEditForm({ ...editForm, middleName: e.target.value })}
                    />
                  </Field>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                  <Field label="Дата рождения" required>
                    <input
                      type="date"
                      value={editForm.birthDate}
                      required
                      onChange={(e) => setEditForm({ ...editForm, birthDate: e.target.value })}
                    />
                  </Field>
                  <Field label="Гражданство">
                    <input
                      value={editForm.citizenship}
                      onChange={(e) => setEditForm({ ...editForm, citizenship: e.target.value })}
                    />
                  </Field>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                  <Field label="Номер телефона">
                    <input
                      type="tel"
                      value={editForm.phone}
                      onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                    />
                  </Field>
                  <Field label="Email">
                    <input
                      type="email"
                      value={editForm.email}
                      onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                    />
                  </Field>
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 18 }}>
                  <Button type="button" variant="secondary" onClick={() => setSelectedClient(null)}>
                    Закрыть
                  </Button>
                  <Button type="submit" variant="primary" disabled={busy}>
                    Сохранить изменения
                  </Button>
                </div>
              </form>
            )}

            {/* TAB 2: EHR & Conditions */}
            {clientTab === 'ehr' && clientEhr && (
              <div>
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    background: 'var(--surface-alt)',
                    padding: '12px 16px',
                    borderRadius: 'var(--radius-md)',
                    marginBottom: 16,
                  }}
                >
                  <div>
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Санаторная карта:</span>
                    <div style={{ fontWeight: 700, color: 'var(--accent)' }}>
                      {clientEhr.sanatoriumCardNumber ?? 'СКК-2026/001'} (от {clientEhr.cardIssuedDate})
                    </div>
                  </div>
                  <div>
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Диагноз:</span>
                    <div style={{ fontWeight: 600 }}>{clientEhr.mainDiagnosis || 'Оздоровление'}</div>
                  </div>
                  <div>
                    <Badge variant="info">Диета: {clientEhr.dietCode || 'Стандарт'}</Badge>
                  </div>
                </div>

                {/* Vitals preview */}
                <div className="ehr-vitals-grid" style={{ marginBottom: 16 }}>
                  <div className="ehr-vital-card">
                    <span className="ehr-vital-label">АД (давление)</span>
                    <div className="ehr-vital-value">
                      {clientEhr.systolicBp ?? 120} / {clientEhr.diastolicBp ?? 80}
                    </div>
                  </div>
                  <div className="ehr-vital-card">
                    <span className="ehr-vital-label">Пульс</span>
                    <div className="ehr-vital-value">{clientEhr.pulseBpm ?? 72} уд/мин</div>
                  </div>
                  <div className="ehr-vital-card">
                    <span className="ehr-vital-label">Рост / Вес</span>
                    <div className="ehr-vital-value">
                      {clientEhr.heightCm} см / {clientEhr.weightKg} кг
                    </div>
                  </div>
                  <div className="ehr-vital-card">
                    <span className="ehr-vital-label">Группа крови</span>
                    <div className="ehr-vital-value">{clientEhr.bloodType || 'A (II) Rh+'}</div>
                  </div>
                </div>

                <h4 style={{ margin: '14px 0 8px', fontSize: '0.92rem' }}>Зарегистрированные состояния здоровья</h4>
                <TableWrap>
                  <table>
                    <thead>
                      <tr>
                        <th>Код МКБ</th>
                        <th>Название состояния</th>
                        <th>Дата</th>
                        <th style={{ textAlign: 'right' }}>Действия</th>
                      </tr>
                    </thead>
                    <tbody>
                      {conditions.length === 0 ? (
                        <tr>
                          <td colSpan={4}>
                            <EmptyState title="Состояния здоровья не зарегистрированы" />
                          </td>
                        </tr>
                      ) : (
                        conditions.map((c) => (
                          <tr key={c.conditionId}>
                            <td>{c.code}</td>
                            <td>{c.name}</td>
                            <td>{c.diagnosedAt ?? '—'}</td>
                            <td style={{ textAlign: 'right' }} className="actions">
                              <Button
                                variant="danger"
                                size="sm"
                                onClick={() => void removeCondition(c.conditionId)}
                              >
                                Удалить
                              </Button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </TableWrap>

                <div
                  style={{
                    display: 'flex',
                    gap: 12,
                    alignItems: 'flex-end',
                    background: 'var(--surface-alt)',
                    padding: 12,
                    borderRadius: 'var(--radius-md)',
                    marginTop: 12,
                  }}
                >
                  <Field label="Добавить состояние в карту" style={{ margin: 0, flex: 1 }}>
                    <select
                      value={newConditionId}
                      onChange={(e) => setNewConditionId(e.target.value)}
                    >
                      <option value="">— Выберите из классификатора —</option>
                      {allConditions.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.code} — {c.name}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Button
                    variant="primary"
                    disabled={!newConditionId}
                    onClick={() => void addCondition()}
                  >
                    + Добавить
                  </Button>
                </div>
              </div>
            )}

            {/* TAB 3: Loyalty & Bonuses */}
            {clientTab === 'loyalty' && clientLoyalty && (
              <div>
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    background: 'var(--surface-alt)',
                    padding: '16px 20px',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--line)',
                    marginBottom: 16,
                  }}
                >
                  <div>
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Уровень гостя:</span>
                    <div style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--accent)' }}>
                      {clientLoyalty.tierName} ({clientLoyalty.cashbackPercent}% кешбэк)
                    </div>
                  </div>
                  <div>
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Баланс бонусов:</span>
                    <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--ok)' }}>
                      {clientLoyalty.balance.toLocaleString('ru-RU')} б.
                    </div>
                  </div>
                  <div>
                    <Button variant="primary" size="sm" onClick={() => setBonusModalOpen(true)}>
                      + Начислить баллы
                    </Button>
                  </div>
                </div>

                <h4 style={{ margin: '14px 0 8px', fontSize: '0.92rem' }}>История бонусных начислений</h4>
                <TableWrap>
                  <table>
                    <thead>
                      <tr>
                        <th>Дата</th>
                        <th>Тип</th>
                        <th>Баллы</th>
                        <th>Описание</th>
                      </tr>
                    </thead>
                    <tbody>
                      {clientTransactions.length === 0 ? (
                        <tr>
                          <td colSpan={4}>
                            <EmptyState title="Транзакций пока нет" />
                          </td>
                        </tr>
                      ) : (
                        clientTransactions.map((tx) => (
                          <tr key={tx.id}>
                            <td>{formatDateTime(tx.createdAt)}</td>
                            <td>
                              <Badge variant={tx.amount > 0 ? 'good' : 'wait'}>
                                {tx.type}
                              </Badge>
                            </td>
                            <td
                              style={{
                                fontWeight: 700,
                                color: tx.amount > 0 ? 'var(--ok)' : 'var(--danger)',
                              }}
                            >
                              {tx.amount > 0 ? `+${tx.amount}` : tx.amount} б.
                            </td>
                            <td>{tx.description}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </TableWrap>
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* Modal: Create Client */}
      <Modal
        isOpen={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        title="Регистрация нового гостя"
        size="md"
      >
        <form onSubmit={handleCreateClient}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <Field label="Фамилия" required>
              <input
                value={newClientForm.lastName}
                required
                placeholder="Смирнов"
                onChange={(e) => setNewClientForm({ ...newClientForm, lastName: e.target.value })}
              />
            </Field>
            <Field label="Имя" required>
              <input
                value={newClientForm.firstName}
                required
                placeholder="Алексей"
                onChange={(e) => setNewClientForm({ ...newClientForm, firstName: e.target.value })}
              />
            </Field>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <Field label="Отчество">
              <input
                value={newClientForm.middleName}
                placeholder="Сергеевич"
                onChange={(e) => setNewClientForm({ ...newClientForm, middleName: e.target.value })}
              />
            </Field>
            <Field label="Дата рождения" required>
              <input
                type="date"
                value={newClientForm.birthDate}
                required
                onChange={(e) => setNewClientForm({ ...newClientForm, birthDate: e.target.value })}
              />
            </Field>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <Field label="Телефон">
              <input
                type="tel"
                value={newClientForm.phone}
                placeholder="+375 29 111-22-33"
                onChange={(e) => setNewClientForm({ ...newClientForm, phone: e.target.value })}
              />
            </Field>
            <Field label="Email">
              <input
                type="email"
                value={newClientForm.email}
                placeholder="client@mail.ru"
                onChange={(e) => setNewClientForm({ ...newClientForm, email: e.target.value })}
              />
            </Field>
          </div>

          <Field label="Гражданство">
            <input
              value={newClientForm.citizenship}
              placeholder="Республика Беларусь"
              onChange={(e) => setNewClientForm({ ...newClientForm, citizenship: e.target.value })}
            />
          </Field>

          <div
            style={{
              display: 'flex',
              justifyContent: 'flex-end',
              gap: 10,
              marginTop: 20,
              paddingTop: 16,
              borderTop: '1px solid var(--line)',
            }}
          >
            <Button type="button" variant="secondary" onClick={() => setCreateModalOpen(false)}>
              Отмена
            </Button>
            <Button type="submit" variant="primary" disabled={busy}>
              Зарегистрировать гостя
            </Button>
          </div>
        </form>
      </Modal>

      {/* Modal: Manual Loyalty Bonus Accrual */}
      <Modal
        isOpen={bonusModalOpen}
        onClose={() => setBonusModalOpen(false)}
        title={`Начисление бонусов гостю #${selectedClient?.id ?? ''}`}
        size="sm"
      >
        <form onSubmit={handleAddLoyaltyBonus}>
          <Field label="Количество бонусных баллов" required hint="1 балл = 1 BYN">
            <input
              type="number"
              min={1}
              value={bonusAmount}
              required
              onChange={(e) => setBonusAmount(e.target.value)}
            />
          </Field>
          <Field label="Причина начисления / Основание" required>
            <input
              value={bonusDescription}
              required
              onChange={(e) => setBonusDescription(e.target.value)}
            />
          </Field>
          <div
            style={{
              display: 'flex',
              justifyContent: 'flex-end',
              gap: 10,
              marginTop: 18,
              paddingTop: 14,
              borderTop: '1px solid var(--line)',
            }}
          >
            <Button type="button" variant="secondary" onClick={() => setBonusModalOpen(false)}>
              Отмена
            </Button>
            <Button type="submit" variant="primary">
              Начислить
            </Button>
          </div>
        </form>
      </Modal>

      {/* Modal: Customer Create/Edit */}
      <Modal
        isOpen={customerModalOpen}
        onClose={() => setCustomerModalOpen(false)}
        title={custEditId === null ? 'Новый корпоративный заказчик' : `Правка заказчика #${custEditId}`}
        size="md"
      >
        <form onSubmit={saveCustomer}>
          <Field label="Тип контрагента" required>
            <select
              value={custForm.type}
              onChange={(e) => setCustForm({ ...custForm, type: e.target.value as Customer['type'] })}
            >
              <option value="ORG">Организация (Юридическое лицо)</option>
              <option value="PERSON">Физическое лицо (Индивидуальный договор)</option>
            </select>
          </Field>
          <Field label="Наименование организации" required>
            <input
              value={custForm.name}
              required
              placeholder="ОАО «Беларуськалий»"
              onChange={(e) => setCustForm({ ...custForm, name: e.target.value })}
            />
          </Field>
          <Field label="Номер договора">
            <input
              value={custForm.contractNo}
              placeholder="Д-2026/01-САК"
              onChange={(e) => setCustForm({ ...custForm, contractNo: e.target.value })}
            />
          </Field>

          <div
            style={{
              display: 'flex',
              justifyContent: 'flex-end',
              gap: 10,
              marginTop: 20,
              paddingTop: 16,
              borderTop: '1px solid var(--line)',
            }}
          >
            <Button type="button" variant="secondary" onClick={() => setCustomerModalOpen(false)}>
              Отмена
            </Button>
            <Button type="submit" variant="primary" disabled={busy}>
              Сохранить
            </Button>
          </div>
        </form>
      </Modal>
    </section>
  );
}
