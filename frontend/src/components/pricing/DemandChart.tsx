import { useId, useMemo, useState, type KeyboardEvent, type MouseEvent } from 'react';
import type { ForecastPoint, HistoryPoint } from '../../types';

const W = 720;
const H = 280;
const PAD = { top: 16, right: 20, bottom: 36, left: 48 };
const DAY = 86_400_000;

interface Row {
  date: string;
  t: number;
  history?: number;
  sold?: number;
  available?: number;
  forecast?: number;
  lower?: number;
  upper?: number;
}

const ts = (d: string) => Date.parse(`${d}T00:00:00Z`);
const fmtShort = (t: number) => {
  const d = new Date(t);
  return `${String(d.getUTCDate()).padStart(2, '0')}.${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
};
const fmtFull = (d: string) => d.split('-').reverse().join('.');
const pct = (v: number) => `${v.toFixed(1).replace('.', ',')} %`;
const clamp = (v: number) => Math.max(0, Math.min(100, v));

function linePath(pts: [number, number][]) {
  return pts.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`).join(' ');
}

/**
 * График загрузки, %: история спроса (продано / доступно) и прогноз с 95% доверительной полосой.
 * Чистый SVG на токенах; ось времени общая, tooltip по ближайшей дате (мышь и стрелки клавиатуры).
 */
