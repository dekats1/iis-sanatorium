import { useId, useRef, useState, type KeyboardEvent, type MouseEvent } from 'react';
import { EmptyState, money } from '../ui';
import type { BiMonthlyPoint, ChannelRevenue, ForecastPoint } from '../../types';

/* ------------------------------------------------------------------ */
/* Общие помощники                                                     */
/* ------------------------------------------------------------------ */

/** «Красивый» верхний предел оси: 1/2/2.5/5 × 10^n. */
function niceMax(value: number): number {
  if (!Number.isFinite(value) || value <= 0) return 1;
  const exp = Math.pow(10, Math.floor(Math.log10(value)));
  const f = value / exp;
  const nice = f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10;
  return nice * exp;
}

/** Короткая подпись денег для оси: 12 тыс., 1,2 млн. */
export function shortMoney(v: number): string {
  if (Math.abs(v) >= 1_000_000) return `${(v / 1_000_000).toLocaleString('ru-RU', { maximumFractionDigits: 1 })} млн`;
  if (Math.abs(v) >= 1_000) return `${Math.round(v / 1_000).toLocaleString('ru-RU')} тыс.`;
  return Math.round(v).toLocaleString('ru-RU');
}

function shortDate(iso: string | undefined): string {
  if (!iso) return '';
  const [, m, d] = iso.split('-');
  return d && m ? `${d}.${m}` : iso;
}

/** Индекс ближайшей точки по позиции курсора внутри SVG. */
function useHoverIndex(count: number, xOf: (i: number) => number, width: number) {
  const ref = useRef<SVGSVGElement>(null);
  const [idx, setIdx] = useState<number | null>(null);

  const onMove = (e: MouseEvent<SVGSVGElement>) => {
    const svg = ref.current;
    if (!svg || count === 0) return;
    const rect = svg.getBoundingClientRect();
    const px = ((e.clientX - rect.left) / rect.width) * width;
    let best = 0;
    let bestDist = Infinity;
    for (let i = 0; i < count; i++) {
      const d = Math.abs(xOf(i) - px);
      if (d < bestDist) {
        bestDist = d;
        best = i;
      }
    }
    setIdx(best);
  };

  const onKey = (e: KeyboardEvent<SVGSVGElement>) => {
    if (count === 0) return;
    if (e.key === 'ArrowRight') {
      e.preventDefault();
      setIdx((i) => (i === null ? 0 : Math.min(count - 1, i + 1)));
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      setIdx((i) => (i === null ? count - 1 : Math.max(0, i - 1)));
    } else if (e.key === 'Escape') {
      setIdx(null);
    }
  };

  return { ref, idx, setIdx, onMove, onKey, onLeave: () => setIdx(null) };
}

/* ------------------------------------------------------------------ */
/* Прогноз загрузки: линия + область, целевая линия 80 %               */
/* ------------------------------------------------------------------ */

