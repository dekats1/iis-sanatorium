import { useCallback, useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { booking, refunds, reviews, waitlist } from '../api/endpoints';
import LeaveReviewModal from '../components/LeaveReviewModal';
import {
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorBox,
  Field,
  formatDateTime,
  Modal,
  money,
  StatCard,
  StatusBadge,
  TableWrap,
  today,
} from '../components/ui';
import type { RefundCalculation, VoucherView, WaitlistEntry } from '../types';

export default function MyBookingsPage() {
  const [vouchers, setVouchers] = useState<VoucherView[]>([]);
  const [entries, setEntries] = useState<WaitlistEntry[]>([]);
  const [activeTab, setActiveTab] = useState<'upcoming' | 'archive' | 'waitlist'>('upcoming');
  const [error, setError] = useState<unknown>(null);
  const [message, setMessage] = useState('');

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
      const [v, w, allReviews] = await Promise.all([
        booking.my(),
        waitlist.my(),
        reviews.list(),
      ]);
      setVouchers(v);
      setEntries(w);
      setReviewedVoucherIds(new Set(allReviews.map((r) => r.voucherId)));
    } catch (err) {
      setError(err);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function pay(v: VoucherView) {
    setError(null);
    try {
      const p = await booking.pay(v.id);
      window.location.assign(p.payUrl);
    } catch (err) {
      setError(err);
    }
  }

  const openRefundModal = (v: VoucherView) => {
    const calc = refunds.calculate(
      v.checkIn ?? today(1),
      v.totalPrice ?? 0,
      v.paid ?? 0,
      v.id
    );
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
      // Call booking.cancel endpoint
      await booking.cancel(selectedVoucherForRefund.id);
      // Process notification & audit
      await refunds.processRefund({
        voucherId: selectedVoucherForRefund.id,
        reason: refundReason,
        comments: refundComment,
      });

      setMessage(
        `Путёвка #${selectedVoucherForRefund.id} отменена. К возврату на карту: ${money(
          refundCalc.refundAmount
        )} (удержано ${refundCalc.retainPercent}%: ${money(refundCalc.retainedAmount)}).`
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
    if (!window.confirm('Исключить заявку из листа ожидания?')) return;
    try {
      await waitlist.remove(id);
      setMessage('Заявка исключена из листа ожидания.');
      await load();
    } catch (err) {
      setError(err);
    }
  }

  const calculateDaysLeft = (checkInStr: string | null) => {
    if (!checkInStr) return null;
    const diff = new Date(checkInStr).getTime() - new Date().getTime();
    return Math.ceil(diff / (1000 * 3600 * 24));
  };

  const upcomingVouchers = vouchers.filter((v) =>
    ['AWAITING_PAYMENT', 'CONFIRMED', 'CHECKED_IN'].includes(v.status)
  );

  const archiveVouchers = vouchers.filter((v) =>
    ['COMPLETED', 'CANCELLED', 'EXPIRED'].includes(v.status)
  );

  return (
    <section>
      {/* Page Header */}
      <div className="page-head">
        <div>
          <h1>Личный кабинет гостя • Мои путёвки</h1>
          <p className="card-subtitle">
            Управление активными бронированиями, электронные ваучеры, платежи и оформление возвратов
          </p>
        </div>
        <Link to="/search">
          <Button variant="primary">+ Забронировать номер</Button>
        </Link>
      </div>

      {payResult === 'SUCCESS' && (
        <div className="ok" role="alert">
          ✓ Оплата успешно зачислена! Ваша путёвка подтверждена, номер закреплён.
        </div>
      )}
      {payResult === 'DECLINED' && (
        <div className="warning" role="alert">
          Платёж был отклонён. Пока не истёк срок оплаты, вы можете повторить платёж позже.
        </div>
      )}

      <ErrorBox error={error} />
      {message && <p className="ok">{message}</p>}

      {/* KPI Stats Grid */}
      <div className="kpi-grid">
        <StatCard
          label="Предстоящих поездок"
          value={upcomingVouchers.length}
          subvalue="Активные брони"
          color="c-teal"
        />
        <StatCard
          label="Завершённых заездов"
          value={archiveVouchers.filter((v) => v.status === 'COMPLETED').length}
          subvalue="История оздоровления"
          color="c-blue"
        />
        <StatCard
          label="Заявок в листе ожидания"
          value={entries.length}
          subvalue="Ожидают освобождения мест"
          color="c-amber"
        />
      </div>

      {/* Tabs */}
      <div className="tabs">
        <button
          type="button"
          className={`tab ${activeTab === 'upcoming' ? 'active' : ''}`}
          onClick={() => setActiveTab('upcoming')}
        >
          Предстоящие и активные ({upcomingVouchers.length})
        </button>
        <button
          type="button"
          className={`tab ${activeTab === 'archive' ? 'active' : ''}`}
          onClick={() => setActiveTab('archive')}
        >
          Архив поездок ({archiveVouchers.length})
        </button>
        <button
          type="button"
          className={`tab ${activeTab === 'waitlist' ? 'active' : ''}`}
          onClick={() => setActiveTab('waitlist')}
        >
          Лист ожидания ({entries.length})
        </button>
      </div>

      {/* TAB 1: Upcoming and Active Vouchers */}
      {activeTab === 'upcoming' && (
        <Card title="Предстоящие и текущие заезды">
          {upcomingVouchers.length === 0 ? (
            <EmptyState
              title="У вас пока нет активных бронирований"
              description="Выберите подходящую категорию номера и даты заезда на странице поиска."
              action={
                <Link to="/search">
                  <Button variant="primary">Подобрать путёвку</Button>
                </Link>
              }
            />
          ) : (
            <TableWrap>
              <table>
                <thead>
                  <tr>
                    <th>№ Путёвки</th>
                    <th>Статус</th>
                    <th>Номер комнаты</th>
                    <th>Даты заезда</th>
                    <th>Осталось дней</th>
                    <th>Стоимость / Оплачено</th>
                    <th>Срок оплаты</th>
                    <th style={{ textAlign: 'right' }}>Действия</th>
                  </tr>
                </thead>
                <tbody>
                  {upcomingVouchers.map((v) => {
                    const daysLeft = calculateDaysLeft(v.checkIn);
                    const isFullyPaid = (v.paid ?? 0) >= (v.totalPrice ?? 0);
                    return (
                      <tr key={v.id}>
                        <td>
                          <strong>#{v.id}</strong>
                        </td>
                        <td>
                          <StatusBadge status={v.status} />
                        </td>
                        <td>
                          {v.roomNumber ? (
                            <strong style={{ color: 'var(--accent)' }}>№ {v.roomNumber}</strong>
                          ) : (
                            <span style={{ color: 'var(--text-subtle)' }}>Назначат при заезде</span>
                          )}
                        </td>
                        <td>
                          <div style={{ fontWeight: 600 }}>
                            {v.checkIn} — {v.checkOut}
                          </div>
                        </td>
                        <td>
                          {v.status === 'CHECKED_IN' ? (
                            <Badge variant="good">🏨 Вы проживаете</Badge>
                          ) : daysLeft !== null ? (
                            daysLeft > 0 ? (
                              <Badge variant={daysLeft <= 3 ? 'wait' : 'info'}>
                                Через {daysLeft} дн.
                              </Badge>
                            ) : (
                              <Badge variant="good">Заезд сегодня</Badge>
                            )
                          ) : (
                            '—'
                          )}
                        </td>
                        <td>
                          <div style={{ fontWeight: 700 }}>{money(v.totalPrice, v.currency ?? 'BYN')}</div>
                          <div
                            style={{
                              fontSize: '0.8rem',
                              color: isFullyPaid ? 'var(--ok)' : 'var(--amber)',
                              fontWeight: 600,
                            }}
                          >
                            Оплачено: {money(v.paid, v.currency ?? 'BYN')}
                          </div>
                        </td>
                        <td>
                          {v.status === 'AWAITING_PAYMENT' ? (
                            <span style={{ color: 'var(--amber)', fontWeight: 600, fontSize: '0.85rem' }}>
                              до {formatDateTime(v.paymentDeadline)}
                            </span>
                          ) : (
                            <span style={{ color: 'var(--ok)', fontSize: '0.85rem' }}>Подтверждено</span>
                          )}
                        </td>
                        <td style={{ textAlign: 'right' }} className="actions">
                          <div style={{ display: 'inline-flex', gap: 6 }}>
                            {v.status === 'AWAITING_PAYMENT' && (
                              <Button variant="primary" size="sm" onClick={() => void pay(v)}>
                                Оплатить
                              </Button>
                            )}

                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setSelectedVoucherForMemo(v)}
                            >
                              📄 Ваучер
                            </Button>

                            {['AWAITING_PAYMENT', 'CONFIRMED'].includes(v.status) && (
                              <Button
                                variant="danger"
                                size="sm"
                                onClick={() => openRefundModal(v)}
                              >
                                Отменить / Возврат
                              </Button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </TableWrap>
          )}
        </Card>
      )}

      {/* TAB 2: Archive & History */}
      {activeTab === 'archive' && (
        <Card title="Архив поездок и завершённые путёвки">
          {archiveVouchers.length === 0 ? (
            <EmptyState title="В архиве пока нет завершённых поездок" />
          ) : (
            <TableWrap>
              <table>
                <thead>
                  <tr>
                    <th>№ Путёвки</th>
                    <th>Статус</th>
                    <th>Период отдыха</th>
                    <th>Номер</th>
                    <th>Сумма путёвки</th>
                    <th>Оплачено</th>
                    <th style={{ textAlign: 'right' }}>Ваучер</th>
                  </tr>
                </thead>
                <tbody>
                  {archiveVouchers.map((v) => (
                    <tr key={v.id}>
                      <td>
                        <strong>#{v.id}</strong>
                      </td>
                      <td>
                        <StatusBadge status={v.status} />
                      </td>
                      <td>
                        {v.checkIn} — {v.checkOut}
                      </td>
                      <td>{v.roomNumber ? `№ ${v.roomNumber}` : '—'}</td>
                      <td>{money(v.totalPrice, v.currency ?? 'BYN')}</td>
                      <td>{money(v.paid, v.currency ?? 'BYN')}</td>
                      <td style={{ textAlign: 'right' }} className="actions">
                        <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end', alignItems: 'center' }}>
                          {v.status === 'COMPLETED' && (
                            reviewedVoucherIds.has(v.id) ? (
                              <Badge variant="good">✓ Отзыв оставлен</Badge>
                            ) : (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setReviewVoucher(v)}
                                style={{ borderColor: 'var(--accent)', color: 'var(--accent)' }}
                              >
                                ★ Оценить отдых (+50 б.)
                              </Button>
                            )
                          )}
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => setSelectedVoucherForMemo(v)}
                          >
                            Квитанция
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </TableWrap>
          )}
        </Card>
      )}

      {/* TAB 3: Waitlist */}
      {activeTab === 'waitlist' && (
        <Card title="Заявки в листе ожидания" subtitle="Отслеживание свободных мест в санатории">
          {entries.length === 0 ? (
            <EmptyState
              title="Лист ожидания пуст"
              description="Если нужный номер занят, вы можете подать заявку в лист ожидания со страницы поиска."
            />
          ) : (
            <TableWrap>
              <table>
                <thead>
                  <tr>
                    <th>ID заявки</th>
                    <th>Категория номера</th>
                    <th>Желаемый период</th>
                    <th>Мест</th>
                    <th>Статус</th>
                    <th>Дата подачи</th>
                    <th style={{ textAlign: 'right' }}>Действия</th>
                  </tr>
                </thead>
                <tbody>
                  {entries.map((w) => (
                    <tr key={w.id}>
                      <td>#{w.id}</td>
                      <td>
                        <strong>Категория #{w.categoryId}</strong>
                      </td>
                      <td>
                        {w.dateFrom} — {w.dateTo}
                      </td>
                      <td>{w.places}</td>
                      <td>
                        <StatusBadge status={w.status} />
                      </td>
                      <td>{formatDateTime(w.createdAt)}</td>
                      <td style={{ textAlign: 'right' }} className="actions">
                        <Button
                          variant="danger"
                          size="sm"
                          onClick={() => void cancelWaitlist(w.id)}
                        >
                          Отозвать заявку
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </TableWrap>
          )}
        </Card>
      )}

      {/* Modal: Interactive Refund & Cancellation (Идея 11 & ФТ-09) */}
      <Modal
        isOpen={selectedVoucherForRefund !== null}
        onClose={() => setSelectedVoucherForRefund(null)}
        title={
          selectedVoucherForRefund
            ? `Оформление возврата по путёвке #${selectedVoucherForRefund.id}`
            : ''
        }
        size="md"
      >
        {selectedVoucherForRefund && refundCalc && (
          <div>
            <div
              style={{
                background: 'var(--amber-soft)',
                padding: '12px 16px',
                borderRadius: 'var(--radius-md)',
                marginBottom: 16,
                fontSize: '0.88rem',
                color: '#7A4B06',
                lineHeight: 1.5,
              }}
            >
              ℹ️ <strong>Правила отмены и возврата (ФТ-09):</strong>
              <div style={{ marginTop: 4 }}>{refundCalc.policyDescription}</div>
            </div>

            {/* Refund calculation breakdown */}
            <div className="refund-summary-box">
              <div className="refund-summary-row">
                <span>Общая стоимость путёвки:</span>
                <strong>{money(refundCalc.totalPrice)}</strong>
              </div>
              <div className="refund-summary-row">
                <span>Фактически оплачено гостем:</span>
                <strong>{money(refundCalc.paidAmount)}</strong>
              </div>
              <div className="refund-summary-row">
                <span>До заезда осталось:</span>
                <span>
                  <strong>{refundCalc.daysBeforeCheckIn} суток</strong>
                </span>
              </div>
              <div className="refund-summary-row" style={{ color: 'var(--danger)' }}>
                <span>Удержание по правилам отмены ({refundCalc.retainPercent}%):</span>
                <span>-{money(refundCalc.retainedAmount)}</span>
              </div>
              <div className="refund-summary-row" style={{ color: 'var(--ok)' }}>
                <span>Сумма к возврату на карту:</span>
                <span style={{ fontSize: '1.25rem' }}>{money(refundCalc.refundAmount)}</span>
              </div>
            </div>

            {/* Reason selector */}
            <Field label="Причина отмены бронирования" required>
              <select
                value={refundReason}
                onChange={(e) => setRefundReason(e.target.value)}
              >
                <option value="Изменение планов">Изменение личных планов</option>
                <option value="Состояние здоровья">Состояние здоровья / болезнь</option>
                <option value="Семейные обстоятельства">Семейные обстоятельства</option>
                <option value="Перенос поездки на другой сезон">Перенос поездки на другой сезон</option>
                <option value="Другая причина">Другая причина</option>
              </select>
            </Field>

            <Field label="Комментарий к заявлению (необязательно)">
              <textarea
                rows={2}
                placeholder="Укажите дополнительные детали, если необходимо..."
                value={refundComment}
                onChange={(e) => setRefundComment(e.target.value)}
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
              <Button
                variant="secondary"
                onClick={() => setSelectedVoucherForRefund(null)}
                disabled={refundSubmitting}
              >
                Отмена
              </Button>
              <Button
                variant="danger"
                onClick={() => void handleConfirmRefund()}
                disabled={refundSubmitting}
              >
                {refundSubmitting ? 'Обработка возврата…' : 'Подтвердить возврат средств'}
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Modal: Guest Voucher & Memo (Электронный ваучер и памятка гостя) */}
      <Modal
        isOpen={selectedVoucherForMemo !== null}
        onClose={() => setSelectedVoucherForMemo(null)}
        title={
          selectedVoucherForMemo
            ? `Электронный ваучер путёвки #${selectedVoucherForMemo.id}`
            : ''
        }
        size="md"
      >
        {selectedVoucherForMemo && (
          <div>
            <div className="voucher-print-memo" id="voucher-print-area">
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'flex-start',
                  borderBottom: '2px solid var(--line)',
                  paddingBottom: 14,
                  marginBottom: 16,
                }}
              >
                <div>
                  <h3 style={{ margin: 0, color: 'var(--accent)', fontSize: '1.25rem' }}>
                    САНАТОРИЙ «ИИС»
                  </h3>
                  <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                    Республика Беларусь, Минская обл., сосновый бор
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <Badge variant="good">ВАУЧЕР ОПЛАЧЕН</Badge>
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: 4 }}>
                    Путёвка #{selectedVoucherForMemo.id}
                  </div>
                </div>
              </div>

              <dl style={{ margin: 0, fontSize: '0.9rem' }}>
                <dt>Период заезда:</dt>
                <dd>
                  <strong>
                    {selectedVoucherForMemo.checkIn} — {selectedVoucherForMemo.checkOut}
                  </strong>
                </dd>
                <dt>Расчётный час:</dt>
                <dd>Заезд с 14:00, выезд до 12:00</dd>
                <dt>Размещение:</dt>
                <dd>
                  {selectedVoucherForMemo.roomNumber
                    ? `Комната № ${selectedVoucherForMemo.roomNumber}`
                    : 'Категория подтверждена (комната на стойке регистрации)'}
                </dd>
                <dt>Количество гостей:</dt>
                <dd>{selectedVoucherForMemo.places ?? 1} чел.</dd>
                <dt>Сумма путёвки:</dt>
                <dd style={{ color: 'var(--accent)', fontWeight: 700 }}>
                  {money(selectedVoucherForMemo.totalPrice)}
                </dd>
              </dl>

              <div
                style={{
                  background: 'var(--bg)',
                  padding: 12,
                  borderRadius: 'var(--radius-md)',
                  marginTop: 16,
                  fontSize: '0.82rem',
                  lineHeight: 1.5,
                }}
              >
                <strong>Памятка для заселения:</strong>
                <ul style={{ margin: '4px 0 0', paddingLeft: 18 }}>
                  <li>Паспорт или документ, удостоверяющий личность;</li>
                  <li>Санаторно-курортная карта (СКК) давностью не более 1 месяца;</li>
                  <li>Круглосуточная стойка регистрации: +375 (17) 200-11-22.</li>
                </ul>
              </div>
            </div>

            <div
              style={{
                display: 'flex',
                justifyContent: 'flex-end',
                gap: 10,
                marginTop: 20,
              }}
            >
              <Button variant="secondary" onClick={() => setSelectedVoucherForMemo(null)}>
                Закрыть
              </Button>
              <Button
                variant="primary"
                onClick={() => {
                  window.print();
                }}
              >
                🖨️ Распечатать ваучер
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Leave Review Modal */}
      {reviewVoucher && (
        <LeaveReviewModal
          isOpen={Boolean(reviewVoucher)}
          onClose={() => setReviewVoucher(null)}
          voucher={reviewVoucher}
          onSuccess={() => {
            setMessage('Спасибо за ваш отзыв! На ваш бонусный счёт начислено +50 баллов.');
            void load();
          }}
        />
      )}
    </section>
  );
}