export default function DemandChart({ history, forecast }: { history: HistoryPoint[]; forecast: ForecastPoint[] }) {
  const titleId = useId();
  const [active, setActive] = useState<number | null>(null);

  const rows = useMemo<Row[]>(() => {
    const map = new Map<string, Row>();
    const get = (date: string) => {
      let r = map.get(date);
      if (!r) {
        r = { date, t: ts(date) };
        map.set(date, r);
      }
      return r;
    };
    for (const p of history) {
      const r = get(p.stay_date);
      r.sold = p.sold;
      r.available = p.available;
      r.history = p.available > 0 ? clamp((p.sold / p.available) * 100) : 0;
    }
    for (const p of forecast) {
      const r = get(p.stay_date);
      r.forecast = clamp(p.predicted_occ);
      if (typeof p.lower_95 === 'number' && typeof p.upper_95 === 'number') {
        r.lower = clamp(p.lower_95);
        r.upper = clamp(p.upper_95);
      }
    }
    return [...map.values()].filter((r) => !Number.isNaN(r.t)).sort((a, b) => a.t - b.t);
  }, [history, forecast]);

  const histRows = rows.filter((r) => r.history !== undefined);
  const fcRows = rows.filter((r) => r.forecast !== undefined);
  const bandRows = fcRows.filter((r) => r.lower !== undefined && r.upper !== undefined);
  if (histRows.length < 2 && fcRows.length < 2) return null;

  const t0 = rows[0].t;
  const t1 = Math.max(rows[rows.length - 1].t, t0 + DAY);
  const iw = W - PAD.left - PAD.right;
  const ih = H - PAD.top - PAD.bottom;
  const x = (t: number) => PAD.left + ((t - t0) / (t1 - t0)) * iw;
  const y = (v: number) => PAD.top + ih - (v / 100) * ih;

  const xTicks = Array.from({ length: 6 }, (_, i) => t0 + ((t1 - t0) * i) / 5);
  const yTicks = [0, 25, 50, 75, 100];

  const histPath = histRows.length >= 2 ? linePath(histRows.map((r) => [x(r.t), y(r.history!)])) : null;
  const fcPath = fcRows.length >= 2 ? linePath(fcRows.map((r) => [x(r.t), y(r.forecast!)])) : null;
  const bandPath = bandRows.length >= 2
    ? `${linePath(bandRows.map((r) => [x(r.t), y(r.upper!)]))} ${bandRows
        .slice()
        .reverse()
        .map((r) => `L${x(r.t).toFixed(1)} ${y(r.lower!).toFixed(1)}`)
        .join(' ')} Z`
    : null;
  const todayT = Date.parse(`${new Date().toISOString().slice(0, 10)}T00:00:00Z`);
  const showToday = todayT > t0 && todayT < t1;

  const nearest = (t: number) => {
    let best = 0;
    for (let i = 1; i < rows.length; i++) if (Math.abs(rows[i].t - t) < Math.abs(rows[best].t - t)) best = i;
    return best;
  };

  function onMove(e: MouseEvent<SVGSVGElement>) {
    const box = e.currentTarget.getBoundingClientRect();
    const sx = ((e.clientX - box.left) / box.width) * W;
    const t = t0 + ((sx - PAD.left) / iw) * (t1 - t0);
    setActive(nearest(t));
  }

  function onKey(e: KeyboardEvent<SVGSVGElement>) {
    if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
      e.preventDefault();
      setActive((a) => {
        const cur = a ?? (e.key === 'ArrowRight' ? -1 : rows.length);
        return Math.max(0, Math.min(rows.length - 1, cur + (e.key === 'ArrowRight' ? 1 : -1)));
      });
    } else if (e.key === 'Escape') {
      setActive(null);
    }
  }

  const cur = active !== null ? rows[active] : null;
  const curY = cur ? y(cur.history ?? cur.forecast ?? 0) : 0;

  return (
    <figure className="demand-chart u-m0">
      <figcaption id={titleId} className="sr-only">
        Загрузка номеров, %: история спроса и прогноз по датам заезда. Стрелки влево и вправо — переход между датами.
      </figcaption>
      <div className="chart">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          role="img"
          aria-labelledby={titleId}
          tabIndex={0}
          onMouseMove={onMove}
          onMouseLeave={() => setActive(null)}
          onKeyDown={onKey}
          onBlur={() => setActive(null)}
        >
          {yTicks.map((v) => (
            <g key={v}>
              <line className="chart-grid" x1={PAD.left} x2={W - PAD.right} y1={y(v)} y2={y(v)} />
              <text className="chart-axis" x={PAD.left - 8} y={y(v) + 4} textAnchor="end">{v}%</text>
            </g>
          ))}
          {xTicks.map((t, i) => (
            <text key={i} className="chart-axis" x={x(t)} y={H - 12} textAnchor={i === 0 ? 'start' : i === 5 ? 'end' : 'middle'}>
              {fmtShort(t)}
            </text>
          ))}
          <line className="demand-axis-line" x1={PAD.left} x2={W - PAD.right} y1={y(0)} y2={y(0)} />
          {showToday && (
            <g>
              <line className="demand-today" x1={x(todayT)} x2={x(todayT)} y1={PAD.top} y2={y(0)} />
              <text className="chart-axis" x={x(todayT) + 4} y={PAD.top + 10}>сегодня</text>
            </g>
          )}
          {bandPath && <path d={bandPath} className="demand-band" />}
          {histPath && <path d={histPath} className="demand-line is-history" fill="none" />}
          {fcPath && <path d={fcPath} className="demand-line is-forecast" fill="none" />}
          {cur && (
            <g>
              <line className="demand-cursor" x1={x(cur.t)} x2={x(cur.t)} y1={PAD.top} y2={y(0)} />
              {cur.history !== undefined && <circle className="demand-dot is-history" cx={x(cur.t)} cy={y(cur.history)} r={4.5} />}
              {cur.forecast !== undefined && <circle className="demand-dot is-forecast" cx={x(cur.t)} cy={y(cur.forecast)} r={4.5} />}
            </g>
          )}
        </svg>
        {cur && (
          <div
            className="chart-tooltip"
            role="status"
            style={{ left: `${(x(cur.t) / W) * 100}%`, top: `${(curY / H) * 100}%` }}
          >
            <div className="u-semibold">{fmtFull(cur.date)}</div>
            {cur.history !== undefined && (
              <div>
                <span className="legend-swatch demand-swatch-history" />
                Факт: {pct(cur.history)} ({cur.sold} из {cur.available})
              </div>
            )}
            {cur.forecast !== undefined && (
              <div>
                <span className="legend-swatch demand-swatch-forecast" />
                Прогноз: {pct(cur.forecast)}
              </div>
            )}
            {cur.lower !== undefined && cur.upper !== undefined && (
              <div>
                <span className="legend-swatch demand-swatch-band" />
                95% интервал: {pct(cur.lower)} – {pct(cur.upper)}
              </div>
            )}
          </div>
        )}
      </div>
      <div className="chart-legend">
        {histPath && <span><span className="legend-swatch demand-swatch-history" />Загрузка по истории (продано / доступно)</span>}
        {fcPath && <span><span className="legend-swatch demand-swatch-forecast" />Прогноз загрузки</span>}
        {bandPath && <span><span className="legend-swatch demand-swatch-band" />95% доверительный интервал</span>}
      </div>
    </figure>
  );
}
