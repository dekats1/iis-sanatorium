import { Badge, Button, ErrorBox, formatDateTime, Modal, money, StatusBadge } from '../ui';
import { Icon } from '../icons';
import type { ClientView, ConditionView, VoucherView } from '../../types';
import { amountDue, calculateNights, fullName } from './bookingUtils';

export type VoucherAction = 'checkIn' | 'checkOut' | 'pay' | 'cancel';

/** Карточка путёвки для администратора бронирования: сведения и действия. */
export default function VoucherDetailModal({
  voucher,
  client,
  categoryName,
  conditions,
  busy,
  error,
  onAction,
  onClose,
}: {
  voucher: VoucherView | null;
  client: ClientView | undefined;
  categoryName: (id: number | null | undefined) => string;
  conditions: ConditionView[];
  busy: VoucherAction | null;
  error: unknown;
  onAction: (action: VoucherAction) => void;
  onClose: () => void;
}) {
  const v = voucher;
  const isClosed = v ? v.status === 'COMPLETED' || v.status === 'CANCELLED' : true;
  const canPay =
    v !== null &&
    ((v.paid ?? 0) < (v.totalPrice ?? 0) || v.status === 'AWAITING_PAYMENT') &&
    !isClosed;

  const footer = v ? (
    <div className="bk-actions">
      {v.status === 'CONFIRMED' && (
        <Button variant="primary" icon={<Icon name="key" size={16} />} loading={busy === 'checkIn'} disabled={busy !== null} onClick={() => onAction('checkIn')}>
          Заселить гостя
        </Button>
      )}
      {v.status === 'CHECKED_IN' && (
        <Button variant="primary" icon={<Icon name="logout" size={16} />} loading={busy === 'checkOut'} disabled={busy !== null} onClick={() => onAction('checkOut')}>
          Выселить гостя
        </Button>
      )}
      {canPay && (
        <Button variant="outline" icon={<Icon name="creditCard" size={16} />} loading={busy === 'pay'} disabled={busy !== null} onClick={() => onAction('pay')}>
          Провести оплату
        </Button>
      )}
      {!isClosed && (
        <Button variant="danger" icon={<Icon name="xCircle" size={16} />} loading={busy === 'cancel'} disabled={busy !== null} onClick={() => onAction('cancel')}>
          Аннулировать бронь
        </Button>
      )}
      <Button variant="secondary" onClick={onClose}>
        Закрыть
      </Button>
    </div>
  ) : undefined;

  return (
    <Modal isOpen={v !== null} onClose={onClose} title={v ? `Путёвка #${v.id}` : ''} size="lg" footer={footer}>
      {v && (
        <div className="u-stack-16">
          <ErrorBox error={error} />
          <div className="bk-detail-top">
            <StatusBadge status={v.status} />
            <span className="u-muted-sm bk-inline-icon">
              <Icon name="clock" size={16} /> Срок оплаты: {formatDateTime(v.paymentDeadline)}
            </span>
          </div>

          <div className="detail-grid">
            <section className="detail-card-panel" aria-label="Гость">
              <h4 className="bk-panel-title"><Icon name="user" size={18} /> Гость</h4>
              <div className="bk-guest-name">{fullName(client, v.clientId)}</div>
              <ul className="meta-list">
                {client?.phone && <li><Icon name="phone" size={16} /> {client.phone}</li>}
                {client?.email && <li><Icon name="mail" size={16} /> {client.email}</li>}
                {client?.birthDate && <li><Icon name="calendar" size={16} /> Дата рождения: {client.birthDate}</li>}
                {!client?.phone && !client?.email && <li>Контакты не указаны</li>}
              </ul>
              {conditions.length > 0 && (
                <div>
                  <div className="u-muted-sm u-mb-4">Медицинские состояния:</div>
                  <div className="u-flex-wrap u-gap-6">
                    {conditions.map((cond) => (
                      <Badge key={cond.conditionId} variant="info" icon="stethoscope">{cond.name}</Badge>
                    ))}
                  </div>
                </div>
              )}
            </section>

            <section className="detail-card-panel" aria-label="Размещение">
              <h4 className="bk-panel-title"><Icon name="bed" size={18} /> Размещение</h4>
              <dl className="u-m0 u-text-sm">
                <dt>Категория</dt>
                <dd>{categoryName(v.categoryId)}</dd>
                <dt>Номер</dt>
                <dd>{v.roomNumber ? `Комната №${v.roomNumber}` : 'Не назначен'}</dd>
                <dt>Заезд</dt>
                <dd>{v.checkIn ?? '—'}</dd>
                <dt>Выезд</dt>
                <dd>{v.checkOut ?? '—'}</dd>
                <dt>Длительность</dt>
                <dd>{calculateNights(v.checkIn, v.checkOut)} ночей</dd>
                <dt>Мест в заявке</dt>
                <dd>{v.places ?? 1}</dd>
              </dl>
            </section>

            <section className="detail-card-panel" aria-label="Финансы">
              <h4 className="bk-panel-title"><Icon name="wallet" size={18} /> Финансы</h4>
              <dl className="u-m0 u-text-sm">
                <dt>Общая сумма</dt>
                <dd className="bk-total">{money(v.totalPrice)}</dd>
                <dt>Оплачено</dt>
                <dd className="u-ok u-semibold">{money(v.paid)}</dd>
                <dt>Остаток долга</dt>
                <dd className={amountDue(v) > 0 ? 'u-danger u-semibold' : 'u-semibold'}>{money(amountDue(v))}</dd>
                <dt>Цена в сутки/место</dt>
                <dd>{money(v.pricePerPlaceDay)}</dd>
              </dl>
            </section>
          </div>
        </div>
      )}
    </Modal>
  );
}
