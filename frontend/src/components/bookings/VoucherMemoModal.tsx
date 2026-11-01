import { Badge, Button, Modal, money } from '../ui';
import { Icon } from '../icons';
import type { VoucherView } from '../../types';
import { period } from './bookingUtils';

/** Электронный ваучер и памятка гостя (с печатью). */
export default function VoucherMemoModal({ voucher, onClose }: { voucher: VoucherView | null; onClose: () => void }) {
  return (
    <Modal
      isOpen={voucher !== null}
      onClose={onClose}
      title={voucher ? `Электронный ваучер путёвки #${voucher.id}` : ''}
      size="md"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Закрыть
          </Button>
          <Button variant="primary" icon={<Icon name="printer" size={18} />} onClick={() => window.print()}>
            Распечатать ваучер
          </Button>
        </>
      }
    >
      {voucher && (
        <div className="bk-memo" id="voucher-print-area">
          <div className="bk-memo-head">
            <div>
              <h3 className="bk-memo-title">САНАТОРИЙ «ИИС»</h3>
              <div className="u-muted-sm bk-inline-icon">
                <Icon name="mapPin" size={16} /> Республика Беларусь, Минская обл., сосновый бор
              </div>
            </div>
            <div className="bk-memo-stamp">
              <Badge variant="good" icon="checkCircle">ВАУЧЕР ОПЛАЧЕН</Badge>
              <div className="u-muted-sm">Путёвка #{voucher.id}</div>
            </div>
          </div>

          <dl className="u-m0 u-text-sm">
            <dt>Период заезда</dt>
            <dd><strong>{period(voucher.checkIn, voucher.checkOut)}</strong></dd>
            <dt>Расчётный час</dt>
            <dd>Заезд с 14:00, выезд до 12:00</dd>
            <dt>Размещение</dt>
            <dd>{voucher.roomNumber ? `Комната № ${voucher.roomNumber}` : 'Категория подтверждена (комната на стойке регистрации)'}</dd>
            <dt>Количество гостей</dt>
            <dd>{voucher.places ?? 1} чел.</dd>
            <dt>Сумма путёвки</dt>
            <dd className="u-accent u-semibold">{money(voucher.totalPrice)}</dd>
          </dl>

          <div className="bk-memo-note">
            <strong>Памятка для заселения:</strong>
            <ul>
              <li>Паспорт или документ, удостоверяющий личность;</li>
              <li>Санаторно-курортная карта (СКК) давностью не более 1 месяца;</li>
              <li>Круглосуточная стойка регистрации: +375 (17) 200-11-22.</li>
            </ul>
          </div>
        </div>
      )}
    </Modal>
  );
}
