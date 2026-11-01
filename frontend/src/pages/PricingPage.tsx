import { useEffect, useState } from 'react';
import { directory, pricing } from '../api/endpoints';
import { ErrorBox, Field, TableWrap, today } from '../components/ui';
import type { ForecastPoint, HistoryPoint, RoomCategory } from '../types';

interface ChartPoint { date: string; value: number }

/** Линейный график по дням: сетка, подписи осей по-русски, пригоден для печати. */
function ValueChart({ points, title, max, dashed = false }: {
  points: ChartPoint[];
  title: string;
  max?: number;
  dashed?: boolean;
}) {
  if (points.length < 2) return null;
  const w = 680;
  const h = 220;
  const pad = 44;
  const top = max ?? Math.max(...points.map((p) => p.value), 1);
  const x = (i: number) => pad + (i * (w - 2 * pad)) / (points.length - 1);
  const y = (v: number) => h - pad - (Math.max(0, Math.min(top, v)) * (h - 2 * pad)) / top;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} role="img" aria-label={title} className="chart">
      {[0, 0.25, 0.5, 0.75, 1].map((f) => {
        const t = Math.round(top * f);
        return (
          <g key={t}>
            <line x1={pad} y1={y(t)} x2={w - pad} y2={y(t)} stroke="#dbe3e0" />
            <text x={pad - 6} y={y(t) + 4} fontSize="11" textAnchor="end" fill="#5f6f6a">{t}</text>
          </g>
        );
      })}
      <polyline points={points.map((p, i) => `${x(i)},${y(p.value)}`).join(' ')} fill="none"
        stroke="#1f6f5c" strokeWidth="2" strokeLinejoin="round" strokeDasharray={dashed ? '6 4' : undefined} />
      <text x={pad} y={h - 10} fontSize="11" fill="#5f6f6a">{points[0].date}</text>
      <text x={w - pad} y={h - 10} fontSize="11" textAnchor="end" fill="#5f6f6a">{points[points.length - 1].date}</text>
      <text x={w / 2} y={14} fontSize="12" textAnchor="middle" fill="#1c2724">{title}</text>
    </svg>
  );
}

/** Разбор CSV истории спроса: строки «ГГГГ-ММ-ДД;продано;доступно». */
function parseHistoryCsv(text: string): HistoryPoint[] {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const points: HistoryPoint[] = [];
  for (const [i, line] of lines.entries()) {
    const parts = line.split(';').map((s) => s.trim());
    if (parts.length < 3) {
      throw new Error(`Строка ${i + 1}: ожидается формат «ГГГГ-ММ-ДД;продано;доступно»`);
    }
    const [date, soldRaw, availableRaw] = parts;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      throw new Error(`Строка ${i + 1}: дата должна быть в формате ГГГГ-ММ-ДД`);
    }
    if (!/^\d+$/.test(soldRaw) || !/^\d+$/.test(availableRaw)) {
      throw new Error(`Строка ${i + 1}: продано и доступно — целые числа`);
    }
    const sold = Number(soldRaw);
    const available = Number(availableRaw);
    if (available === 0) {
      throw new Error(`Строка ${i + 1}: доступно мест должно быть больше нуля`);
    }
    if (sold > available) {
      throw new Error(`Строка ${i + 1}: продано не может быть больше доступного`);
    }
    points.push({ stay_date: date, sold, available });
  }
  return points;
}

