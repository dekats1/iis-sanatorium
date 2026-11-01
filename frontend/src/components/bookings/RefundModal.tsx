import { Button, ErrorBox, Field, Modal, money, Notice } from '../ui';
import { Icon } from '../icons';
import type { RefundCalculation, VoucherView } from '../../types';

/** Отмена путёвки клиентом с расчётом возврата (ФТ-09). */
export default function RefundModal({
  voucher,
  calc,
  reason,
  comment,
  onReasonChange,
  onCommentChange,
  submitting,
  error,
  onConfirm,
  onClose,
}: {
  voucher: VoucherView | null;
  calc: RefundCalculation | null;
  reason: string;
  comment: string;
  onReasonChange: (v: string) => void;
  onCommentChange: (v: string) => void;
  submitting: boolean;
  error: unknown;
  onConfirm: () => void;
  onClose: () => void;
}) {
  return (
    <Modal
      isOpen={voucher !== null}
      onClose={onClose}
      title={voucher ? `Оформление возврата по путёвке #${voucher.id}` : ''}
      size="md"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={submitting}>
            Отмена
          </Button>
          <Button variant="danger" icon={<Icon name="xCircle" size={18} />} onClick={onConfirm} loading={submitting}>
            {submitting ? 'Обработка возврата…' : 'Подтвердить возврат средств'}
          </Button>
        </>
      }
    >
      {voucher && calc && (
        <div className="u-stack-16">
          <Notice tone="warning">
            <strong>Правила отмены и возврата (ФТ-09):</strong>
            <div className="u-mt-4">{calc.policyDescription}</div>
          </Notice>

          <dl className="bk-summary">
            <dt>Общая стоимость путёвки</dt>
            <dd>{money(calc.totalPrice)}</dd>
            <dt>Фактически оплачено гостем</dt>
            <dd>{money(calc.paidAmount)}</dd>
            <dt>До заезда осталось</dt>
            <dd>{calc.daysBeforeCheckIn} суток</dd>
            <dt className="u-danger">Удержание по правилам отмены ({calc.retainPercent}%)</dt>
            <dd className="u-danger">-{money(calc.retainedAmount)}</dd>
            <dt className="bk-summary-total">Сумма к возврату на карту</dt>
            <dd className="bk-summary-total bk-summary-refund">{money(calc.refundAmount)}</dd>
          </dl>

          <div>
            <Field label="Причина отмены бронирования" required>
              <select value={reason} onChange={(e) => onReasonChange(e.target.value)}>
                <option value="Изменение планов">Изменение личных планов</option>
                <option value="Состояние здоровья">Состояние здоровья / болезнь</option>
                <option value="Семейные обстоятельства">Семейные обстоятельства</option>
                <option value="Перенос поездки на другой сезон">Перенос поездки на другой сезон</option>
                <option value="Другая причина">Другая причина</option>
              </select>
            </Field>
            <Field label="Комментарий к заявлению (необязательно)">
              <textarea rows={2} placeholder="Укажите дополнительные детали, если необходимо..." value={comment} onChange={(e) => onCommentChange(e.target.value)} />
            </Field>
          </div>
          <ErrorBox error={error} />
        </div>
      )}
    </Modal>
  );
}
