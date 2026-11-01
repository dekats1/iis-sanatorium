import { useEffect, useState } from 'react';
import { directory, pricing } from '../api/endpoints';
import { Button, Card, EmptyState, ErrorBox, Field, Notice, today, useToast } from '../components/ui';
import { DataTable, type Column } from '../components/DataTable';
import { Icon } from '../components/icons';
import DemandChart from '../components/pricing/DemandChart';
import type { ForecastPoint, HistoryPoint, RoomCategory } from '../types';

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

/** Сезон из справочника pricing-forecast (или созданный в этой сессии, если сервер старый). */
interface SessionSeason { id: number; name: string; from: string; to: string; k: number }

const SEASONS_KEY = 'iis.pricing.sessionSeasons';

const fmtDate = (d: string) => d.split('-').reverse().join('.');

function loadSessionSeasons(): SessionSeason[] {
  try {
    const raw = sessionStorage.getItem(SEASONS_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? (parsed as SessionSeason[]).filter((s) => typeof s?.id === 'number') : [];
  } catch {
    return [];
  }
}

function storeSessionSeasons(list: SessionSeason[]) {
  try {
    sessionStorage.setItem(SEASONS_KEY, JSON.stringify(list));
  } catch {
    /* хранилище недоступно — список живёт только в памяти */
  }
}

type Section = 'page' | 'season' | 'tariff' | 'corridor' | 'history' | 'forecast';

const HISTORY_COLUMNS: Column<HistoryPoint>[] = [
  { key: 'date', header: 'Дата заезда', render: (p) => p.stay_date, sortValue: (p) => p.stay_date },
  { key: 'sold', header: 'Продано мест', align: 'right', render: (p) => p.sold, sortValue: (p) => p.sold },
  { key: 'available', header: 'Доступно мест', align: 'right', render: (p) => p.available, sortValue: (p) => p.available },
  {
    key: 'occ',
    header: 'Загрузка, %',
    align: 'right',
    render: (p) => (p.available ? Math.round((p.sold / p.available) * 100) : 0),
    sortValue: (p) => (p.available ? p.sold / p.available : 0),
  },
];

/** Рабочее место тарификации (ФТ-15, ФТ-16): сезоны, тарифы, коридоры, история спроса, прогноз. */
export default function PricingPage() {
  const toast = useToast();
  const [categories, setCategories] = useState<RoomCategory[]>([]);
  const [catsLoading, setCatsLoading] = useState(true);
  const [failure, setFailure] = useState<{ at: Section; error: unknown } | null>(null);
  const [busy, setBusy] = useState(false);
  const [forecastMessage, setForecastMessage] = useState('');
  const [forecastBusy, setForecastBusy] = useState(false);

  const [season, setSeason] = useState({ name: '', from: today(30), to: today(150), k: '1.00' });
  const [sessionSeasons, setSessionSeasons] = useState<SessionSeason[]>(loadSessionSeasons);
  const [manualSeason, setManualSeason] = useState(false);
  const [tariff, setTariff] = useState({ seasonId: '', categoryId: '', priceBase: '' });
  const [corridor, setCorridor] = useState({ categoryId: '', from: today(), to: today(90), pMin: '', pMax: '', minLos: '1', closed: false });
  const [history, setHistory] = useState({ categoryId: '', csv: '' });
  const [historyPoints, setHistoryPoints] = useState<HistoryPoint[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [forecastCatId, setForecastCatId] = useState('');
  const [forecast, setForecast] = useState<ForecastPoint[]>([]);

  const errorAt = (at: Section) => (failure?.at === at ? failure.error : null);

  useEffect(() => {
    directory.categories().then(setCategories).catch((error) => setFailure({ at: 'page', error })).finally(() => setCatsLoading(false));
    // все сезоны с сервера: новые сверху, чтобы по умолчанию в тарифе был последний
    pricing.listSeasons()
      .then((list) => setSessionSeasons(
        list.map((s) => ({ id: s.id, name: s.name, from: s.date_from, to: s.date_to, k: Number(s.k_season) }))
          .sort((a, b) => (a.from < b.from ? 1 : -1)),
      ))
      .catch(() => undefined); // старый бэкенд без GET — остаются сезоны этой сессии
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

  // тарифы всех сезонов для сводной таблицы
  const [tariffList, setTariffList] = useState<{ season_id: number; category_id: number; price_base: number }[]>([]);
  const reloadTariffs = () => { pricing.listTariffs().then(setTariffList).catch(() => undefined); };
  useEffect(reloadTariffs, []);

  // сезон по умолчанию в тарифе — ближайший по дате
  useEffect(() => {
    if (sessionSeasons.length > 0) {
      setTariff((s) => (s.seasonId ? s : { ...s, seasonId: String(sessionSeasons[0].id) }));
    }
  }, [sessionSeasons]);

  const seasonSelect = sessionSeasons.length > 0 && !manualSeason;

  async function saveSeason() {
    setFailure(null);
    setBusy(true);
    try {
      const r = await pricing.seasons({
        name: season.name, date_from: season.from, date_to: season.to, k_season: Number(season.k),
      });
      toast.success(`Сезон «${season.name}» сохранён`);
      reloadTariffs();
      const created: SessionSeason = { id: r.id, name: season.name, from: season.from, to: season.to, k: Number(season.k) };
      setSessionSeasons((list) => {
        const next = [created, ...list.filter((s) => s.id !== r.id)];
        storeSessionSeasons(next);
        return next;
      });
      setManualSeason(false);
      setTariff((s) => ({ ...s, seasonId: String(r.id) }));
      setSeason({ name: '', from: today(30), to: today(150), k: '1.00' });
    } catch (err) {
      setFailure({ at: 'season', error: err });
    } finally {
      setBusy(false);
    }
  }

  async function saveTariff() {
    setFailure(null);
    setBusy(true);
    try {
      const r = await pricing.tariffs({
        season_id: Number(tariff.seasonId), category_id: Number(tariff.categoryId), price_base: Number(tariff.priceBase),
      });
      toast.success(`Тариф сохранён (id = ${r.id})`);
      reloadTariffs();
    } catch (err) {
      setFailure({ at: 'tariff', error: err });
    } finally {
      setBusy(false);
    }
  }

  async function saveCorridor() {
    setFailure(null);
    const pMin = Number(corridor.pMin);
    const pMax = Number(corridor.pMax);
    if (pMin > pMax) {
      setFailure({ at: 'corridor', error: new Error('Минимальная цена не может быть больше максимальной') });
      return;
    }
    setBusy(true);
    try {
      await pricing.createCorridor({
        category_id: Number(corridor.categoryId), date_from: corridor.from, date_to: corridor.to,
        p_min: pMin, p_max: pMax, min_los: Number(corridor.minLos), closed: corridor.closed,
      });
      toast.success('Коридор цен сохранён');
    } catch (err) {
      setFailure({ at: 'corridor', error: err });
    } finally {
      setBusy(false);
    }
  }

  async function importCsv() {
    setFailure(null);
    setBusy(true);
    try {
      const points = parseHistoryCsv(history.csv);
      if (points.length > 1000) {
        throw new Error('За один запрос можно загрузить не более 1000 точек');
      }
      const r = await pricing.importHistory(Number(history.categoryId), points);
      toast.success(`История загружена: записано точек — ${r.upserted}`);
      setHistoryPoints(await pricing.history(Number(history.categoryId), today(-365), today()));
    } catch (err) {
      setFailure({ at: 'history', error: err });
    } finally {
      setBusy(false);
    }
  }

  async function showHistory() {
    setFailure(null);
    setHistoryLoading(true);
    try {
      setHistoryPoints(await pricing.history(Number(history.categoryId), today(-365), today()));
    } catch (err) {
      setFailure({ at: 'history', error: err });
    } finally {
      setHistoryLoading(false);
    }
  }

  async function runForecast() {
    setFailure(null);
    setForecastMessage('');
    setForecastBusy(true);
    try {
      const r = await pricing.runForecast(Number(forecastCatId));
      setForecastMessage(`Прогноз построен (прогон № ${r.run_id}, точек: ${r.points}, MAPE: ${r.mape ?? 'н/д'} %)`);
      setForecast(await pricing.forecast(Number(forecastCatId), today(), today(60)));
    } catch (err) {
      setFailure({ at: 'forecast', error: err });
    } finally {
      setForecastBusy(false);
    }
  }

  async function showForecast() {
    setFailure(null);
    setForecastMessage('');
    setForecastBusy(true);
    try {
      setForecast(await pricing.forecast(Number(forecastCatId), today(), today(60)));
    } catch (err) {
      setFailure({ at: 'forecast', error: err });
    } finally {
      setForecastBusy(false);
    }
  }

  const categoryOptions = categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>);
  const noCategories = !catsLoading && categories.length === 0;
  const hasChart = historyPoints.length >= 2 || forecast.length >= 2;

  return (
    <section>
      <div className="page-head">
        <div>
          <h1>Тарифы и сезоны</h1>
          <p className="page-subtitle">Сезонные коэффициенты, базовые тарифы по категориям номеров, коридоры цен и прогноз спроса.</p>
        </div>
      </div>
      <ErrorBox error={errorAt('page')} />
      {noCategories && (
        <Notice tone="warning">Категории номеров не загружены — тарифы, коридоры и прогноз недоступны. Добавьте категории в разделе «Справочники».</Notice>
      )}

      <div className="pricing-grid">
        <Card title="Сезоны" subtitle="Период действия и коэффициент к базовой цене">
          <ErrorBox error={errorAt('season')} />
          <form onSubmit={(e) => { e.preventDefault(); void saveSeason(); }}>
            <Field label="Название сезона" hint="Например: «Лето 2027» или «Новогодние каникулы»">
              <input value={season.name} required maxLength={100} disabled={busy}
                onChange={(e) => setSeason({ ...season, name: e.target.value })} />
            </Field>
            <div className="form-grid">
              <Field label="Дата с"><input type="date" value={season.from} required disabled={busy}
                onChange={(e) => setSeason({ ...season, from: e.target.value })} /></Field>
              <Field label="Дата по"><input type="date" value={season.to} required min={season.from} disabled={busy}
                onChange={(e) => setSeason({ ...season, to: e.target.value })} /></Field>
            </div>
            <Field label="Коэффициент сезона" hint="1.00 — без изменений, 1.20 — цена выше на 20 %">
              <input type="number" min={0} step="0.01" value={season.k} required disabled={busy}
                onChange={(e) => setSeason({ ...season, k: e.target.value })} />
            </Field>
            <div className="row row-end">
              <Button type="submit" variant="primary" loading={busy} icon={<Icon name="calendar" size={18} />}>Сохранить сезон</Button>
            </div>
          </form>
        </Card>

        <Card title="Тарифы" subtitle="Базовая цена категории номера в выбранном сезоне">
          <ErrorBox error={errorAt('tariff')} />
          <form onSubmit={(e) => { e.preventDefault(); void saveTariff(); }}>
            {seasonSelect ? (
              <Field label="Сезон" hint="Все сезоны справочника">
                <select value={tariff.seasonId} required disabled={busy}
                  onChange={(e) => {
                    if (e.target.value === '__manual') {
                      setManualSeason(true);
                      setTariff({ ...tariff, seasonId: '' });
                    } else {
                      setTariff({ ...tariff, seasonId: e.target.value });
                    }
                  }}>
                  {sessionSeasons.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} · {s.from} – {s.to} · k {s.k} (id {s.id})
                    </option>
                  ))}
                  <option value="__manual">Другой сезон — ввести id вручную</option>
                </select>
              </Field>
            ) : (
              <Field label="Сезон (id)" hint="Идентификатор сезона вводится числом — см. ответ после создания сезона (поле заполняется автоматически).">
                <input type="number" min={1} value={tariff.seasonId} required disabled={busy}
                  onChange={(e) => setTariff({ ...tariff, seasonId: e.target.value })} />
              </Field>
            )}
            {manualSeason && sessionSeasons.length > 0 && (
              <Button type="button" variant="link" size="sm" className="u-mb-16" onClick={() => { setManualSeason(false); setTariff({ ...tariff, seasonId: String(sessionSeasons[0].id) }); }}>
                Выбрать из созданных сезонов
              </Button>
            )}
            <div className="form-grid">
              <Field label="Категория номера">
                <select value={tariff.categoryId} disabled={busy || !tariff.categoryId}
                  onChange={(e) => setTariff({ ...tariff, categoryId: e.target.value })}>
                  {categoryOptions}
                </select>
              </Field>
              <Field label="Базовая цена, сутки за место" hint="В BYN, до коэффициента сезона">
                <input type="number" min={0} step="0.01" value={tariff.priceBase} required disabled={busy}
                  onChange={(e) => setTariff({ ...tariff, priceBase: e.target.value })} />
              </Field>
            </div>
            <div className="row row-end">
              <Button type="submit" variant="primary" loading={busy} disabled={!tariff.categoryId} icon={<Icon name="tag" size={18} />}>Сохранить тариф</Button>
            </div>
          </form>
        </Card>
      </div>

      <Card title="Действующие сезоны и тарифы" subtitle="Базовая цена за сутки за место, BYN (до применения коэффициента сезона)">
        <DataTable
          rows={sessionSeasons}
          rowKey={(s) => s.id}
          caption="Таблица. Сезоны и базовые тарифы по категориям"
          searchText={(s) => s.name}
          searchPlaceholder="Поиск сезона"
          pageSize={10}
          initialSort={{ key: 'from', dir: 'asc' }}
          emptyTitle="Сезонов пока нет"
          dense
          columns={[
            { key: 'name', header: 'Сезон', render: (s) => s.name, sortValue: (s) => s.name },
            { key: 'from', header: 'Период', render: (s) => `${fmtDate(s.from)} – ${fmtDate(s.to)}`, sortValue: (s) => s.from },
            { key: 'k', header: 'Коэф.', align: 'right', className: 'num', render: (s) => s.k.toFixed(2), sortValue: (s) => s.k },
            ...categories.map((c): Column<SessionSeason> => ({
              key: `c${c.id}`, header: c.name, align: 'right', className: 'num',
              render: (s) => {
                const t = tariffList.find((x) => x.season_id === s.id && x.category_id === c.id);
                return t ? Number(t.price_base).toFixed(2) : '—';
              },
              sortValue: (s) => tariffList.find((x) => x.season_id === s.id && x.category_id === c.id)?.price_base ?? null,
            })),
          ]}
        />
      </Card>

      <Card title="Коридор цен" subtitle="Интервалы одной категории не должны пересекаться.">
        <ErrorBox error={errorAt('corridor')} />
        <form onSubmit={(e) => { e.preventDefault(); void saveCorridor(); }}>
          <div className="form-grid">
            <Field label="Категория">
              <select value={corridor.categoryId} disabled={busy} onChange={(e) => setCorridor({ ...corridor, categoryId: e.target.value })}>
                {categoryOptions}
              </select>
            </Field>
            <Field label="С"><input type="date" value={corridor.from} required disabled={busy} onChange={(e) => setCorridor({ ...corridor, from: e.target.value })} /></Field>
            <Field label="По"><input type="date" value={corridor.to} required min={corridor.from} disabled={busy} onChange={(e) => setCorridor({ ...corridor, to: e.target.value })} /></Field>
            <Field label="Мин. цена" hint="Нижняя граница, BYN"><input type="number" min={0} step="0.01" value={corridor.pMin} required disabled={busy} onChange={(e) => setCorridor({ ...corridor, pMin: e.target.value })} /></Field>
            <Field label="Макс. цена" hint="Верхняя граница, BYN"><input type="number" min={0} step="0.01" value={corridor.pMax} required disabled={busy} onChange={(e) => setCorridor({ ...corridor, pMax: e.target.value })} /></Field>
            <Field label="Мин. срок, суток" hint="Минимальная длительность проживания"><input type="number" min={1} value={corridor.minLos} required disabled={busy} onChange={(e) => setCorridor({ ...corridor, minLos: e.target.value })} /></Field>
          </div>
          <div className="row u-between u-flex-wrap">
            <label className="check">
              <input type="checkbox" checked={corridor.closed} disabled={busy} onChange={(e) => setCorridor({ ...corridor, closed: e.target.checked })} /> Продажи закрыты
            </label>
            <Button type="submit" variant="primary" loading={busy} disabled={!corridor.categoryId} icon={<Icon name="shield" size={18} />}>Сохранить коридор</Button>
          </div>
        </form>
      </Card>

      <Card title="История спроса" subtitle="Импорт CSV: по строке на дату заезда в формате «ГГГГ-ММ-ДД;продано;доступно», не более 1000 точек за раз. Повторная загрузка тех же дат обновляет их значения.">
        <ErrorBox error={errorAt('history')} />
        <form onSubmit={(e) => { e.preventDefault(); void importCsv(); }}>
          <div className="form-grid">
            <Field label="Категория">
              <select value={history.categoryId} disabled={busy} onChange={(e) => setHistory({ ...history, categoryId: e.target.value })}>
                {categoryOptions}
              </select>
            </Field>
          </div>
          <Field label="Данные (по одной точке в строке)" hint="Разделитель — точка с запятой; продано не больше доступного">
            <textarea rows={6} className="pricing-csv" value={history.csv} placeholder={'2026-01-10;12;20\n2026-01-11;15;15'} disabled={busy}
              spellCheck={false}
              onChange={(e) => setHistory({ ...history, csv: e.target.value })} />
          </Field>
          <div className="row row-end u-flex-wrap">
            <Button type="button" variant="outline" loading={historyLoading} disabled={!history.categoryId} icon={<Icon name="eye" size={18} />} onClick={() => void showHistory()}>Показать историю</Button>
            <Button type="submit" variant="primary" loading={busy} disabled={!history.categoryId || !history.csv.trim()} icon={<Icon name="download" size={18} />}>Загрузить историю</Button>
          </div>
        </form>
        {historyPoints.length > 0 && (
          <div className="u-mt-20">
            <DataTable
              rows={historyPoints}
              columns={HISTORY_COLUMNS}
              rowKey={(p) => p.stay_date}
              caption={`Таблица. История спроса за год (${historyPoints.length} точек)`}
              initialSort={{ key: 'date', dir: 'desc' }}
              dense
            />
          </div>
        )}
      </Card>

      <Card title="Прогноз" subtitle="Прогноз загрузки на 60 дней строится по истории спроса выбранной категории">
        <ErrorBox error={errorAt('forecast')} />
        {forecastMessage && <Notice tone="success">{forecastMessage}</Notice>}
        <div className="inline">
          <Field label="Категория">
            <select value={forecastCatId} onChange={(e) => setForecastCatId(e.target.value)}>
              {categoryOptions}
            </select>
          </Field>
          <div className="u-flex-wrap">
            <Button type="button" variant="primary" loading={forecastBusy} disabled={!forecastCatId} icon={<Icon name="sparkles" size={18} />} onClick={() => void runForecast()}>Построить прогноз</Button>
            <Button type="button" variant="outline" disabled={!forecastCatId || forecastBusy} onClick={() => void showForecast()}>Показать последний</Button>
          </div>
        </div>

        <div className="u-mt-24">
          <h4>История и прогноз загрузки, %</h4>
          {hasChart ? (
            <DemandChart history={historyPoints} forecast={forecast} />
          ) : (
            <EmptyState
              title="График пока пуст"
              description="Загрузите или покажите историю спроса и постройте прогноз — линии появятся здесь."
              icon={<Icon name="chart" size={40} />}
            />
          )}
        </div>
      </Card>
    </section>
  );
}