/** Рабочее место тарификации (ФТ-15, ФТ-16): сезоны, тарифы, коридоры, история спроса, прогноз. */
export default function PricingPage() {
  const [categories, setCategories] = useState<RoomCategory[]>([]);
  const [error, setError] = useState<unknown>(null);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  const [season, setSeason] = useState({ name: '', from: today(30), to: today(150), k: '1.00' });
  const [tariff, setTariff] = useState({ seasonId: '', categoryId: '', priceBase: '' });
  const [corridor, setCorridor] = useState({ categoryId: '', from: today(), to: today(90), pMin: '', pMax: '', minLos: '1', closed: false });
  const [history, setHistory] = useState({ categoryId: '', csv: '' });
  const [historyPoints, setHistoryPoints] = useState<HistoryPoint[]>([]);
  const [forecastCatId, setForecastCatId] = useState('');
  const [forecast, setForecast] = useState<ForecastPoint[]>([]);

  useEffect(() => {
    directory.categories().then(setCategories).catch(setError);
  }, []);

  // после загрузки категорий подставляем первую категорию в ещё не выбранные селекты
  useEffect(() => {
    if (categories.length === 0) return;
    const first = String(categories[0].id);
    const ids = categories.map((c) => String(c.id));
    setTariff((s) => (ids.includes(s.categoryId) ? s : { ...s, categoryId: first }));
    setCorridor((s) => (ids.includes(s.categoryId) ? s : { ...s, categoryId: first }));
    setHistory((s) => ({ ...s, categoryId: ids.includes(s.categoryId) ? s.categoryId : first }));
    setForecastCatId((s) => (ids.includes(s) ? s : first));
  }, [categories]);

  async function saveSeason() {
    setError(null);
    setMessage('');
    setBusy(true);
    try {
      const r = await pricing.seasons({
        name: season.name, date_from: season.from, date_to: season.to, k_season: Number(season.k),
      });
      setMessage(`Сезон сохранён (id = ${r.id} — используйте его в разделе «Тарифы»)`);
      setTariff((s) => ({ ...s, seasonId: String(r.id) }));
      setSeason({ name: '', from: today(30), to: today(150), k: '1.00' });
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  }

  async function saveTariff() {
    setError(null);
    setMessage('');
    setBusy(true);
    try {
      const r = await pricing.tariffs({
        season_id: Number(tariff.seasonId), category_id: Number(tariff.categoryId), price_base: Number(tariff.priceBase),
      });
      setMessage(`Тариф сохранён (id = ${r.id})`);
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  }

  async function saveCorridor() {
    setError(null);
    setMessage('');
    const pMin = Number(corridor.pMin);
    const pMax = Number(corridor.pMax);
    if (pMin > pMax) {
      setError(new Error('Минимальная цена не может быть больше максимальной'));
      return;
    }
    setBusy(true);
    try {
      await pricing.createCorridor({
        category_id: Number(corridor.categoryId), date_from: corridor.from, date_to: corridor.to,
        p_min: pMin, p_max: pMax, min_los: Number(corridor.minLos), closed: corridor.closed,
      });
      setMessage('Коридор цен сохранён');
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  }

  async function importCsv() {
    setError(null);
    setMessage('');
    setBusy(true);
    try {
      const points = parseHistoryCsv(history.csv);
      if (points.length > 1000) {
        throw new Error('За один запрос можно загрузить не более 1000 точек');
      }
      const r = await pricing.importHistory(Number(history.categoryId), points);
      setMessage(`История загружена: записано точек — ${r.upserted}`);
      setHistoryPoints(await pricing.history(Number(history.categoryId), today(-365), today()));
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  }

  async function showHistory() {
    setError(null);
    setMessage('');
    try {
      setHistoryPoints(await pricing.history(Number(history.categoryId), today(-365), today()));
    } catch (err) {
      setError(err);
    }
  }

  async function runForecast() {
    setError(null);
    setMessage('');
    try {
      const r = await pricing.runForecast(Number(forecastCatId));
      setMessage(`Прогноз построен (прогон № ${r.run_id}, точек: ${r.points}, MAPE: ${r.mape ?? 'н/д'} %)`);
      setForecast(await pricing.forecast(Number(forecastCatId), today(), today(60)));
    } catch (err) {
      setError(err);
    }
  }

  async function showForecast() {
    setError(null);
    setMessage('');
    try {
      setForecast(await pricing.forecast(Number(forecastCatId), today(), today(60)));
    } catch (err) {
      setError(err);
    }
  }

  const lastHistory = historyPoints.slice(-30).reverse();

  return (
    <section>
      <h1>Тарифы и сезоны</h1>
      <p className="note">Сезоны и тарифы только создаются; списков нет — идентификатор смотрите в сообщении после сохранения.</p>
      <ErrorBox error={error} />
      {message && <p className="ok">{message}</p>}

      <h2>Сезоны</h2>
      <form className="card inline" onSubmit={(e) => { e.preventDefault(); void saveSeason(); }}>
        <Field label="Название сезона"><input value={season.name} required maxLength={100} disabled={busy}
          onChange={(e) => setSeason({ ...season, name: e.target.value })} /></Field>
        <Field label="Дата с"><input type="date" value={season.from} required disabled={busy}
          onChange={(e) => setSeason({ ...season, from: e.target.value })} /></Field>
        <Field label="Дата по"><input type="date" value={season.to} required disabled={busy}
          onChange={(e) => setSeason({ ...season, to: e.target.value })} /></Field>
        <Field label="Коэффициент сезона"><input type="number" min={0} step="0.01" value={season.k} required disabled={busy}
          onChange={(e) => setSeason({ ...season, k: e.target.value })} /></Field>
        <button type="submit" className="primary" disabled={busy}>Сохранить сезон</button>
      </form>

      <h2>Тарифы</h2>
      <p className="note">Идентификатор сезона вводится числом — см. ответ после создания сезона (поле заполняется автоматически).</p>
      <form className="card inline" onSubmit={(e) => { e.preventDefault(); void saveTariff(); }}>
        <Field label="Сезон (id)">
          <input type="number" min={1} value={tariff.seasonId} required disabled={busy}
            onChange={(e) => setTariff({ ...tariff, seasonId: e.target.value })} />
        </Field>
        <Field label="Категория номера">
          <select value={tariff.categoryId} disabled={busy || !tariff.categoryId}
            onChange={(e) => setTariff({ ...tariff, categoryId: e.target.value })}>
            {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </Field>
        <Field label="Базовая цена, сутки за место"><input type="number" min={0} step="0.01" value={tariff.priceBase} required disabled={busy}
          onChange={(e) => setTariff({ ...tariff, priceBase: e.target.value })} /></Field>
        <button type="submit" className="primary" disabled={busy || !tariff.categoryId}>Сохранить тариф</button>
      </form>

      <h2>Коридор цен</h2>
      <p className="note">Интервалы одной категории не должны пересекаться.</p>
      <form className="card inline" onSubmit={(e) => { e.preventDefault(); void saveCorridor(); }}>
        <Field label="Категория">
          <select value={corridor.categoryId} disabled={busy} onChange={(e) => setCorridor({ ...corridor, categoryId: e.target.value })}>
            {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </Field>
        <Field label="С"><input type="date" value={corridor.from} required disabled={busy} onChange={(e) => setCorridor({ ...corridor, from: e.target.value })} /></Field>
        <Field label="По"><input type="date" value={corridor.to} required disabled={busy} onChange={(e) => setCorridor({ ...corridor, to: e.target.value })} /></Field>
        <Field label="Мин. цена"><input type="number" min={0} step="0.01" value={corridor.pMin} required disabled={busy} onChange={(e) => setCorridor({ ...corridor, pMin: e.target.value })} /></Field>
        <Field label="Макс. цена"><input type="number" min={0} step="0.01" value={corridor.pMax} required disabled={busy} onChange={(e) => setCorridor({ ...corridor, pMax: e.target.value })} /></Field>
        <Field label="Мин. срок, суток"><input type="number" min={1} value={corridor.minLos} required disabled={busy} onChange={(e) => setCorridor({ ...corridor, minLos: e.target.value })} /></Field>
        <label className="check">
          <input type="checkbox" checked={corridor.closed} disabled={busy} onChange={(e) => setCorridor({ ...corridor, closed: e.target.checked })} /> Продажи закрыты
        </label>
        <button type="submit" className="primary" disabled={busy || !corridor.categoryId}>Сохранить коридор</button>
      </form>

      <h2>История спроса</h2>
      <p className="note">
        Импорт CSV: по строке на дату заезда в формате «ГГГГ-ММ-ДД;продано;доступно», не более 1000 точек за раз.
        Повторная загрузка тех же дат обновляет их значения.
      </p>
      <form className="card" onSubmit={(e) => { e.preventDefault(); void importCsv(); }}>
        <div className="grid">
          <Field label="Категория">
            <select value={history.categoryId} disabled={busy} onChange={(e) => setHistory({ ...history, categoryId: e.target.value })}>
              {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </Field>
        </div>
        <Field label="Данные (по одной точке в строке)">
          <textarea rows={6} className="narrow" value={history.csv} placeholder={'2026-01-10;12;20\n2026-01-11;15;15'} disabled={busy}
            onChange={(e) => setHistory({ ...history, csv: e.target.value })} />
        </Field>
        <div className="actions">
          <button type="submit" className="primary" disabled={busy || !history.categoryId || !history.csv.trim()}>Загрузить историю</button>
          <button type="button" disabled={!history.categoryId} onClick={() => void showHistory()}>Показать историю</button>
        </div>
      </form>
      {historyPoints.length > 0 && (
        <>
          <ValueChart points={historyPoints.map((p) => ({ date: p.stay_date, value: p.sold }))}
            title="Продано мест по датам заезда" />
          <TableWrap><table>
            <caption>Таблица. История спроса за год (последние {lastHistory.length} точек)</caption>
            <thead><tr><th>Дата заезда</th><th>Продано мест</th><th>Доступно мест</th></tr></thead>
            <tbody>
              {lastHistory.map((p) => (
                <tr key={p.stay_date}><td>{p.stay_date}</td><td>{p.sold}</td><td>{p.available}</td></tr>
              ))}
            </tbody>
          </table></TableWrap>
        </>
      )}

      <h2>Прогноз</h2>
      <div className="card inline">
        <Field label="Категория">
          <select value={forecastCatId} onChange={(e) => setForecastCatId(e.target.value)}>
            {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </Field>
        <button type="button" className="primary" disabled={!forecastCatId} onClick={() => void runForecast()}>Построить прогноз</button>
        <button type="button" disabled={!forecastCatId} onClick={() => void showForecast()}>Показать последний</button>
      </div>
      <ValueChart points={forecast.map((p) => ({ date: p.stay_date, value: p.predicted_occ }))}
        title="Прогноз загрузки, %" max={100} dashed />
    </section>
  );
}
