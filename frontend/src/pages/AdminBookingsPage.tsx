import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { booking, clients, directory, waitlist } from '../api/endpoints';
import { Button, Card, ErrorBox, money, StatCard, StatusBadge, Tabs, today, useConfirm, useToast } from '../components/ui';
import { DataTable, type Column } from '../components/DataTable';
import { Icon } from '../components/icons';
import CreateVoucherModal, { validateVoucherForm, type VoucherForm } from '../components/bookings/CreateVoucherModal';
import NewClientModal from '../components/bookings/NewClientModal';
import VoucherDetailModal, { type VoucherAction } from '../components/bookings/VoucherDetailModal';
import WaitlistModal from '../components/bookings/WaitlistModal';
import { calculateNights, fullName, isFullyPaid, period } from '../components/bookings/bookingUtils';
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

type StatusFilter = '' | 'AWAITING_PAYMENT' | 'CONFIRMED' | 'CHECKED_IN' | 'COMPLETED' | 'CANCELLED';

const STATUS_TABS: { id: StatusFilter; label: string }[] = [
  { id: '', label: 'Все' },
  { id: 'AWAITING_PAYMENT', label: 'Ожидают оплаты' },
  { id: 'CONFIRMED', label: 'Подтверждённые' },
  { id: 'CHECKED_IN', label: 'Заселены' },
  { id: 'COMPLETED', label: 'Завершены' },
  { id: 'CANCELLED', label: 'Отменены' },
];

const EMPTY_CLIENT: ClientRequest = { lastName: '', firstName: '', middleName: '', birthDate: '', phone: '', email: '' };

