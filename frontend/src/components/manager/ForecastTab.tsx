import { Button, Card, ErrorBox, Field, Notice, Skeleton, StatCard } from '../ui';
import { Icon } from '../icons';
import type { ForecastPoint, ForecastRunResult, RoomCategory } from '../../types';
import { ForecastChart } from './charts';

export interface ForecastState {
  categories: RoomCategory[];
  categoryId: string;
  onCategoryChange: (id: string) => void;
  forecast: ForecastPoint[];
  result: ForecastRunResult | null;
  running: boolean;
  notice: string;
  error: unknown;
  onRun: () => void;
}

/** Выбор категории + кнопка «Построить прогноз» + итог прогона. Общая для обзора и вкладки прогноза. */
export function ForecastControls({ state, compact = false }: { state: ForecastState; compact?: boolean }) {
  const { categories, categoryId, onCategoryChange, running, notice, error, onRun } = state;
  return (
    <div className="u-stack-12">
      <div className="inline">
        <Field label="Категория номера" className="u-min-260">
          <select value={categoryId} onChange={(e) => onCategoryChange(e.target.value)} disabled={categories.length === 0}>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {compact ? c.name : `${c.name} (вместимость ${c.capacityTotal} чел.)`}
              </option>
            ))}
          </select>
        </Field>
        <Button variant="primary" icon={<Icon name="sparkles" size={18} />} loading={running} disabled={!categoryId} onClick={onRun}>
          Построить прогноз
        </Button>
      </div>
      {notice && <Notice tone="success">{notice}</Notice>}
      <ErrorBox error={error} />
    </div>
  );
}

function summarize(points: ForecastPoint[]) {
  if (points.length === 0) return null;
  const vals = points.map((p) => Number(p.predicted_occ) || 0);
  const avg = vals.reduce((s, v) => s + v, 0) / vals.length;
  let peak = 0;
  vals.forEach((v, i) => {
    if (v > vals[peak]) peak = i;
  });
  const below = vals.filter((v) => v < 50).length;
  return { avg, peakValue: vals[peak], peakDate: points[peak].stay_date, below, vals };
}

export function ForecastSummary({ points }: { points: ForecastPoint[] }) {
  const s = summarize(points);
  if (!s) return null;
  const weekly = s.vals.filter((_, i) => i % 7 === 0);
  return (
    <div className="kpi-grid">
      <StatCard
        label="Средняя загрузка (60 дней)"
        value={`${s.avg.toFixed(1)}%`}
        subvalue="Цель: 80%"
        color={s.avg >= 70 ? 'c-teal' : 'c-amber'}
        icon={<Icon name="trendUp" size={20} />}
        trend={weekly.length > 1 ? weekly : undefined}
      />
      <StatCard label="Пик спроса" value={`${s.peakValue.toFixed(1)}%`} subvalue={`Дата заезда ${s.peakDate}`} color="c-blue" icon={<Icon name="calendar" size={20} />} />
      <StatCard
        label="Дней с загрузкой < 50%"
        value={s.below}
        subvalue="Кандидаты для акций и пакетов"
        color={s.below > 0 ? 'c-red' : 'c-teal'}
        icon={<Icon name="trendDown" size={20} />}
      />
    </div>
  );
}

export default function ForecastTab({ state, loading }: { state: ForecastState; loading: boolean }) {
  const active = state.categories.find((c) => String(c.id) === state.categoryId);
  const r = state.result;
  return (
    <div className="u-stack-16">
      <Card title="Прогнозирование спроса на категории номеров" subtitle="Модель прогнозирует загрузку на следующие 60 дней по истории спроса">
        <ForecastControls state={state} />
        {r && (
          <ul className="mgr-run-meta" aria-label="Параметры последнего прогона">
            <li>Прогон № {r.run_id}</li>
            <li>Точек: {r.points}</li>
            <li>
              Средняя ошибка MAPE: <strong>{r.mape != null && !isNaN(Number(r.mape)) ? `${Number(r.mape).toFixed(1)}%` : 'н/д'}</strong>
            </li>
          </ul>
        )}
      </Card>

      {loading ? (
        <Card>
          <Skeleton height={280} />
        </Card>
      ) : (
        <>
          <ForecastSummary points={state.forecast} />
          <Card title={`Прогноз загрузки${active ? `: ${active.name}` : ''}`} subtitle="Наведите курсор или используйте стрелки, чтобы увидеть значение на дату">
            <ForecastChart points={state.forecast} />
          </Card>
        </>
      )}
    </div>
  );
}
