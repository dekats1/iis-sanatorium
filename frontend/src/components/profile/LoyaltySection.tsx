import { Badge, Card, formatDateTime, money } from '../ui';
import { DataTable, type Column } from '../DataTable';
import { Icon, type IconName } from '../icons';
import type { BonusTransaction, BonusTransactionType, LoyaltyAccount } from '../../types';

const TX_META: Record<BonusTransactionType, { label: string; variant: 'good' | 'wait' | 'info'; icon: IconName }> = {
  ACCRUAL: { label: 'Начисление кешбэка', variant: 'good', icon: 'trendUp' },
  WELCOME: { label: 'Приветственный бонус', variant: 'good', icon: 'sparkles' },
  REDEMPTION: { label: 'Списание на скидку', variant: 'wait', icon: 'trendDown' },
  PROMO: { label: 'Промо-бонус', variant: 'info', icon: 'tag' },
  ADJUSTMENT: { label: 'Корректировка', variant: 'info', icon: 'edit' },
};

const txMeta = (t: BonusTransactionType) => TX_META[t] ?? TX_META.ADJUSTMENT;

const TX_COLUMNS: Column<BonusTransaction>[] = [
  { key: 'date', header: 'Дата операции', render: (tx) => formatDateTime(tx.createdAt), sortValue: (tx) => tx.createdAt },
  {
    key: 'type',
    header: 'Тип операции',
    render: (tx) => {
      const m = txMeta(tx.type);
      return <Badge variant={m.variant} icon={m.icon}>{m.label}</Badge>;
    },
    sortValue: (tx) => txMeta(tx.type).label,
  },
  {
    key: 'amount',
    header: 'Сумма баллов',
    align: 'right',
    render: (tx) => (
      <span className={`loyalty-amount ${tx.amount > 0 ? 'is-plus' : 'is-minus'}`}>
        {tx.amount > 0 ? `+${tx.amount}` : tx.amount} б.
      </span>
    ),
    sortValue: (tx) => tx.amount,
  },
  {
    key: 'description',
    header: 'Основание / Описание',
    className: 'wrap',
    render: (tx) => (
      <>
        {tx.description}
        {tx.voucherId && <span className="u-accent"> (путёвка #{tx.voucherId})</span>}
      </>
    ),
  },
];

/** Вкладка «Программа лояльности»: карта уровня, прогресс до следующего уровня, история операций. */
export default function LoyaltySection({ account, transactions }: { account: LoyaltyAccount; transactions: BonusTransaction[] }) {
  const threshold = account.nextTierThreshold;
  const progress = threshold ? Math.min(100, Math.round((account.spentMoneyTotal / threshold) * 100)) : 100;
  const premium = account.tier === 'PLATINUM' || account.tier === 'GOLD';

  return (
    <div className="u-stack-16">
      <div className="loyalty-layout">
        <div className={`loyalty-card tier-${account.tier.toLowerCase()}`} aria-label={`Карта гостя, уровень ${account.tierName}`} role="group">
          <div className="loyalty-card-top">
            <div>
              <div className="loyalty-card-brand">Санаторий ИИС • Клуб Гостя</div>
              <div className="loyalty-card-tier">{account.tierName}</div>
            </div>
            <span className="loyalty-card-emblem" aria-hidden="true">
              <Icon name={premium ? 'star' : 'shield'} size={24} />
            </span>
          </div>
          <div>
            <div className="loyalty-card-balance">{account.balance.toLocaleString('ru-RU')}</div>
            <div className="loyalty-card-caption">Бонусных баллов (1 балл = 1 BYN)</div>
          </div>
          <div className="loyalty-card-foot">
            <span>Кешбэк: {account.cashbackPercent}%</span>
            <span>Скидка на спа: {account.discountPercent}%</span>
            <span>ID: #{account.clientId}</span>
          </div>
        </div>

        <Card title="Статус программы лояльности" actions={<Badge variant="good" icon="star">{account.tierName}</Badge>} className="u-m0">
          <p className="u-muted-sm">
            Всего потрачено на путёвки: <strong>{money(account.spentMoneyTotal)}</strong>
          </p>
          {threshold ? (
            <div className="loyalty-progress">
              <div className="u-between u-muted-sm">
                <span id="loyalty-progress-label">Прогресс до следующего ранга</span>
                <span className="u-semibold">{account.spentMoneyTotal} / {threshold} BYN</span>
              </div>
              <div
                className="progress-track"
                role="progressbar"
                aria-labelledby="loyalty-progress-label"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={progress}
              >
                <div className="loyalty-progress-fill" style={{ width: `${progress}%` }} />
              </div>
              <p className="u-accent u-semibold u-m0">
                Осталось потратить {threshold - account.spentMoneyTotal} BYN до повышения кешбэка!
              </p>
            </div>
          ) : (
            <p className="u-ok u-semibold u-flex-center u-m0">
              <Icon name="sparkles" size={18} /> Вы достигли максимального платинового уровня привилегий!
            </p>
          )}

          <h4 className="u-mt-20">Ваши персональные привилегии:</h4>
          <ul className="loyalty-privileges">
            {account.privileges.map((p, idx) => (
              <li key={idx}>
                <Icon name="checkCircle" size={16} /> {p}
              </li>
            ))}
          </ul>
        </Card>
      </div>

      <Card title="История бонусных операций" subtitle="Начисления кешбэка за путёвки, списания на скидки и промо-бонусы">
        <DataTable
          rows={transactions}
          columns={TX_COLUMNS}
          rowKey={(tx) => tx.id}
          label="История бонусных операций"
          searchText={(tx) => `${txMeta(tx.type).label} ${tx.description} ${tx.voucherId ?? ''}`}
          searchPlaceholder="Поиск по операциям"
          initialSort={{ key: 'date', dir: 'desc' }}
          emptyTitle="История бонусных операций пока пуста"
          emptyDescription="Баллы начисляются автоматически после оплаты путёвки."
        />
      </Card>
    </div>
  );
}
