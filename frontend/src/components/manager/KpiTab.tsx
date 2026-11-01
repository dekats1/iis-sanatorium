import { useMemo } from 'react';
import { Button, Card, ErrorBox, Field, money, StatCard } from '../ui';
import { DataTable, type Column } from '../DataTable';
import { Icon } from '../icons';
import type { BiMonthlyPoint, ChannelRevenue, KpiView, PriceReview, RoomCategory } from '../../types';
import { ChannelBars } from './charts';
import { ForecastControls, ForecastSummary, type ForecastState } from './ForecastTab';
import { PriceReviewsTable, type ReviewDecision } from './RulesTab';

interface MetricRow {
  id: string;
  name: string;
  value: string;
  note: string;
}

export interface KpiPeriodProps {
  from: string;
  to: string;
  onFromChange: (v: string) => void;
  onToChange: (v: string) => void;
  onCalculate: () => void;
  onPreset: (days: number) => void;
  kpi: KpiView | null;
  calculating: boolean;
  error: unknown;
}

export default function KpiTab({
  period,
  channels,
  monthly,
  loading,
  forecast,
  reviews,
  reviewsLoading,
  reviewsError,
  categories,
  busyId,
  onDecide,
}: {
  period: KpiPeriodProps;
  channels: ChannelRevenue[];
  monthly: BiMonthlyPoint[];
  loading: boolean;
  forecast: ForecastState;
  reviews: PriceReview[];
  reviewsLoading: boolean;
  reviewsError: unknown;
  categories: RoomCategory[];
  busyId: number | null;
  onDecide: (id: number, action: ReviewDecision) => void;
}) {
  const { kpi } = period;
  const recent = monthly.slice(-6);
  const occTrend = recent.length > 1 ? recent.map((m) => m.occupancyPct) : undefined;
  const revTrend = recent.length > 1 ? recent.map((m) => m.revenue) : undefined;

  const totals = useMemo(() => {
    const rev = channels.reduce((s, c) => s + c.revenue, 0);
    const comm = channels.reduce((s, c) => s + c.commission, 0);
    const vouchers = channels.reduce((s, c) => s + c.vouchers, 0);
    return { rev, comm, vouchers, net: rev - comm };
  }, [channels]);

  const metricRows: MetricRow[] = kpi
    ? [
        { id: 'occ', name: 'Загрузка фонда (Occ)', value: `${kpi.occPct.toFixed(1)}%`, note: 'Доля проданных койко-дней от доступных' },
        { id: 'adr', name: 'Средняя цена (ADR)', value: money(kpi.adr), note: 'Выручка на проданный койко-день' },
        { id: 'revpar', name: 'Доход на место (RevPAR)', value: money(kpi.revpar), note: 'Выручка на доступный койко-день' },
        { id: 'sold', name: 'Продано койко-дней', value: String(kpi.soldPlaceDays), note: `Период ${kpi.from} — ${kpi.to}` },
        { id: 'avail', name: 'Доступно койко-дней', value: String(kpi.availablePlaceDays), note: `Свободно: ${Math.max(0, kpi.availablePlaceDays - kpi.soldPlaceDays)}` },
      ]
    : [];

  const metricColumns: Column<MetricRow>[] = [
    { key: 'name', header: 'Показатель', render: (r) => <strong>{r.name}</strong> },
    { key: 'value', header: 'Значение', align: 'right', render: (r) => <span className="u-semibold">{r.value}</span> },
    { key: 'note', header: 'Пояснение', render: (r) => <span className="u-muted">{r.note}</span>, className: 'wrap' },
  ];

  const channelColumns: Column<ChannelRevenue>[] = [
    { key: 'channel', header: 'Канал продаж', render: (c) => <strong>{c.channel}</strong>, sortValue: (c) => c.channel },
    { key: 'vouchers', header: 'Путёвок', align: 'right', render: (c) => c.vouchers, sortValue: (c) => c.vouchers },
    { key: 'revenue', header: 'Выручка', align: 'right', render: (c) => <strong>{money(c.revenue)}</strong>, sortValue: (c) => c.revenue },
    {
      key: 'share',
      header: 'Доля',
      align: 'right',
      render: (c) => `${(totals.rev > 0 ? (c.revenue / totals.rev) * 100 : 0).toFixed(1)}%`,
      sortValue: (c) => c.revenue,
    },
    { key: 'commission', header: 'Комиссия', align: 'right', render: (c) => <span className="u-danger">{money(c.commission)}</span>, sortValue: (c) => c.commission },
    { key: 'net', header: 'Чистая выручка', align: 'right', render: (c) => <span className="u-ok u-semibold">{money(c.revenue - c.commission)}</span>, sortValue: (c) => c.revenue - c.commission },
    { key: 'avg', header: 'Средний чек', align: 'right', render: (c) => money(c.vouchers > 0 ? c.revenue / c.vouchers : 0), sortValue: (c) => (c.vouchers > 0 ? c.revenue / c.vouchers : 0) },
  ];

  const pending = reviews.filter((r) => r.status === 'PENDING_REVIEW');

  return (
    <div className="u-stack-16">
      <div className="mgr-section-head">
        <h2>Доходность и прогноз</h2>
        <p className="u-muted u-m0">Ключевые показатели за период, каналы продаж, прогноз загрузки и цены, ожидающие решения.</p>
      </div>

      <Card title="Показатели за период" subtitle="Occ, ADR и RevPAR по проданным койко-дням">
        <div className="mgr-period">
          <div className="chip-row" role="group" aria-label="Быстрый период">
            <button type="button" className="chip" onClick={() => period.onPreset(7)}>
              7 дней
            </button>
            <button type="button" className="chip" onClick={() => period.onPreset(30)}>
              30 дней
            </button>
            <button type="button" className="chip" onClick={() => period.onPreset(90)}>
              Квартал
            </button>
          </div>
          <div className="inline">
            <Field label="С даты">
              <input type="date" value={period.from} onChange={(e) => period.onFromChange(e.target.value)} />
            </Field>
            <Field label="По дату">
              <input type="date" value={period.to} onChange={(e) => period.onToChange(e.target.value)} />
            </Field>
            <Button variant="primary" icon={<Icon name="refresh" size={18} />} loading={period.calculating} onClick={period.onCalculate}>
              Рассчитать
            </Button>
          </div>
        </div>
        <ErrorBox error={period.error} />

        {kpi && (
          <div className="kpi-grid u-mt-16">
            <StatCard
              label="Загрузка фонда (Occ)"
              value={`${kpi.occPct.toFixed(1)}%`}
              subvalue="Цель: 80% койко-фонда"
              color={kpi.occPct >= 70 ? 'c-teal' : 'c-amber'}
              icon={<Icon name="key" size={20} />}
              trend={occTrend}
            />
            <StatCard label="Средняя цена (ADR)" value={money(kpi.adr)} subvalue="Average Daily Rate" color="c-blue" icon={<Icon name="tag" size={20} />} />
            <StatCard label="Доход на место (RevPAR)" value={money(kpi.revpar)} subvalue="Revenue Per Available Room" icon={<Icon name="wallet" size={20} />} trend={revTrend} />
            <StatCard
              label="Койко-дни (продано / всего)"
              value={`${kpi.soldPlaceDays} / ${kpi.availablePlaceDays}`}
              subvalue={`Свободно: ${Math.max(0, kpi.availablePlaceDays - kpi.soldPlaceDays)} мест`}
              color="c-amber"
              icon={<Icon name="bed" size={20} />}
            />
          </div>
        )}

        <DataTable
          rows={metricRows}
          columns={metricColumns}
          rowKey={(r) => r.id}
          caption="Показатели доходности"
          loading={loading || period.calculating}
          dense
          emptyTitle="Показатели ещё не рассчитаны"
          emptyDescription="Выберите период и нажмите «Рассчитать»."
        />
      </Card>

      <Card title="Каналы продаж" subtitle="Выручка, комиссия партнёров и чистый доход по источникам бронирования">
        <div className="kpi-grid">
          <StatCard label="Выручка брутто" value={money(totals.rev)} subvalue={`${totals.vouchers} путёвок`} color="c-blue" icon={<Icon name="wallet" size={20} />} />
          <StatCard label="Комиссия партнёров" value={money(totals.comm)} subvalue={totals.rev > 0 ? `${((totals.comm / totals.rev) * 100).toFixed(1)}% от выручки` : '—'} color="c-red" icon={<Icon name="creditCard" size={20} />} />
          <StatCard label="Чистая выручка" value={money(totals.net)} color="c-teal" icon={<Icon name="trendUp" size={20} />} />
        </div>
        <ChannelBars channels={channels} />
        <DataTable
          rows={channels}
          columns={channelColumns}
          rowKey={(c) => c.channel}
          caption="Выручка и комиссия по каналам"
          loading={loading}
          initialSort={{ key: 'revenue', dir: 'desc' }}
          emptyTitle="Продаж пока нет"
          emptyDescription="Данные по каналам появятся после первых оплаченных путёвок."
        />
      </Card>

      <div className="mgr-two-col">
        <Card title="Прогноз загрузки" subtitle="Пересчёт спроса на 60 дней вперёд по выбранной категории">
          <ForecastControls state={forecast} compact />
          <div className="u-mt-16">
            <ForecastSummary points={forecast.forecast} />
          </div>
        </Card>

        <Card title="Цены вне коридора" subtitle={pending.length > 0 ? `Ожидают решения: ${pending.length}` : 'Нерассмотренных рекомендаций нет'}>
          <ErrorBox error={reviewsError} />
          <PriceReviewsTable
            reviews={pending}
            categories={categories}
            caption="Рекомендации цены, ожидающие решения"
            loading={reviewsLoading}
            busyId={busyId}
            onDecide={onDecide}
            paginate={false}
          />
        </Card>
      </div>
    </div>
  );
}
