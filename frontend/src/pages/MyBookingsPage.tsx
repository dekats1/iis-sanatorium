import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { booking, refunds, reviews, waitlist } from '../api/endpoints';
import LeaveReviewModal from '../components/LeaveReviewModal';
import {
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorBox,
  formatDateTime,
  money,
  Notice,
  SkeletonRows,
  StatCard,
  StatusBadge,
  Tabs,
  today,
  useConfirm,
  useToast,
} from '../components/ui';
import { DataTable, type Column } from '../components/DataTable';
import { Icon } from '../components/icons';
import RefundModal from '../components/bookings/RefundModal';
import VoucherMemoModal from '../components/bookings/VoucherMemoModal';
import { calculateDaysLeft, period } from '../components/bookings/bookingUtils';
import type { RefundCalculation, VoucherView, WaitlistEntry } from '../types';

type TabId = 'upcoming' | 'archive' | 'waitlist';

const UPCOMING = ['AWAITING_PAYMENT', 'CONFIRMED', 'CHECKED_IN'];
const ARCHIVE = ['COMPLETED', 'CANCELLED', 'EXPIRED'];

export default function MyBookingsPage() {
  const toast = useToast();
  const [ask, confirmDialog] = useConfirm();
  const [vouchers, setVouchers] = useState<VoucherView[]>([]);
  const [entries, setEntries] = useState<WaitlistEntry[]>([]);
  const [activeTab, setActiveTab] = useState<TabId>('upcoming');
  const [error, setError] = useState<unknown>(null);
  const [loading, setLoading] = useState(true);
  const [payingId, setPayingId] = useState<number | null>(null);

  // Modals state
  const [selectedVoucherForMemo, setSelectedVoucherForMemo] = useState<VoucherView | null>(null);
  const [selectedVoucherForRefund, setSelectedVoucherForRefund] = useState<VoucherView | null>(null);
  const [refundCalc, setRefundCalc] = useState<RefundCalculation | null>(null);
  const [refundReason, setRefundReason] = useState('Изменение планов');
  const [refundComment, setRefundComment] = useState('');
  const [refundSubmitting, setRefundSubmitting] = useState(false);

  // Review & Quality Control
  const [reviewVoucher, setReviewVoucher] = useState<VoucherView | null>(null);
  const [reviewedVoucherIds, setReviewedVoucherIds] = useState<Set<number>>(new Set());

  // Return from bank simulator: ?pay=SUCCESS | DECLINED
  const [params] = useSearchParams();
  const payResult = params.get('pay');

  const load = useCallback(async () => {
    try {
      const [v, w, allReviews] = await Promise.all([booking.my(), waitlist.my(), reviews.list()]);
      setVouchers(v);
      setEntries(w);
      setReviewedVoucherIds(new Set(allReviews.map((r) => r.voucherId)));
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function pay(v: VoucherView) {
    setError(null);
    setPayingId(v.id);
    try {
      const p = await booking.pay(v.id);
      window.location.assign(p.payUrl);
    } catch (err) {
      setError(err);
      setPayingId(null);
    }
  }

  const openRefundModal = (v: VoucherView) => {
    const calc = refunds.calculate(v.checkIn ?? today(1), v.totalPrice ?? 0, v.paid ?? 0, v.id);
    setError(null);
    setSelectedVoucherForRefund(v);
    setRefundCalc(calc);
    setRefundReason('Изменение планов');
    setRefundComment('');
  };

  async function handleConfirmRefund() {
    if (!selectedVoucherForRefund || !refundCalc) return;
    setRefundSubmitting(true);
    setError(null);
    try {
      await booking.cancel(selectedVoucherForRefund.id);
      await refunds.processRefund({
        voucherId: selectedVoucherForRefund.id,
        reason: refundReason,
        comments: refundComment,
      });
      toast.success(
        `Путёвка #${selectedVoucherForRefund.id} отменена. К возврату на карту: ${money(refundCalc.refundAmount)} (удержано ${refundCalc.retainPercent}%: ${money(refundCalc.retainedAmount)}).`,
      );
      setSelectedVoucherForRefund(null);
      await load();
    } catch (err) {
      setError(err);
    } finally {
      setRefundSubmitting(false);
    }
  }

  async function cancelWaitlist(id: number) {
    if (!(await ask({ title: 'Лист ожидания', message: 'Исключить заявку из листа ожидания?', confirmLabel: 'Исключить', danger: true }))) return;
    try {
      await waitlist.remove(id);
      toast.success('Заявка исключена из листа ожидания.');
      await load();
    } catch (err) {
      setError(err);
    }
  }

  const upcomingVouchers = useMemo(() => vouchers.filter((v) => UPCOMING.includes(v.status)), [vouchers]);
  const archiveVouchers = useMemo(() => vouchers.filter((v) => ARCHIVE.includes(v.status)), [vouchers]);

  const priceCell = (v: VoucherView) => {
    const cur = v.currency ?? 'BYN';
    const fullyPaid = (v.paid ?? 0) >= (v.totalPrice ?? 0);
    return (
      <>
        <div className="u-semibold">{money(v.totalPrice, cur)}</div>
        <div className={`bk-paid ${fullyPaid ? 'is-ok' : 'is-due'}`}>Оплачено: {money(v.paid, cur)}</div>
      </>
    );
  };

  const upcomingColumns: Column<VoucherView>[] = [
    { key: 'id', header: '№ Путёвки', render: (v) => <strong>#{v.id}</strong>, sortValue: (v) => v.id },
    { key: 'status', header: 'Статус', render: (v) => <StatusBadge status={v.status} />, sortValue: (v) => v.status },
    {
      key: 'dates',
      header: 'Заезд и номер',
      sortValue: (v) => v.checkIn,
      render: (v) => {
        const daysLeft = calculateDaysLeft(v.checkIn);
        return (
          <div className="bk-cell-stack">
            <span className="u-semibold">{period(v.checkIn, v.checkOut)}</span>
            <span className="u-muted-sm">{v.roomNumber ? `Комната № ${v.roomNumber}` : 'Номер назначат при заезде'}</span>
            {v.status === 'CHECKED_IN' ? (
              <Badge variant="good" icon="key">Вы проживаете</Badge>
            ) : daysLeft !== null && daysLeft > 0 ? (
              <Badge variant={daysLeft <= 3 ? 'wait' : 'info'} icon="calendar">Через {daysLeft} дн.</Badge>
            ) : daysLeft === 0 ? (
              <Badge variant="good" icon="checkCircle">Заезд сегодня</Badge>
            ) : null}
          </div>
        );
      },
    },
    {
      key: 'price',
      header: 'Стоимость / Оплата',
      align: 'right',
      sortValue: (v) => v.totalPrice ?? 0,
      render: (v) => (
        <div className="bk-cell-stack bk-cell-right">
          {priceCell(v)}
          {v.status === 'AWAITING_PAYMENT' && <span className="bk-deadline">оплатить до {formatDateTime(v.paymentDeadline)}</span>}
        </div>
      ),
    },
    {
      key: 'actions',
      header: 'Действия',
      hideHeader: true,
      className: 'actions',
      render: (v) => (
        <div className="bk-row-actions">
          {v.status === 'AWAITING_PAYMENT' && (
            <Button variant="primary" size="sm" icon={<Icon name="creditCard" size={16} />} loading={payingId === v.id} onClick={() => void pay(v)}>
              Оплатить
            </Button>
          )}
          <Button variant="outline" size="sm" icon={<Icon name="file" size={16} />} onClick={() => setSelectedVoucherForMemo(v)}>
            Ваучер
          </Button>
          {['AWAITING_PAYMENT', 'CONFIRMED'].includes(v.status) && (
            <Button variant="danger" size="sm" onClick={() => openRefundModal(v)}>
              Отменить / Возврат
            </Button>
          )}
        </div>
      ),
    },
  ];

  const archiveColumns: Column<VoucherView>[] = [
    { key: 'id', header: '№ Путёвки', render: (v) => <strong>#{v.id}</strong>, sortValue: (v) => v.id },
    { key: 'status', header: 'Статус', render: (v) => <StatusBadge status={v.status} />, sortValue: (v) => v.status },
    { key: 'dates', header: 'Период отдыха', render: (v) => period(v.checkIn, v.checkOut), sortValue: (v) => v.checkIn },
    { key: 'room', header: 'Номер', render: (v) => (v.roomNumber ? `№ ${v.roomNumber}` : '—') },
    { key: 'total', header: 'Сумма путёвки', align: 'right', render: (v) => money(v.totalPrice, v.currency ?? 'BYN'), sortValue: (v) => v.totalPrice ?? 0 },
    { key: 'paid', header: 'Оплачено', align: 'right', render: (v) => money(v.paid, v.currency ?? 'BYN'), sortValue: (v) => v.paid ?? 0 },
    {
      key: 'actions',
      header: 'Ваучер',
      hideHeader: true,
      className: 'actions',
      render: (v) => (
        <div className="bk-row-actions">
          {v.status === 'COMPLETED' &&
            (reviewedVoucherIds.has(v.id) ? (
              <Badge variant="good" icon="check">Отзыв оставлен</Badge>
            ) : (
              <Button variant="outline" size="sm" icon={<Icon name="star" size={16} />} onClick={() => setReviewVoucher(v)}>
                Оценить отдых (+50 б.)
              </Button>
            ))}
          <Button variant="secondary" size="sm" icon={<Icon name="file" size={16} />} onClick={() => setSelectedVoucherForMemo(v)}>
            Квитанция
          </Button>
        </div>
      ),
    },
  ];

  const waitlistColumns: Column<WaitlistEntry>[] = [
    { key: 'id', header: 'ID заявки', render: (w) => `#${w.id}`, sortValue: (w) => w.id },
    { key: 'category', header: 'Категория номера', render: (w) => <strong>Категория #{w.categoryId}</strong>, sortValue: (w) => w.categoryId },
    { key: 'period', header: 'Желаемый период', render: (w) => period(w.dateFrom, w.dateTo), sortValue: (w) => w.dateFrom },
    { key: 'places', header: 'Мест', align: 'right', render: (w) => w.places },
    { key: 'status', header: 'Статус', render: (w) => <StatusBadge status={w.status} /> },
    { key: 'created', header: 'Дата подачи', render: (w) => formatDateTime(w.createdAt), sortValue: (w) => w.createdAt },
    {
      key: 'actions',
      header: 'Действия',
      hideHeader: true,
      className: 'actions',
      render: (w) => (
        <Button variant="danger" size="sm" icon={<Icon name="trash" size={16} />} onClick={() => void cancelWaitlist(w.id)}>
          Отозвать заявку
        </Button>
      ),
    },
  ];

  const searchLink = (label: string) => (
    <Link to="/search" className="btn primary">
      <Icon name="search" size={18} /> {label}
    </Link>
  );

  const modalOpen = selectedVoucherForRefund !== null;

  return (
    <section className="bk-page">
      <div className="page-head">
        <div>
          <h1>Личный кабинет гостя • Мои путёвки</h1>
          <p className="page-subtitle">Управление активными бронированиями, электронные ваучеры, платежи и оформление возвратов</p>
        </div>
        <div className="page-actions">
          <Link to="/search" className="btn primary">
            <Icon name="plus" size={18} /> Забронировать номер
          </Link>
        </div>
      </div>

      {payResult === 'SUCCESS' && (
        <Notice tone="success">Оплата успешно зачислена! Ваша путёвка подтверждена, номер закреплён.</Notice>
      )}
      {payResult === 'DECLINED' && (
        <Notice tone="warning">Платёж был отклонён. Пока не истёк срок оплаты, вы можете повторить платёж позже.</Notice>
      )}

      {!modalOpen && <ErrorBox error={error} />}

      <div className="kpi-grid">
        <StatCard label="Предстоящих поездок" value={loading ? '—' : upcomingVouchers.length} subvalue="Активные брони" color="c-teal" icon={<Icon name="ticket" size={20} />} />
        <StatCard
          label="Завершённых заездов"
          value={loading ? '—' : archiveVouchers.filter((v) => v.status === 'COMPLETED').length}
          subvalue="История оздоровления"
          color="c-blue"
          icon={<Icon name="leaf" size={20} />}
        />
        <StatCard label="Заявок в листе ожидания" value={loading ? '—' : entries.length} subvalue="Ожидают освобождения мест" color="c-amber" icon={<Icon name="clock" size={20} />} />
      </div>

      <Tabs<TabId>
        label="Разделы личного кабинета"
        value={activeTab}
        onChange={setActiveTab}
        tabs={[
          { id: 'upcoming', label: 'Предстоящие и активные', icon: 'calendar', count: upcomingVouchers.length },
          { id: 'archive', label: 'Архив поездок', icon: 'inbox', count: archiveVouchers.length },
          { id: 'waitlist', label: 'Лист ожидания', icon: 'clock', count: entries.length },
        ]}
      />

      {loading ? (
        <Card>
          <SkeletonRows rows={4} />
        </Card>
      ) : (
        <>
          {activeTab === 'upcoming' && (
            <Card>
              {upcomingVouchers.length === 0 ? (
                <EmptyState
                  title="У вас пока нет активных бронирований"
                  description="Выберите подходящую категорию номера и даты заезда на странице поиска."
                  action={searchLink('Подобрать путёвку')}
                />
              ) : (
                <DataTable
                  rows={upcomingVouchers}
                  columns={upcomingColumns}
                  rowKey={(v) => v.id}
                  caption="Путёвки клиента: предстоящие и текущие заезды"
                  initialSort={{ key: 'dates', dir: 'asc' }}
                />
              )}
            </Card>
          )}

          {activeTab === 'archive' && (
            <Card>
              <DataTable
                rows={archiveVouchers}
                columns={archiveColumns}
                rowKey={(v) => v.id}
                caption="Архив поездок и завершённые путёвки"
                searchText={archiveVouchers.length > 10 ? (v) => `${v.id} ${v.roomNumber ?? ''} ${v.checkIn ?? ''}` : undefined}
                searchPlaceholder="Поиск по номеру путёвки или дате"
                initialSort={{ key: 'dates', dir: 'desc' }}
                emptyTitle="В архиве пока нет завершённых поездок"
                emptyDescription="Здесь появятся завершённые и отменённые путёвки."
              />
            </Card>
          )}

          {activeTab === 'waitlist' && (
            <Card title="Заявки в листе ожидания" subtitle="Отслеживание свободных мест в санатории">
              <DataTable
                rows={entries}
                columns={waitlistColumns}
                rowKey={(w) => w.id}
                label="Заявки в листе ожидания"
                emptyTitle="Лист ожидания пуст"
                emptyDescription="Если нужный номер занят, вы можете подать заявку в лист ожидания со страницы поиска."
                emptyAction={searchLink('Перейти к поиску')}
              />
            </Card>
          )}
        </>
      )}

      <RefundModal
        voucher={selectedVoucherForRefund}
        calc={refundCalc}
        reason={refundReason}
        comment={refundComment}
        onReasonChange={setRefundReason}
        onCommentChange={setRefundComment}
        submitting={refundSubmitting}
        error={error}
        onConfirm={() => void handleConfirmRefund()}
        onClose={() => setSelectedVoucherForRefund(null)}
      />

      <VoucherMemoModal voucher={selectedVoucherForMemo} onClose={() => setSelectedVoucherForMemo(null)} />

      {reviewVoucher && (
        <LeaveReviewModal
          isOpen={Boolean(reviewVoucher)}
          onClose={() => setReviewVoucher(null)}
          voucher={reviewVoucher}
          onSuccess={() => {
            toast.success('Спасибо за ваш отзыв! На ваш бонусный счёт начислено +50 баллов.');
            void load();
          }}
        />
      )}

      {confirmDialog}
    </section>
  );
}