export function ForecastChart({ points, target = 80 }: { points: ForecastPoint[]; target?: number }) {
  const gradId = useId().replace(/:/g, '');
  const W = 780;
  const H = 300;
  const L = 56;
  const R = 20;
  const T = 20;
  const B = 52;
  const cw = W - L - R;
  const ch = H - T - B;
  const n = Array.isArray(points) ? points.length : 0;
  const x = (i: number) => L + (n > 1 ? (i * cw) / (n - 1) : cw / 2);
  const y = (v: number) => T + ch - (Math.max(0, Math.min(100, Number(v) || 0)) * ch) / 100;
  const hover = useHoverIndex(n, x, W);

  if (n < 2) {
    return (
      <EmptyState
        title="Нет данных прогноза"
        description="Нажмите «Построить прогноз», чтобы рассчитать спрос для выбранной категории на 60 дней вперёд."
      />
    );
  }

  const line = points.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)} ${y(p.predicted_occ).toFixed(1)}`).join(' ');
  const area = `${line} L${x(n - 1).toFixed(1)} ${y(0)} L${x(0).toFixed(1)} ${y(0)} Z`;
  const hasBand = points.some((p) => p.lower_95 != null && p.upper_95 != null);
  const lo = (p: ForecastPoint) => Number(p.lower_95 ?? p.predicted_occ);
  const hi = (p: ForecastPoint) => Number(p.upper_95 ?? p.predicted_occ);
  const band = hasBand
    ? `${points.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)} ${y(hi(p)).toFixed(1)}`).join(' ')} ${points
        .map((_, k) => {
          const i = n - 1 - k;
          return `L${x(i).toFixed(1)} ${y(lo(points[i])).toFixed(1)}`;
        })
        .join(' ')} Z`
    : '';
  const xTickCount = Math.min(6, n);
  const xTicks = Array.from({ length: xTickCount }, (_, k) => Math.round((k * (n - 1)) / (xTickCount - 1)));
  const avg = points.reduce((s, p) => s + (Number(p.predicted_occ) || 0), 0) / n;
  const hp = hover.idx !== null ? points[hover.idx] : null;

  return (
    <div className="chart mgr-chart">
      <svg
        ref={hover.ref}
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        tabIndex={0}
        aria-label={`Прогноз загрузки на ${n} дней: с ${points[0].stay_date} по ${points[n - 1].stay_date}, в среднем ${avg.toFixed(1)}%. Стрелки влево и вправо — просмотр значений.`}
        onMouseMove={hover.onMove}
        onMouseLeave={hover.onLeave}
        onKeyDown={hover.onKey}
        onBlur={hover.onLeave}
      >
        <defs>
          <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--chart-1)" stopOpacity="0.28" />
            <stop offset="100%" stopColor="var(--chart-1)" stopOpacity="0.02" />
          </linearGradient>
        </defs>

        {[0, 25, 50, 75, 100].map((t) => (
          <g key={t}>
            <line className="chart-grid" x1={L} x2={W - R} y1={y(t)} y2={y(t)} />
            <text className="chart-axis" x={L - 8} y={y(t) + 4} textAnchor="end">
              {t}%
            </text>
          </g>
        ))}

        {xTicks.map((i) => (
          <text key={i} className="chart-axis" x={x(i)} y={T + ch + 20} textAnchor={i === 0 ? 'start' : i === n - 1 ? 'end' : 'middle'}>
            {shortDate(points[i]?.stay_date)}
          </text>
        ))}

        <text className="chart-axis mgr-axis-title" x={L + cw / 2} y={H - 6} textAnchor="middle">
          Дата заезда
        </text>
        <text className="chart-axis mgr-axis-title" transform={`translate(14 ${T + ch / 2}) rotate(-90)`} textAnchor="middle">
          Загрузка, %
        </text>

        <line className="mgr-target-line" x1={L} x2={W - R} y1={y(target)} y2={y(target)} />

        <path d={area} fill={`url(#${gradId})`} />
        {hasBand && <path d={band} className="mgr-band" />}
        <path d={line} className="mgr-line" />

        {hover.idx !== null && hp && (
          <g>
            <line className="mgr-crosshair" x1={x(hover.idx)} x2={x(hover.idx)} y1={T} y2={T + ch} />
            <circle className="mgr-dot" cx={x(hover.idx)} cy={y(hp.predicted_occ)} r={5} />
          </g>
        )}
      </svg>

      {hp && hover.idx !== null && (
        <div
          className="chart-tooltip"
          style={{ left: `${(x(hover.idx) / W) * 100}%`, top: `${(y(hp.predicted_occ) / H) * 100}%` }}
          role="status"
        >
          <div>{hp.stay_date}</div>
          <strong>Загрузка: {Number(hp.predicted_occ ?? 0).toFixed(1)}%</strong>
          {hp.lower_95 != null && hp.upper_95 != null && (
            <div>
              95% интервал: {Number(hp.lower_95).toFixed(1)}–{Number(hp.upper_95).toFixed(1)}%
            </div>
          )}
        </div>
      )}

      <div className="chart-legend">
        <span>
          <span className="legend-swatch mgr-sw-1" aria-hidden="true" />
          Прогноз загрузки
        </span>
        {hasBand && (
          <span>
            <span className="legend-swatch mgr-sw-band" aria-hidden="true" />
            Доверительный интервал 95%
          </span>
        )}
        <span>
          <span className="legend-swatch mgr-sw-target" aria-hidden="true" />
          Целевая загрузка {target}%
        </span>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* План / факт по месяцам: сгруппированные столбцы                     */
/* ------------------------------------------------------------------ */