export default function AdminBookingsPage() {
  const toast = useToast();
  const [ask, confirmDialog] = useConfirm();
  const [params, setParams] = useSearchParams();
  const [error, setError] = useState<unknown>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);

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

  // Vouchers list & filter (фильтр по статусу — на клиенте, чтобы показывать счётчики вкладок)
  const [vouchers, setVouchers] = useState<VoucherView[]>([]);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('');

  // Forms
  const [voucherForm, setVoucherForm] = useState<VoucherForm>({
    clientId: '',
    categoryId: '',
    profileId: '',
    channelId: '',
    dietId: '',
    customerId: '',
    checkIn: today(1),
    checkOut: today(7),
    places: 1,
  });
  const [newClient, setNewClient] = useState<ClientRequest>(EMPTY_CLIENT);

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
      setVoucherForm((f) => ({
        ...f,
        profileId: f.profileId || (profs[0] ? String(profs[0].id) : ''),
        channelId: f.channelId || (chs[0] ? String(chs[0].id) : ''),
        categoryId: f.categoryId || (cats[0] ? String(cats[0].id) : ''),
      }));
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

  // Возврат из банковского симулятора: ?pay=SUCCESS | DECLINED
  const payResult = params.get('pay');
  useEffect(() => {
    if (!payResult) return;
    if (payResult === 'SUCCESS') toast.success('Оплата успешно зачислена, путёвка подтверждена.');
    else if (payResult === 'DECLINED') toast.warning('Платёж был отклонён банком. Его можно повторить, пока не истёк срок оплаты.');
    void booking.all().then(setVouchers).catch(setError);
    const next = new URLSearchParams(params);
    next.delete('pay');
    setParams(next, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [payResult]);

  async function runAction(key: string, fn: () => Promise<void>) {
    setError(null);
    setBusy(key);
    try {
      await fn();
    } catch (err) {
      setError(err);
    } finally {
      setBusy(null);
    }
  }

  const clientMap = useMemo(() => new Map(clientList.map((c) => [c.id, c])), [clientList]);
  const clientObj = useCallback((id: number) => clientMap.get(id), [clientMap]);
  const clientName = useCallback((id: number) => fullName(clientMap.get(id), id), [clientMap]);
  const categoryName = useCallback(
    (id: number | null | undefined) => {
      if (!id) return 'Не указана';
      return categories.find((c) => c.id === id)?.name ?? `Категория #${id}`;
    },
    [categories],
  );

  const openVoucherDetail = async (v: VoucherView) => {
    setError(null);
    setSelectedVoucher(v);
    setClientConditions([]);
    if (v.clientId) {
      try {
        setClientConditions(await clients.conditions(v.clientId));
      } catch {
        // медицинские состояния необязательны для карточки
      }
    }
  };

  const reloadVouchers = async () => setVouchers(await booking.all());

  // Counters & stats
  const counts = useMemo(() => {
    const m: Record<string, number> = {};
    for (const v of vouchers) m[v.status] = (m[v.status] ?? 0) + 1;
    return m;
  }, [vouchers]);

  const stats = {
    total: vouchers.length,
    awaiting: counts.AWAITING_PAYMENT ?? 0,
    confirmed: counts.CONFIRMED ?? 0,
    checkedIn: counts.CHECKED_IN ?? 0,
  };

  const visibleVouchers = useMemo(
    () => (statusFilter ? vouchers.filter((v) => v.status === statusFilter) : vouchers),
    [vouchers, statusFilter],
  );

  const handleCreateVoucher = () => {
    if (!validateVoucherForm(voucherForm, categories).valid) return;
    const f = voucherForm;
    void runAction('createVoucher', async () => {
      const created = await booking.create({
        clientId: Number(f.clientId),
        categoryId: Number(f.categoryId),
        checkIn: f.checkIn,
        checkOut: f.checkOut,
        places: f.places,
        profileId: Number(f.profileId),
        channelId: Number(f.channelId),
        dietId: f.dietId ? Number(f.dietId) : undefined,
        customerId: f.customerId ? Number(f.customerId) : undefined,
      });
      toast.success(`Путёвка № ${created.id} успешно оформлена!`);
      setIsVoucherModalOpen(false);
      await reloadVouchers();
      await openVoucherDetail(created);
    });
  };

  const handleCreateClient = () => {
    void runAction('createClient', async () => {
      const created = await clients.create({
        lastName: newClient.lastName,
        firstName: newClient.firstName,
        middleName: newClient.middleName || undefined,
        birthDate: newClient.birthDate,
        phone: newClient.phone || undefined,
        email: newClient.email || undefined,
      });
      toast.success(`Клиент ${created.lastName} ${created.firstName} добавлен (ID #${created.id}).`);
      setNewClient(EMPTY_CLIENT);
      setClientList(await clients.search(''));
      setVoucherForm((f) => ({ ...f, clientId: String(created.id) })); // автовыбор для оформления путёвки
      setIsClientModalOpen(false);
    });
  };

  const refreshSelected = async (id: number) => {
    setSelectedVoucher(await booking.one(id));
    await reloadVouchers();
  };

  const handleVoucherAction = async (action: VoucherAction) => {
    const v = selectedVoucher;
    if (!v) return;
    if (action === 'cancel') {
      const ok = await ask({
        title: 'Отмена путёвки',
        message: `Вы уверены, что хотите отменить путёвку № ${v.id}? Удержание рассчитывается по правилам отмены.`,
        confirmLabel: 'Отменить путёвку',
        danger: true,
      });
      if (!ok) return;
      void runAction('cancel', async () => {
        const res = await booking.cancel(v.id);
        setSelectedVoucher(res.voucher);
        await reloadVouchers();
        toast.success(`Путёвка отменена. Удержано: ${money(res.retained)} (${res.retainPercent}%), к возврату: ${money(res.refund)}.`);
      });
      return;
    }
    if (action === 'checkOut') {
      const ok = await ask({
        title: 'Выселение гостя',
        message: `Выселить гостя по путёвке № ${v.id}? Путёвка будет завершена.`,
        confirmLabel: 'Выселить',
        danger: true,
      });
      if (!ok) return;
    }
    void runAction(action, async () => {
      if (action === 'checkIn') {
        await booking.checkIn(v.id);
        await refreshSelected(v.id);
        toast.success('Гость успешно заселён в номер!');
      } else if (action === 'checkOut') {
        await booking.checkOut(v.id);
        await refreshSelected(v.id);
        toast.success('Гость успешно выселен!');
      } else {
        const p = await booking.pay(v.id);
        if (p.payUrl) {
          // Страница оплаты открывается в новой вкладке, администратор остаётся в системе.
          window.open(p.payUrl, '_blank', 'noopener');
          toast.info('Страница оплаты открыта в новой вкладке.');
        } else {
          toast.success('Оплата успешно зарегистрирована!');
        }
        await refreshSelected(v.id);
      }
    });
  };

  const handleRemoveFromWaitlist = async (entry: WaitlistEntry) => {
    const ok = await ask({
      title: 'Лист ожидания',
      message: `Исключить ${clientName(entry.clientId)} из листа ожидания?`,
      confirmLabel: 'Исключить',
      danger: true,
    });
    if (!ok) return;
    void runAction(`wl-${entry.id}`, async () => {
      await waitlist.remove(entry.id);
      setQueue(await waitlist.all('OPEN'));
      toast.success('Запись исключена из листа ожидания.');
    });
  };

  const columns = useMemo<Column<VoucherView>[]>(
    () => [
      { key: 'id', header: '№ Путёвки', render: (v) => <strong>#{v.id}</strong>, sortValue: (v) => v.id },
      {
        key: 'guest',
        header: 'Гость / Телефон',
        className: 'wrap',
        sortValue: (v) => clientName(v.clientId),
        render: (v) => {
          const c = clientObj(v.clientId);
          return (
            <>
              <div className="u-semibold">{clientName(v.clientId)}</div>
              <div className="u-muted-sm">{c?.phone || c?.email || 'Контакты не указаны'}</div>
            </>
          );
        },
      },
      {
        key: 'category',
        header: 'Категория / Номер',
        sortValue: (v) => categoryName(v.categoryId),
        render: (v) => (
          <>
            <div>{categoryName(v.categoryId)}</div>
            {v.roomNumber ? <span className="bk-room">Комната №{v.roomNumber}</span> : <span className="u-muted-sm">Без комнаты</span>}
          </>
        ),
      },
      {
        key: 'dates',
        header: 'Даты заезда',
        sortValue: (v) => v.checkIn,
        render: (v) => (
          <div className="bk-cell-stack">
            <span>{period(v.checkIn, v.checkOut)}</span>
            <span className="u-muted-sm">{calculateNights(v.checkIn, v.checkOut)} ноч. · мест: {v.places ?? 1}</span>
          </div>
        ),
      },
      {
        key: 'price',
        header: 'Стоимость / Оплата',
        align: 'right',
        sortValue: (v) => v.totalPrice ?? 0,
        render: (v) => (
          <>
            <div className="u-semibold">{money(v.totalPrice)}</div>
            <div className={`bk-paid ${isFullyPaid(v) ? 'is-ok' : 'is-due'}`}>Оплачено: {money(v.paid)}</div>
          </>
        ),
      },
      { key: 'status', header: 'Статус', render: (v) => <StatusBadge status={v.status} />, sortValue: (v) => v.status },
      {
        key: 'actions',
        header: 'Действия',
        hideHeader: true,
        className: 'actions',
        render: (v) => (
          <Button
            size="sm"
            variant="outline"
            icon={<Icon name="eye" size={16} />}
            aria-label={`Детали путёвки №${v.id}`}
            onClick={(e) => {
              e.stopPropagation();
              void openVoucherDetail(v);
            }}
          >
            Детали
          </Button>
        ),
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [clientName, clientObj, categoryName],
  );

  const anyModalOpen = isVoucherModalOpen || isClientModalOpen || isWaitlistModalOpen || selectedVoucher !== null;

  return (
    <section className="bk-page">
      <div className="page-head">
        <div>
          <h1>Управление бронированием</h1>
          <p className="page-subtitle">Оформление путёвок, регистрация гостей, заселение/выселение и работа с очередью</p>
        </div>
        <div className="page-actions">
          <Button variant="primary" icon={<Icon name="plus" size={18} />} onClick={() => { setError(null); setIsVoucherModalOpen(true); }}>
            Оформить путёвку
          </Button>
          <Button variant="secondary" icon={<Icon name="user" size={18} />} onClick={() => { setError(null); setIsClientModalOpen(true); }}>
            Новый клиент
          </Button>
          <Button variant="outline" icon={<Icon name="clock" size={18} />} onClick={() => { setError(null); setIsWaitlistModalOpen(true); }}>
            Лист ожидания ({queue.length})
          </Button>
        </div>
      </div>

      {!anyModalOpen && <ErrorBox error={error} />}

      <div className="kpi-grid">
        <StatCard label="Всего путёвок" value={stats.total} subvalue="Во всех статусах" icon={<Icon name="ticket" size={20} />} />
        <StatCard label="Ожидают оплаты" value={stats.awaiting} subvalue="Требуют внимания" color="c-amber" icon={<Icon name="creditCard" size={20} />} />
        <StatCard label="Подтверждены" value={stats.confirmed} subvalue="Готовы к заезду" color="c-blue" icon={<Icon name="checkCircle" size={20} />} />
        <StatCard label="Заселены в номера" value={stats.checkedIn} subvalue="Проживают сейчас" color="c-teal" icon={<Icon name="key" size={20} />} />
      </div>

      <Card>
        <Tabs
          label="Фильтр путёвок по статусу"
          value={statusFilter}
          onChange={setStatusFilter}
          tabs={STATUS_TABS.map((t) => ({ ...t, count: t.id ? counts[t.id] ?? 0 : vouchers.length }))}
        />
        <DataTable
          rows={visibleVouchers}
          columns={columns}
          rowKey={(v) => v.id}
          caption="Путёвки санатория"
          loading={loading}
          searchText={(v) => {
            const c = clientObj(v.clientId);
            return `${v.id} ${clientName(v.clientId)} ${c?.phone ?? ''} ${c?.email ?? ''} ${v.roomNumber ?? ''}`;
          }}
          searchPlaceholder="Поиск по номеру путёвки, гостю, телефону"
          initialSort={{ key: 'id', dir: 'desc' }}
          onRowClick={(v) => void openVoucherDetail(v)}
          rowClassName={(v) => (selectedVoucher?.id === v.id ? 'active-row' : undefined)}
          toolbar={
            <Button variant="ghost" size="sm" icon={<Icon name="refresh" size={16} />} loading={loading} onClick={() => void loadData()}>
              Обновить
            </Button>
          }
          emptyTitle="Путёвки не найдены"
          emptyDescription={statusFilter ? 'В данной категории пока нет оформленных путёвок.' : 'Пока не оформлено ни одной путёвки.'}
          emptyAction={
            <Button variant="primary" size="sm" icon={<Icon name="plus" size={16} />} onClick={() => setIsVoucherModalOpen(true)}>
              Оформить путёвку
            </Button>
          }
        />
      </Card>

      <VoucherDetailModal
        voucher={selectedVoucher}
        client={selectedVoucher ? clientObj(selectedVoucher.clientId) : undefined}
        categoryName={categoryName}
        conditions={clientConditions}
        busy={busy === 'checkIn' || busy === 'checkOut' || busy === 'pay' || busy === 'cancel' ? busy : null}
        error={error}
        onAction={(a) => void handleVoucherAction(a)}
        onClose={() => { setSelectedVoucher(null); setError(null); }}
      />

      <CreateVoucherModal
        isOpen={isVoucherModalOpen}
        onClose={() => setIsVoucherModalOpen(false)}
        form={voucherForm}
        onChange={(patch) => setVoucherForm((f) => ({ ...f, ...patch }))}
        onSubmit={handleCreateVoucher}
        onCreateClient={() => {
          setIsVoucherModalOpen(false);
          setIsClientModalOpen(true);
        }}
        clientList={clientList}
        categories={categories}
        profiles={profiles}
        diets={diets}
        channels={channels}
        customers={customers}
        busy={busy === 'createVoucher'}
        error={error}
      />

      <NewClientModal
        isOpen={isClientModalOpen}
        onClose={() => setIsClientModalOpen(false)}
        value={newClient}
        onChange={setNewClient}
        onSubmit={handleCreateClient}
        busy={busy === 'createClient'}
        error={error}
      />

      <WaitlistModal
        isOpen={isWaitlistModalOpen}
        onClose={() => setIsWaitlistModalOpen(false)}
        queue={queue}
        clientName={clientName}
        categoryName={categoryName}
        onRemove={(e) => void handleRemoveFromWaitlist(e)}
        busyId={busy?.startsWith('wl-') ? Number(busy.slice(3)) : null}
        error={error}
      />

      {confirmDialog}
    </section>
  );
}
