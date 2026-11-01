import { DataTable, type Column } from '../DataTable';
import { Badge, Button, formatDateTime } from '../ui';
import { Icon } from '../icons';
import type { BonusTransaction, BonusTransactionType, LoyaltyAccount } from '../../types';

const TX_NAMES: Record<BonusTransactionType, string> = {
  ACCRUAL: 'Начисление',
  REDEMPTION: 'Списание',
  WELCOME: 'Приветственные',
  PROMO: 'Акция',
  ADJUSTMENT: 'Корректировка',
};

const columns: Column<BonusTransaction>[] = [
  { key: 'date', header: 'Дата', render: (tx) => formatDateTime(tx.createdAt), sortValue: (tx) => tx.createdAt },
  {
    key: 'type',
    header: 'Тип',
    render: (tx) => (
      <Badge variant={tx.amount > 0 ? 'good' : 'wait'} icon={tx.amount > 0 ? 'trendUp' : 'trendDown'}>
        {TX_NAMES[tx.type] ?? tx.type}
      </Badge>
    ),
    sortValue: (tx) => tx.type,
  },
  {
    key: 'amount',
    header: 'Баллы',
    align: 'right',
    render: (tx) => (
      <span className={`u-semibold ${tx.amount > 0 ? 'u-ok' : 'u-danger'}`}>
        {tx.amount > 0 ? `+${tx.amount}` : tx.amount} б.
      </span>
    ),
    sortValue: (tx) => tx.amount,
  },
  { key: 'desc', header: 'Описание', className: 'wrap', render: (tx) => tx.description },
];

/** Программа лояльности гостя: уровень, баланс, прогресс до следующего уровня и история баллов. */
export function LoyaltyPanel({
  account,
  transactions,
  onAddBonus,
}: {
  account: LoyaltyAccount;
  transactions: BonusTransaction[];
  onAddBonus?: () => void;
}) {
  const next = account.nextTierThreshold;
  const progress = next ? Math.min(100, Math.round((account.spentMoneyTotal / next) * 100)) : 100;

  return (
    <div className="u-stack-16">
      <div className="dc-loyalty">
        <div className="dc-loyalty-tier">
          <span className="dc-loyalty-icon" aria-hidden="true">
            <Icon name="star" size={22} />
          </span>
          <div>
            <span className="dc-eyebrow">Уровень гостя</span>
            <span className="dc-loyalty-name">{account.tierName}</span>
            <span className="u-muted-sm">
              Кешбэк {account.cashbackPercent}% · скидка {account.discountPercent}%
            </span>
          </div>
        </div>
        <div className="dc-loyalty-balance">
          <span className="dc-eyebrow">Баланс бонусов</span>
          <span className="dc-loyalty-value">{account.balance.toLocaleString('ru-RU')} б.</span>
          <span className="u-muted-sm">
            Начислено {account.totalEarned.toLocaleString('ru-RU')} · списано {account.totalSpent.toLocaleString('ru-RU')}
          </span>
        </div>
        {onAddBonus && (
          <Button variant="primary" size="sm" icon={<Icon name="plus" size={16} />} onClick={onAddBonus}>
            Начислить баллы
          </Button>
        )}
        <div className="dc-loyalty-progress">
          <div className="u-between u-muted-sm">
            <span>{next ? 'До следующего уровня' : 'Максимальный уровень'}</span>
            {next && (
              <span>
                {account.spentMoneyTotal.toLocaleString('ru-RU')} / {next.toLocaleString('ru-RU')} BYN
              </span>
            )}
          </div>
          <div className="dc-progress" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress} aria-label="Прогресс до следующего уровня">
            <span className="dc-progress-bar" style={{ width: `${progress}%` }} />
          </div>
        </div>
      </div>

      {account.privileges.length > 0 && (
        <ul className="dc-privileges">
          {account.privileges.map((p, i) => (
            <li key={`${p}-${i}`}>
              <Icon name="checkCircle" size={16} />
              {p}
            </li>
          ))}
        </ul>
      )}

      <DataTable
        rows={transactions}
        columns={columns}
        rowKey={(tx) => tx.id}
        caption="История бонусных начислений"
        initialSort={{ key: 'date', dir: 'desc' }}
        dense
        emptyTitle="Операций с баллами пока нет"
      />
    </div>
  );
}