export function PlanFactChart({ data }: { data: BiMonthlyPoint[] }) {
  const W = 780;
  const H = 320;
  const L = 72;
  const R = 16;
  const T = 16;
  const B = 56;
  const cw = W - L - R;
  const ch = H - T - B;
  const n = data.length;
  const gw = n > 0 ? cw / n : cw;
  const cx = (i: number) => L + gw * i + gw / 2;
  const hover = useHoverIndex(n, cx, W);

  if (n === 0) {
    return <EmptyState title="Нет данных за период" description="Помесячная статистика появится после первых оплаченных путёвок." />;
  }

  const max = niceMax(Math.max(...data.map((d) => Math.max(d.revenue, d.targetRevenue))) * 1.05);
  const y = (v: number) => T + ch - (Math.max(0, v) / max) * ch;
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((k) => k * max);
  const barW = Math.max(3, Math.min(26, gw * 0.34));
  const labelEvery = Math.ceil(n / 12);
  const hp = hover.idx !== null ? data[hover.idx] : null;
  const totalFact = data.reduce((s, d) => s + d.revenue, 0);
  const totalPlan = data.reduce((s, d) => s + d.targetRevenue, 0);

  return (
    <div className="chart mgr-chart">
      <svg
        ref={hover.ref}
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        tabIndex={0}
        aria-label={`Выручка по месяцам, план и факт за ${n} мес.: факт ${money(totalFact)}, план ${money(totalPlan)}. Стрелки влево и вправо — просмотр месяцев.`}
        onMouseMove={hover.onMove}
        onMouseLeave={hover.onLeave}
        onKeyDown={hover.onKey}
        onBlur={hover.onLeave}
      >
        {ticks.map((t) => (
          <g key={t}>
            <line className="chart-grid" x1={L} x2={W - R} y1={y(t)} y2={y(t)} />
            <text className="chart-axis" x={L - 8} y={y(t) + 4} textAnchor="end">
              {shortMoney(t)}
            </text>
          </g>
        ))}

        {hover.idx !== null && <rect className="mgr-hover-band" x={L + gw * hover.idx} y={T} width={gw} height={ch} />}

        {data.map((d, i) => (
          <g key={`${d.month}-${i}`}>
            <rect className="mgr-bar-fact" x={cx(i) - barW - 1} y={y(d.revenue)} width={barW} height={Math.max(0, T + ch - y(d.revenue))} rx={3} />
            <rect className="mgr-bar-plan" x={cx(i) + 1} y={y(d.targetRevenue)} width={barW} height={Math.max(0, T + ch - y(d.targetRevenue))} rx={3} />
            {i % labelEvery === 0 && (
              <text className="chart-axis" x={cx(i)} y={T + ch + 18} textAnchor="middle">
                {d.month}
              </text>
            )}
          </g>
        ))}

        <text className="chart-axis mgr-axis-title" x={L + cw / 2} y={H - 8} textAnchor="middle">
          Месяц
        </text>
        <text className="chart-axis mgr-axis-title" transform={`translate(14 ${T + ch / 2}) rotate(-90)`} textAnchor="middle">
          Выручка, BYN
        </text>
      </svg>

      {hp && hover.idx !== null && (
        <div
          className="chart-tooltip"
          style={{ left: `${(cx(hover.idx) / W) * 100}%`, top: `${(y(Math.max(hp.revenue, hp.targetRevenue)) / H) * 100}%` }}
          role="status"
        >
          <div>{hp.month}</div>
          <div>Факт: <strong>{money(hp.revenue)}</strong></div>
          <div>План: {money(hp.targetRevenue)}</div>
          <div>
            Выполнение: {hp.targetRevenue > 0 ? Math.round((hp.revenue / hp.targetRevenue) * 100) : 0}% · загрузка {hp.occupancyPct}%
          </div>
        </div>
      )}

      <div className="chart-legend">
        <span>
          <span className="legend-swatch mgr-sw-1" aria-hidden="true" />
          Фактическая выручка
        </span>
        <span>
          <span className="legend-swatch mgr-sw-4" aria-hidden="true" />
          Плановый показатель
        </span>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Каналы продаж: горизонтальные столбцы «чистая выручка + комиссия»   */
/* ------------------------------------------------------------------ */

export function ChannelBars({ channels }: { channels: ChannelRevenue[] }) {
  if (channels.length === 0) return null;
  const max = Math.max(...channels.map((c) => c.revenue), 1);
  return (
    <div className="mgr-hbars">
      <ul className="mgr-hbar-list" aria-label="Структура выручки по каналам">
        {channels.map((c) => {
          const net = Math.max(0, c.revenue - c.commission);
          return (
            <li key={c.channel} className="mgr-hbar-row">
              <span className="mgr-hbar-label">{c.channel}</span>
              <span className="mgr-hbar-track" aria-hidden="true">
                <span className="mgr-hbar-seg mgr-seg-1" style={{ width: `${(net / max) * 100}%` }} />
                <span className="mgr-hbar-seg mgr-seg-2" style={{ width: `${(Math.max(0, c.commission) / max) * 100}%` }} />
              </span>
              <span className="mgr-hbar-value">
                {money(c.revenue)}
                <span className="sr-only">, из них комиссия {money(c.commission)}</span>
              </span>
            </li>
          );
        })}
      </ul>
      <div className="chart-legend">
        <span>
          <span className="legend-swatch mgr-sw-1" aria-hidden="true" />
          Чистая выручка
        </span>
        <span>
          <span className="legend-swatch mgr-sw-2" aria-hidden="true" />
          Комиссия партнёра
        </span>
      </div>
    </div>
  );
}

/** Тонкая полоса доли (0–100 %). */
export function ShareBar({ value, tone = 'primary', label }: { value: number; tone?: 'primary' | 'ok' | 'warn' | 'danger'; label?: string }) {
  const pct = Math.max(0, Math.min(100, Number(value) || 0));
  return (
    <span
      className={`mgr-share mgr-share-${tone}`}
      role="meter"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(pct)}
      aria-label={label}
    >
      <span className="mgr-share-fill" style={{ width: `${pct}%` }} />
    </span>
  );
}
