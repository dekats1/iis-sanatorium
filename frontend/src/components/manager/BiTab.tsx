import { useState } from 'react';
import { bi } from '../../api/endpoints';
import { Button, Card, money, Skeleton, StatCard } from '../ui';
import { DataTable, type Column } from '../DataTable';
import { Icon } from '../icons';
import type { BiMonthlyPoint, ProfilePopularity } from '../../types';
import { PlanFactChart, ShareBar } from './charts';

type Period = 6 | 12 | 24;

export default function BiTab({ monthly, profiles, loading }: { monthly: BiMonthlyPoint[]; profiles: ProfilePopularity[]; loading: boolean }) {
  const [period, setPeriod] = useState<Period>(12);
  const shown = monthly.slice(-period);
  const fact = shown.reduce((s, m) => s + m.revenue, 0);
  const plan = shown.reduce((s, m) => s + m.targetRevenue, 0);
  const vouchers = shown.reduce((s, m) => s + m.vouchersCount, 0);
  const avgOcc = shown.length > 0 ? shown.reduce((s, m) => s + m.occupancyPct, 0) / shown.length : 0;
  const done = plan > 0 ? (fact / plan) * 100 : 0;
  const metMonths = shown.filter((m) => m.revenue >= m.targetRevenue).length;

  const columns: Column<ProfilePopularity>[] = [
    { key: 'name', header: 'Лечебный профиль', render: (p) => <strong>{p.profileName}</strong>, sortValue: (p) => p.profileName },
    { key: 'vouchers', header: 'Путёвок', align: 'right', render: (p) => p.vouchersCount, sortValue: (p) => p.vouchersCount },
    { key: 'share', header: 'Доля загрузки', align: 'right', render: (p) => `${p.sharePercent}%`, sortValue: (p) => p.sharePercent },
    { key: 'revenue', header: 'Выручка направления', align: 'right', render: (p) => <span className="u-accent u-semibold">{money(p.revenue)}</span>, sortValue: (p) => p.revenue },
    { key: 'bar', header: 'Структура', render: (p) => <ShareBar value={p.sharePercent} label={`Доля ${p.profileName}`} /> },
  ];

  return (
    <div className="u-stack-16">
      <div className="kpi-grid">
        <StatCard label={`Выручка за ${period} мес.`} value={money(fact)} subvalue={`План: ${money(plan)}`} color="c-blue" icon={<Icon name="wallet" size={20} />} trend={shown.length > 1 ? shown.map((m) => m.revenue) : undefined} />
        <StatCard label="Выполнение плана" value={`${done.toFixed(1)}%`} subvalue={`План выполнен в ${metMonths} из ${shown.length} мес.`} color={done >= 100 ? 'c-teal' : 'c-amber'} icon={<Icon name="checkCircle" size={20} />} />
        <StatCard label="Средняя загрузка" value={`${avgOcc.toFixed(1)}%`} color="c-teal" icon={<Icon name="bed" size={20} />} trend={shown.length > 1 ? shown.map((m) => m.occupancyPct) : undefined} />
        <StatCard label="Оформлено путёвок" value={vouchers} icon={<Icon name="ticket" size={20} />} />
      </div>

      <Card
        title="Выручка: план и факт"
        subtitle={`Помесячная динамика доходов санатория за ${period} мес.`}
        actions={
          <>
            <div className="chip-row" role="group" aria-label="Период отчёта">
              {([6, 12, 24] as Period[]).map((p) => (
                <button key={p} type="button" className="chip" aria-pressed={period === p} onClick={() => setPeriod(p)}>
                  {p} мес
                </button>
              ))}
            </div>
            <Button variant="outline" size="sm" icon={<Icon name="download" size={16} />} onClick={() => void bi.exportCsv()}>
              Экспорт в CSV
            </Button>
          </>
        }
      >
        {loading ? <Skeleton height={300} /> : <PlanFactChart data={shown} />}
      </Card>

      <Card title="Востребованность лечебных профилей" subtitle="Доля путёвок и вклад каждого медицинского направления в выручку">
        <DataTable
          rows={profiles}
          columns={columns}
          rowKey={(p) => p.profileId}
          label="Востребованность лечебных профилей"
          loading={loading}
          initialSort={{ key: 'share', dir: 'desc' }}
          emptyTitle="Нет данных по профилям"
        />
      </Card>
    </div>
  );
}
