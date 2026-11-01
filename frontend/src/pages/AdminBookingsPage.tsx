import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { booking, clients, directory, waitlist } from '../api/endpoints';
import {
  Button,
  Card,
  EmptyState,
  ErrorBox,
  Field,
  formatDateTime,
  Modal,
  money,
  SearchBar,
  StatCard,
  StatusBadge,
  TableWrap,
  today,
} from '../components/ui';
import type {
  ClientRequest,
  ClientView,
  Coded,
  ConditionView,
  Customer,
  RoomCategory,
  SalesChannel,
  VoucherView,
  WaitlistEntry,
} from '../types';

export default function AdminBookingsPage() {
  const [error, setError] = useState<unknown>(null);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  // Modals state
  const [isVoucherModalOpen, setIsVoucherModalOpen] = useState(false);
  const [isClientModalOpen, setIsClientModalOpen] = useState(false);
  const [isWaitlistModalOpen, setIsWaitlistModalOpen] = useState(false);
  const [selectedVoucher, setSelectedVoucher] = useState<VoucherView | null>(null);
  const [clientConditions, setClientConditions] = useState<ConditionView[]>([]);

  // Directory / references
  const [clientList, setClientList] = useState<ClientView[]>([]);
  const [categories, setCategories] = useState<RoomCategory[]>([]);
  const [profiles, setProfiles] = useState<Coded[]>([]);
  const [diets, setDiets] = useState<Coded[]>([]);
  const [channels, setChannels] = useState<SalesChannel[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [queue, setQueue] = useState<WaitlistEntry[]>([]);

  // Vouchers list & filters
  const [vouchers, setVouchers] = useState<VoucherView[]>([]);
  const [statusFilter, setStatusFilter] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  // Form states: New Voucher
  const [clientId, setClientId] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [profileId, setProfileId] = useState('');
  const [channelId, setChannelId] = useState('');
  const [dietId, setDietId] = useState('');
  const [customerId, setCustomerId] = useState('');
  const [checkIn, setCheckIn] = useState(today(1));
  const [checkOut, setCheckOut] = useState(today(7));
  const [places, setPlaces] = useState(1);

  // Form states: New Client
  const [newClient, setNewClient] = useState<ClientRequest>({
    lastName: '',
    firstName: '',
    middleName: '',
    birthDate: '',
    phone: '',
    email: '',
  });

  const loadData = async () => {
    setLoading(true);
    try {
      const [vList, cList, cats, profs, dts, chs, custs, wl] = await Promise.all([
        booking.all(),
        clients.search(''),
        directory.categories(),
        directory.profiles(),
        directory.diets(),
        directory.channels(),
        directory.customers().catch(() => [] as Customer[]),
        waitlist.all('OPEN').catch(() => [] as WaitlistEntry[]),
      ]);
      setVouchers(vList);
      setClientList(cList);
      setCategories(cats);
      setProfiles(profs);
      setDiets(dts);
      setChannels(chs);
      setCustomers(custs);
      setQueue(wl);

      if (profs.length > 0 && !profileId) setProfileId(String(profs[0].id));
      if (chs.length > 0 && !channelId) setChannelId(String(chs[0].id));
      if (cats.length > 0 && !categoryId) setCategoryId(String(cats[0].id));
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function runAction(fn: () => Promise<void>) {
    setError(null);
    setMessage('');
    try {
      await fn();
    } catch (err) {
      setError(err);
    }
  }

  const clientName = (id: number) => {
    const c = clientList.find((x) => x.id === id);
    return c ? `${c.lastName} ${c.firstName} ${c.middleName ?? ''}`.trim() : `Клиент #${id}`;
  };

  const clientObj = (id: number) => clientList.find((x) => x.id === id);

  const categoryName = (id: number | null | undefined) => {
    if (!id) return 'Не указана';
    return categories.find((c) => c.id === id)?.name ?? `Категория #${id}`;
  };

  const openVoucherDetail = async (v: VoucherView) => {
    setSelectedVoucher(v);
    setClientConditions([]);
    if (v.clientId) {
      try {
        const conds = await clients.conditions(v.clientId);
        setClientConditions(conds);
      } catch {
        // ignore
      }
    }
  };

  const handleStatusFilterChange = (st: string) => {
    setStatusFilter(st);
    void runAction(async () => {
      const list = await booking.all(st || undefined);
      setVouchers(list);
    });
  };

  // Filtered vouchers by query
  const filteredVouchers = useMemo(() => {
    return vouchers.filter((v) => {
      if (!searchQuery) return true;
      const q = searchQuery.toLowerCase().trim();
      const c = clientList.find((x) => x.id === v.clientId);
      const guestName = c ? `${c.lastName} ${c.firstName} ${c.phone ?? ''}`.toLowerCase() : '';
      const vId = String(v.id);
      const room = (v.roomNumber ?? '').toLowerCase();
      return vId.includes(q) || guestName.includes(q) || room.includes(q);
    });
  }, [vouchers, searchQuery, clientList]);

  // Calculations for stats
  const stats = useMemo(() => {
    const total = vouchers.length;
    const awaiting = vouchers.filter((v) => v.status === 'AWAITING_PAYMENT').length;
    const checkedIn = vouchers.filter((v) => v.status === 'CHECKED_IN').length;
    const confirmed = vouchers.filter((v) => v.status === 'CONFIRMED').length;
    return { total, awaiting, checkedIn, confirmed };
  }, [vouchers]);

  // Validation for voucher form
  const chosenCategory = categories.find((c) => String(c.id) === categoryId) ?? null;
  const capacityExceeded = chosenCategory !== null && places > chosenCategory.capacityTotal;
  const isVoucherFormValid =
    Boolean(clientId) &&
    Boolean(categoryId) &&
    Boolean(profileId) &&
    Boolean(channelId) &&
    Boolean(checkIn) &&
    Boolean(checkOut) &&
    checkOut > checkIn &&
    places >= 1 &&
    !capacityExceeded;

  const handleCreateVoucher = (e: FormEvent) => {
    e.preventDefault();
    if (!isVoucherFormValid) return;
    void runAction(async () => {
      const created = await booking.create({
        clientId: Number(clientId),
        categoryId: Number(categoryId),
        checkIn,
        checkOut,
        places,
        profileId: Number(profileId),
        channelId: Number(channelId),
        dietId: dietId ? Number(dietId) : undefined,
        customerId: customerId ? Number(customerId) : undefined,
      });
      setMessage(`Путёвка № ${created.id} успешно оформлена!`);
      setIsVoucherModalOpen(false);
      const freshVouchers = await booking.all(statusFilter || undefined);
      setVouchers(freshVouchers);
      await openVoucherDetail(created);
    });
  };

  const handleCreateClient = (e: FormEvent) => {
    e.preventDefault();
    void runAction(async () => {
      const created = await clients.create({
        lastName: newClient.lastName,
        firstName: newClient.firstName,
        middleName: newClient.middleName || undefined,
        birthDate: newClient.birthDate,
        phone: newClient.phone || undefined,
        email: newClient.email || undefined,
      });
      setMessage(`Клиент ${created.lastName} ${created.firstName} добавлен (ID #${created.id}).`);
      setNewClient({ lastName: '', firstName: '', middleName: '', birthDate: '', phone: '', email: '' });
      const freshClients = await clients.search('');
      setClientList(freshClients);
      setClientId(String(created.id)); // Auto-select for voucher creation
      setIsClientModalOpen(false);
    });
  };

  const handleVoucherAction = (actionFn: (id: number) => Promise<unknown>, successMsg: string) => {
    if (!selectedVoucher) return;
    void runAction(async () => {
      await actionFn(selectedVoucher.id);
      const fresh = await booking.one(selectedVoucher.id);
      setSelectedVoucher(fresh);
      const list = await booking.all(statusFilter || undefined);
      setVouchers(list);
      setMessage(successMsg);
    });
  };

  const handleCancelVoucher = () => {
    if (!selectedVoucher) return;
    if (!window.confirm(`Вы уверены, что хотите отменить путёвку № ${selectedVoucher.id}?`)) return;
    void runAction(async () => {
      const res = await booking.cancel(selectedVoucher.id);
      setSelectedVoucher(res.voucher);
      const list = await booking.all(statusFilter || undefined);
      setVouchers(list);
      setMessage(`Путёвка отменена. Удержано: ${money(res.retained)} (${res.retainPercent}%), к возврату: ${money(res.refund)}.`);
    });
  };

  const handleRemoveFromWaitlist = (id: number) => {
    void runAction(async () => {
      await waitlist.remove(id);
      const freshWl = await waitlist.all('OPEN');
      setQueue(freshWl);
      setMessage('Запись исключена из листа ожидания.');
    });
  };

  const calculateNights = (start: string | null, end: string | null) => {
    if (!start || !end) return 0;
    const diff = new Date(end).getTime() - new Date(start).getTime();
    return Math.max(0, Math.round(diff / (1000 * 3600 * 24)));
  };

  return (
    <section>
      {/* Top Header */}
      <div className="page-head">
        <div>
          <h1>Управление бронированием</h1>
          <p className="card-subtitle">
            Оформление путёвок, регистрация гостей, заселение/выселение и работа с очередью
          </p>
        </div>
        <div className="row">
          <Button variant="primary" onClick={() => setIsVoucherModalOpen(true)}>
            + Оформить путёвку
          </Button>
          <Button variant="secondary" onClick={() => setIsClientModalOpen(true)}>
            + Новый клиент
          </Button>
          <Button variant="outline" onClick={() => setIsWaitlistModalOpen(true)}>
            Лист ожидания ({queue.length})
          </Button>
        </div>
      </div>

      <ErrorBox error={error} />
      {message && <p className="ok">{message}</p>}

      {/* KPI Stats Grid */}
      <div className="kpi-grid">
        <StatCard
          label="Всего путёвок"
          value={stats.total}
          subvalue="В текущей выборке"
          color="default"
        />
        <StatCard
          label="Ожидают оплаты"
          value={stats.awaiting}
          subvalue="Требуют внимания"
          color="c-amber"
        />
        <StatCard
          label="Подтверждены"
          value={stats.confirmed}
          subvalue="Готовы к заезду"
          color="c-blue"
        />
        <StatCard
          label="Заселены в номера"
          value={stats.checkedIn}
          subvalue="Проживают сейчас"
          color="c-teal"
        />
      </div>

      {/* Search and Filters Toolbar */}
      <Card>
        <div className="filter-toolbar">
          <div className="tabs" style={{ margin: 0 }}>
            <button
              type="button"
              className={`tab ${statusFilter === '' ? 'active' : ''}`}
              onClick={() => handleStatusFilterChange('')}
            >
              Все
            </button>
            <button
              type="button"
              className={`tab ${statusFilter === 'AWAITING_PAYMENT' ? 'active' : ''}`}
              onClick={() => handleStatusFilterChange('AWAITING_PAYMENT')}
            >
              Ожидают оплаты
            </button>
            <button
              type="button"
              className={`tab ${statusFilter === 'CONFIRMED' ? 'active' : ''}`}
              onClick={() => handleStatusFilterChange('CONFIRMED')}
            >
              Подтверждённые
            </button>
            <button
              type="button"
              className={`tab ${statusFilter === 'CHECKED_IN' ? 'active' : ''}`}
              onClick={() => handleStatusFilterChange('CHECKED_IN')}
            >
              Заселены
            </button>
            <button
              type="button"
              className={`tab ${statusFilter === 'COMPLETED' ? 'active' : ''}`}
              onClick={() => handleStatusFilterChange('COMPLETED')}
            >
              Завершены
            </button>
            <button
              type="button"
              className={`tab ${statusFilter === 'CANCELLED' ? 'active' : ''}`}
              onClick={() => handleStatusFilterChange('CANCELLED')}
            >
              Отменены
            </button>
          </div>

          <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            <SearchBar
              value={searchQuery}
              onChange={setSearchQuery}
              placeholder="Поиск по номеру, гостю, комнате..."
            />
            <Button variant="outline" size="sm" onClick={() => void loadData()} disabled={loading}>
              Обновить
            </Button>
          </div>
        </div>

        {/* Vouchers Table */}
        <TableWrap>
          <table>
            <thead>
              <tr>
                <th>№ Путёвки</th>
                <th>Гость / Телефон</th>
                <th>Категория / Номер</th>
                <th>Даты заезда</th>
                <th>Ночей</th>
                <th>Мест</th>
                <th>Стоимость / Оплата</th>
                <th>Статус</th>
                <th style={{ textAlign: 'right' }}>Действия</th>
              </tr>
            </thead>
            <tbody>
              {filteredVouchers.length === 0 ? (
                <tr>
                  <td colSpan={9}>
                    <EmptyState
                      title="Путёвки не найдены"
                      description={
                        searchQuery
                          ? 'По вашему поисковому запросу ничего не найдено.'
                          : 'В данной категории пока нет оформленных путёвок.'
                      }
                      action={
                        <Button variant="primary" size="sm" onClick={() => setIsVoucherModalOpen(true)}>
                          Оформить путёвку
                        </Button>
                      }
                    />
                  </td>
                </tr>
              ) : (
                filteredVouchers.map((v) => {
                  const client = clientObj(v.clientId);
                  const nights = calculateNights(v.checkIn, v.checkOut);
                  const isPaid = (v.paid ?? 0) >= (v.totalPrice ?? 0) && (v.totalPrice ?? 0) > 0;
                  return (
                    <tr
                      key={v.id}
                      className={selectedVoucher?.id === v.id ? 'active-row' : ''}
                      style={{ cursor: 'pointer' }}
                      onClick={() => void openVoucherDetail(v)}
                    >
                      <td>
                        <strong>#{v.id}</strong>
                      </td>
                      <td>
                        <div style={{ fontWeight: 600 }}>{clientName(v.clientId)}</div>
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                          {client?.phone || client?.email || 'Контакты не указаны'}
                        </div>
                      </td>
                      <td>
                        <div>{categoryName(v.categoryId)}</div>
                        {v.roomNumber ? (
                          <span style={{ fontSize: '0.82rem', color: 'var(--accent)', fontWeight: 600 }}>
                            Комната №{v.roomNumber}
                          </span>
                        ) : (
                          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Без комнаты</span>
                        )}
                      </td>
                      <td>
                        <div style={{ fontSize: '0.88rem' }}>
                          {v.checkIn} — {v.checkOut}
                        </div>
                      </td>
                      <td>{nights} ноч.</td>
                      <td>{v.places ?? 1}</td>
                      <td>
                        <div style={{ fontWeight: 600 }}>{money(v.totalPrice)}</div>
                        <div
                          style={{
                            fontSize: '0.78rem',
                            color: isPaid ? 'var(--ok)' : 'var(--amber)',
                            fontWeight: 500,
                          }}
                        >
                          Оплачено: {money(v.paid)}
                        </div>
                      </td>
                      <td>
                        <StatusBadge status={v.status} />
                      </td>
                      <td style={{ textAlign: 'right' }} className="actions" onClick={(e) => e.stopPropagation()}>
                        <Button size="sm" variant="outline" onClick={() => void openVoucherDetail(v)}>
                          Детали
                        </Button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </TableWrap>
      </Card>

      {/* Modal: Voucher Detail View & Actions */}
      <Modal
        isOpen={selectedVoucher !== null}
        onClose={() => setSelectedVoucher(null)}
        title={selectedVoucher ? `Путёвка #${selectedVoucher.id}` : ''}
        size="lg"
      >
        {selectedVoucher && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <StatusBadge status={selectedVoucher.status} />
              <span style={{ fontSize: '0.86rem', color: 'var(--text-muted)' }}>
                Срок оплаты: {formatDateTime(selectedVoucher.paymentDeadline)}
              </span>
            </div>

            <div className="detail-grid">
              <div className="detail-card-panel">
                <h4>👤 Гость</h4>
                <div style={{ fontWeight: 700, fontSize: '1.05rem', marginBottom: 4 }}>
                  {clientName(selectedVoucher.clientId)}
                </div>
                {(() => {
                  const c = clientObj(selectedVoucher.clientId);
                  return (
                    <div style={{ fontSize: '0.88rem', color: 'var(--text-muted)', lineHeight: 1.6 }}>
                      {c?.phone && <div>Телефон: <strong>{c.phone}</strong></div>}
                      {c?.birthDate && <div>Дата рождения: <strong>{c.birthDate}</strong></div>}
                      {c?.email && <div>Email: <strong>{c.email}</strong></div>}
                    </div>
                  );
                })()}

                {clientConditions.length > 0 && (
                  <div style={{ marginTop: 12 }}>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: 4 }}>
                      Медицинские состояния:
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                      {clientConditions.map((cond) => (
                        <span key={cond.conditionId} className="badge info" style={{ fontSize: '0.75rem' }}>
                          {cond.name}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="detail-card-panel">
                <h4>🛏️ Размещение</h4>
                <dl style={{ margin: 0, fontSize: '0.9rem' }}>
                  <dt>Категория:</dt>
                  <dd>{categoryName(selectedVoucher.categoryId)}</dd>
                  <dt>Номер:</dt>
                  <dd>{selectedVoucher.roomNumber ? `Комната №${selectedVoucher.roomNumber}` : 'Не назначен'}</dd>
                  <dt>Заезд:</dt>
                  <dd>{selectedVoucher.checkIn ?? '—'}</dd>
                  <dt>Выезд:</dt>
                  <dd>{selectedVoucher.checkOut ?? '—'}</dd>
                  <dt>Длительность:</dt>
                  <dd>{calculateNights(selectedVoucher.checkIn, selectedVoucher.checkOut)} ночей</dd>
                  <dt>Мест в заявке:</dt>
                  <dd>{selectedVoucher.places ?? 1}</dd>
                </dl>
              </div>

              <div className="detail-card-panel">
                <h4>💳 Финансы</h4>
                <dl style={{ margin: 0, fontSize: '0.9rem' }}>
                  <dt>Общая сумма:</dt>
                  <dd style={{ color: 'var(--accent)', fontWeight: 700, fontSize: '1.1rem' }}>
                    {money(selectedVoucher.totalPrice)}
                  </dd>
                  <dt>Оплачено:</dt>
                  <dd style={{ color: 'var(--ok)', fontWeight: 600 }}>{money(selectedVoucher.paid)}</dd>
                  <dt>Остаток долга:</dt>
                  <dd style={{ color: 'var(--danger)', fontWeight: 600 }}>
                    {money(Math.max(0, (selectedVoucher.totalPrice ?? 0) - (selectedVoucher.paid ?? 0)))}
                  </dd>
                  <dt>Цена в сутки/место:</dt>
                  <dd>{money(selectedVoucher.pricePerPlaceDay)}</dd>
                </dl>
              </div>
            </div>

            {/* Action Buttons Toolbar */}
            <div
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: 10,
                marginTop: 20,
                paddingTop: 16,
                borderTop: '1px solid var(--line)',
                alignItems: 'center',
                justifyContent: 'flex-end',
              }}
            >
              {selectedVoucher.status === 'CONFIRMED' && (
                <Button
                  variant="primary"
                  onClick={() => handleVoucherAction(booking.checkIn, 'Гость успешно заселён в номер!')}
                >
                  🏨 Заселить гостя
                </Button>
              )}

              {selectedVoucher.status === 'CHECKED_IN' && (
                <Button
                  variant="primary"
                  onClick={() => handleVoucherAction(booking.checkOut, 'Гость успешно выселен!')}
                >
                  🚪 Выселить гостя
                </Button>
              )}

              {((selectedVoucher.paid ?? 0) < (selectedVoucher.totalPrice ?? 0) ||
                selectedVoucher.status === 'AWAITING_PAYMENT') &&
                selectedVoucher.status !== 'CANCELLED' &&
                selectedVoucher.status !== 'COMPLETED' && (
                  <Button
                    variant="outline"
                    onClick={() => handleVoucherAction(booking.pay, 'Оплата успешно зарегистрирована!')}
                  >
                    💳 Провести оплату
                  </Button>
                )}

              {selectedVoucher.status !== 'COMPLETED' && selectedVoucher.status !== 'CANCELLED' && (
                <Button variant="danger" onClick={handleCancelVoucher}>
                  Аннулировать бронь
                </Button>
              )}

              <Button variant="secondary" onClick={() => setSelectedVoucher(null)}>
                Закрыть
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Modal: Create Voucher */}
      <Modal
        isOpen={isVoucherModalOpen}
        onClose={() => setIsVoucherModalOpen(false)}
        title="Оформление новой путёвки"
        size="md"
      >
        <form onSubmit={handleCreateVoucher}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-muted)' }}>
              Выберите существующего гостя или создайте нового
            </span>
            <Button
              type="button"
              variant="link"
              size="sm"
              onClick={() => {
                setIsVoucherModalOpen(false);
                setIsClientModalOpen(true);
              }}
            >
              + Создать гостя
            </Button>
          </div>

          <Field label="Гость (Клиент)" required error={!clientId ? 'Необходимо выбрать клиента' : undefined}>
            <select value={clientId} onChange={(e) => setClientId(e.target.value)} required>
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
            <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} required>
              <option value="">— Выберите категорию номера —</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} (до {c.capacityTotal} чел.)
                </option>
              ))}
            </select>
          </Field>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <Field label="Дата заезда" required>
              <input type="date" value={checkIn} onChange={(e) => setCheckIn(e.target.value)} required />
            </Field>
            <Field
              label="Дата выезда"
              required
              error={checkOut <= checkIn ? 'Дата выезда должна быть позже даты заезда' : undefined}
            >
              <input type="date" value={checkOut} onChange={(e) => setCheckOut(e.target.value)} required />
            </Field>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <Field
              label="Количество мест"
              required
              error={capacityExceeded ? `Превышена вместимость категории (${chosenCategory?.capacityTotal})` : undefined}
            >
              <input
                type="number"
                min={1}
                max={chosenCategory ? chosenCategory.capacityTotal : 10}
                value={places}
                onChange={(e) => setPlaces(Number(e.target.value))}
                required
              />
            </Field>

            <Field label="Канал продаж" required>
              <select value={channelId} onChange={(e) => setChannelId(e.target.value)} required>
                {channels.map((ch) => (
                  <option key={ch.id} value={ch.id}>
                    {ch.name} ({ch.commissionPct}%)
                  </option>
                ))}
              </select>
            </Field>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <Field label="Лечебный профиль" required>
              <select value={profileId} onChange={(e) => setProfileId(e.target.value)} required>
                {profiles.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="План питания (Диета)">
              <select value={dietId} onChange={(e) => setDietId(e.target.value)}>
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
              <select value={customerId} onChange={(e) => setCustomerId(e.target.value)}>
                <option value="">— Индивидуальный клиент —</option>
                {customers.map((cust) => (
                  <option key={cust.id} value={cust.id}>
                    {cust.name} {cust.contractNo ? `(дог. ${cust.contractNo})` : ''}
                  </option>
                ))}
              </select>
            </Field>
          )}

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
            <Button type="button" variant="secondary" onClick={() => setIsVoucherModalOpen(false)}>
              Отмена
            </Button>
            <Button type="submit" variant="primary" disabled={!isVoucherFormValid}>
              Оформить путёвку
            </Button>
          </div>
        </form>
      </Modal>

      {/* Modal: Create Client */}
      <Modal
        isOpen={isClientModalOpen}
        onClose={() => setIsClientModalOpen(false)}
        title="Новая карточка гостя"
        size="md"
      >
        <form onSubmit={handleCreateClient}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <Field label="Фамилия" required>
              <input
                value={newClient.lastName}
                required
                placeholder="Иванов"
                onChange={(e) => setNewClient({ ...newClient, lastName: e.target.value })}
              />
            </Field>
            <Field label="Имя" required>
              <input
                value={newClient.firstName}
                required
                placeholder="Иван"
                onChange={(e) => setNewClient({ ...newClient, firstName: e.target.value })}
              />
            </Field>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <Field label="Отчество">
              <input
                value={newClient.middleName ?? ''}
                placeholder="Иванович"
                onChange={(e) => setNewClient({ ...newClient, middleName: e.target.value })}
              />
            </Field>
            <Field label="Дата рождения" required>
              <input
                type="date"
                value={newClient.birthDate}
                required
                onChange={(e) => setNewClient({ ...newClient, birthDate: e.target.value })}
              />
            </Field>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <Field label="Номер телефона">
              <input
                type="tel"
                value={newClient.phone ?? ''}
                placeholder="+375 29 123-45-67"
                onChange={(e) => setNewClient({ ...newClient, phone: e.target.value })}
              />
            </Field>
            <Field label="Email">
              <input
                type="email"
                value={newClient.email ?? ''}
                placeholder="guest@example.com"
                onChange={(e) => setNewClient({ ...newClient, email: e.target.value })}
              />
            </Field>
          </div>

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
            <Button type="button" variant="secondary" onClick={() => setIsClientModalOpen(false)}>
              Отмена
            </Button>
            <Button type="submit" variant="primary">
              Создать гостя
            </Button>
          </div>
        </form>
      </Modal>

      {/* Modal: Waitlist Entries */}
      <Modal
        isOpen={isWaitlistModalOpen}
        onClose={() => setIsWaitlistModalOpen(false)}
        title="Лист ожидания (Waitlist)"
        size="lg"
      >
        <div>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: 14 }}>
            Гости, ожидающие освобождения мест в выбранных категориях на желаемые даты.
          </p>

          <TableWrap>
            <table>
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Гость</th>
                  <th>Желаемая категория</th>
                  <th>Период</th>
                  <th>Мест</th>
                  <th>Дата заявки</th>
                  <th style={{ textAlign: 'right' }}>Действия</th>
                </tr>
              </thead>
              <tbody>
                {queue.length === 0 ? (
                  <tr>
                    <td colSpan={7}>
                      <EmptyState
                        title="Лист ожидания пуст"
                        description="Нет гостей, ожидающих появления свободных мест."
                      />
                    </td>
                  </tr>
                ) : (
                  queue.map((entry) => (
                    <tr key={entry.id}>
                      <td>#{entry.id}</td>
                      <td>
                        <strong>{clientName(entry.clientId)}</strong>
                      </td>
                      <td>{categoryName(entry.categoryId)}</td>
                      <td>
                        {entry.dateFrom} — {entry.dateTo}
                      </td>
                      <td>{entry.places}</td>
                      <td>{formatDateTime(entry.createdAt)}</td>
                      <td style={{ textAlign: 'right' }} className="actions">
                        <Button
                          variant="danger"
                          size="sm"
                          onClick={() => handleRemoveFromWaitlist(entry.id)}
                        >
                          Исключить
                        </Button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </TableWrap>

          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 16 }}>
            <Button variant="secondary" onClick={() => setIsWaitlistModalOpen(false)}>
              Закрыть
            </Button>
          </div>
        </div>
      </Modal>
    </section>
  );
}
