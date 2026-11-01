import { useCallback, useEffect, useState } from 'react';
import { bi, directory, inventory, packages, pricing, reports, reviews as guestReviewsApi, staff } from '../api/endpoints';
import { Button, ErrorBox, Tabs, today, useToast } from '../components/ui';
import { Icon, type IconName } from '../components/icons';
import type {
  BiMonthlyPoint,
  ChannelRevenue,
  ConsumableItem,
  ForecastPoint,
  ForecastRunResult,
  GuestReview,
  KpiView,
  PriceReview,
  ProfilePopularity,
  ReviewQualityStats,
  RoomCategory,
  SanatoriumPackage,
  StaffMember,
} from '../types';
import KpiTab from '../components/manager/KpiTab';
import BiTab from '../components/manager/BiTab';
import PackagesTab from '../components/manager/PackagesTab';
import InventoryTab from '../components/manager/InventoryTab';
import StaffTab from '../components/manager/StaffTab';
import QualityTab from '../components/manager/QualityTab';
import ForecastTab, { type ForecastState } from '../components/manager/ForecastTab';
import RulesTab, { type ReviewDecision } from '../components/manager/RulesTab';

type ManagerTab = 'kpi' | 'bi' | 'packages' | 'inventory' | 'staff' | 'quality' | 'forecast' | 'rules';

/** Запрос с запасным значением: сбой одного раздела не ломает всю панель. */
async function soft<T>(p: Promise<T>, fallback: T, onError: (e: unknown) => void): Promise<T> {
  try {
    return await p;
  } catch (e) {
    onError(e);
    return fallback;
  }
}

export default function ManagerDashboardPage() {
  const toast = useToast();
  const [activeTab, setActiveTab] = useState<ManagerTab>('kpi');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<unknown>(null);

  // KPI
  const [from, setFrom] = useState(today(-30));
  const [to, setTo] = useState(today());
  const [kpi, setKpi] = useState<KpiView | null>(null);
  const [kpiLoading, setKpiLoading] = useState(false);
  const [kpiError, setKpiError] = useState<unknown>(null);
  const [channels, setChannels] = useState<ChannelRevenue[]>([]);

  // BI
  const [biMonthly, setBiMonthly] = useState<BiMonthlyPoint[]>([]);
  const [biProfiles, setBiProfiles] = useState<ProfilePopularity[]>([]);

  // Операционные разделы
  const [packageList, setPackageList] = useState<SanatoriumPackage[]>([]);
  const [consumables, setConsumables] = useState<ConsumableItem[]>([]);
  const [staffList, setStaffList] = useState<StaffMember[]>([]);
  const [qualityStats, setQualityStats] = useState<ReviewQualityStats | null>(null);
  const [guestReviews, setGuestReviews] = useState<GuestReview[]>([]);

  // Прогноз
  const [categories, setCategories] = useState<RoomCategory[]>([]);
  const [categoryId, setCategoryId] = useState('');
  const [forecast, setForecast] = useState<ForecastPoint[]>([]);
  const [forecastResult, setForecastResult] = useState<ForecastRunResult | null>(null);
  const [forecastLoading, setForecastLoading] = useState(false);
  const [forecastNotice, setForecastNotice] = useState('');
  const [forecastError, setForecastError] = useState<unknown>(null);

  // Рекомендации цены
  const [reviews, setReviews] = useState<PriceReview[]>([]);
  const [reviewFilter, setReviewFilter] = useState<'PENDING_REVIEW' | 'ALL'>('PENDING_REVIEW');
  const [reviewsLoading, setReviewsLoading] = useState(true);
  const [reviewsError, setReviewsError] = useState<unknown>(null);
  const [decidingId, setDecidingId] = useState<number | null>(null);

  const loadReviews = useCallback(async () => {
    setReviewsError(null);
    try {
      setReviews(await pricing.reviews(reviewFilter === 'ALL' ? undefined : 'PENDING_REVIEW'));
    } catch (err) {
      setReviewsError(err);
    } finally {
      setReviewsLoading(false);
    }
  }, [reviewFilter]);

  // Первичная загрузка — один раз, с начальным периодом KPI (дальше — по кнопке «Рассчитать»).
  const loadInitial = useCallback(async () => {
    setLoading(true);
    setError(null);
    const fail = (e: unknown) => setError((prev: unknown) => prev ?? e);
    const [cats, chs, initKpi, monthly, profs, pkgs, invs, stfs, qStats, qReviews] = await Promise.all([
      soft(directory.categories(), [] as RoomCategory[], fail),
      reports.channels().catch(() => [] as ChannelRevenue[]),
      reports.kpi(today(-30), today()).catch(() => null),
      soft(bi.monthlyStats(), [] as BiMonthlyPoint[], fail),
      soft(bi.profilePopularity(), [] as ProfilePopularity[], fail),
      soft(packages.list(), [] as SanatoriumPackage[], fail),
      soft(inventory.list(), [] as ConsumableItem[], fail),
      soft(staff.list(), [] as StaffMember[], fail),
      soft(guestReviewsApi.stats(), null as ReviewQualityStats | null, fail),
      soft(guestReviewsApi.list(), [] as GuestReview[], fail),
    ]);
    setCategories(cats);
    setCategoryId((prev) => prev || (cats.length > 0 ? String(cats[0].id) : ''));
    setChannels(chs);
    setKpi(initKpi);
    setBiMonthly(monthly);
    setBiProfiles(profs);
    setPackageList(pkgs);
    setConsumables(invs);
    setStaffList(stfs);
    setQualityStats(qStats);
    setGuestReviews(qReviews);
    setLoading(false);
  }, []);

  useEffect(() => {
    void loadInitial();
  }, [loadInitial]);

  useEffect(() => {
    void loadReviews();
  }, [loadReviews]);

  useEffect(() => {
    if (!categoryId) return;
    pricing
      .forecast(Number(categoryId), today(), today(60))
      .then((p) => setForecast(Array.isArray(p) ? p : []))
      .catch(() => setForecast([]));
  }, [categoryId]);

  async function calculateKpi(start = from, end = to) {
    setKpiError(null);
    if (end < start) {
      setKpiError(new Error('Дата окончания не может быть раньше даты начала.'));
      return;
    }
    setKpiLoading(true);
    try {
      setKpi(await reports.kpi(start, end));
    } catch (err) {
      setKpiError(err);
    } finally {
      setKpiLoading(false);
    }
  }

  const setDatePreset = (days: number) => {
    const f = today(-days);
    const t = today();
    setFrom(f);
    setTo(t);
    void calculateKpi(f, t);
  };

  async function runForecast() {
    if (!categoryId) return;
    setForecastError(null);
    setForecastNotice('');
    setForecastLoading(true);
    try {
      const res = await pricing.runForecast(Number(categoryId));
      setForecastResult(res);
      const points = await pricing.forecast(Number(categoryId), today(), today(60));
      setForecast(Array.isArray(points) ? points : []);
      const mape = res.mape != null ? Number(res.mape) : null;
      const mapeStr = mape != null && !isNaN(mape) ? `, средняя ошибка MAPE ${mape.toFixed(1)}%` : '';
      // Текст проверяется e2e (/Прогноз построен/) — показывается в Notice, без тоста.
      setForecastNotice(`Прогноз построен: прогон № ${res.run_id}, точек ${res.points}${mapeStr}.`);
    } catch (err) {
      setForecastError(err);
    } finally {
      setForecastLoading(false);
    }
  }

  async function handleDecide(id: number, action: ReviewDecision) {
    setReviewsError(null);
    setDecidingId(id);
    try {
      await pricing.decide(id, action);
      toast.success(action === 'ACKNOWLEDGE' ? 'Рекомендация принята к сведению.' : 'Отмечено: ценовые правила скорректированы.');
      await loadReviews();
    } catch (err) {
      setReviewsError(err);
    } finally {
      setDecidingId(null);
    }
  }

  const changeReviewFilter = (f: 'PENDING_REVIEW' | 'ALL') => {
    if (f === reviewFilter) return;
    setReviewsLoading(true);
    setReviews([]);
    setReviewFilter(f);
  };

  const forecastState: ForecastState = {
    categories,
    categoryId,
    onCategoryChange: setCategoryId,
    forecast,
    result: forecastResult,
    running: forecastLoading,
    notice: forecastNotice,
    error: forecastError,
    onRun: () => void runForecast(),
  };

  const pendingCount = reviews.filter((r) => r.status === 'PENDING_REVIEW').length;
  const tabs: { id: ManagerTab; label: string; icon: IconName; count?: number }[] = [
    { id: 'kpi', label: 'Доходность и прогноз', icon: 'wallet' },
    { id: 'bi', label: 'BI-аналитика', icon: 'chart' },
    { id: 'packages', label: 'Пакеты', icon: 'package', count: loading ? undefined : packageList.length },
    { id: 'inventory', label: 'Склад', icon: 'database' },
    { id: 'staff', label: 'Персонал', icon: 'users' },
    { id: 'quality', label: 'Качество и NPS', icon: 'star', count: qualityStats?.totalReviews },
    { id: 'forecast', label: 'Прогноз спроса', icon: 'trendUp' },
    { id: 'rules', label: 'Коридоры цен', icon: 'tag', count: reviewsLoading ? undefined : pendingCount || undefined },
  ];

  return (
    <section className="mgr-page">
      <div className="page-head">
        <div>
          <h1>Панель руководителя</h1>
          <p className="page-subtitle">Доходность, BI-отчёты, пакетные туры, склад, персонал и качество сервиса</p>
        </div>
        <div className="page-actions">
          {activeTab === 'bi' && (
            <Button variant="outline" icon={<Icon name="download" size={18} />} onClick={() => void bi.exportCsv()}>
              Выгрузить CSV
            </Button>
          )}
          <Button variant="ghost" icon={<Icon name="refresh" size={18} />} loading={loading} onClick={() => { void loadInitial(); void loadReviews(); }}>
            Обновить данные
          </Button>
        </div>
        <div className="mgr-tabs">
          <Tabs tabs={tabs} value={activeTab} onChange={setActiveTab} label="Разделы панели руководителя" />
        </div>
      </div>

      <ErrorBox error={error} />

      <div role="tabpanel" aria-label={tabs.find((t) => t.id === activeTab)?.label}>
        {activeTab === 'kpi' && (
          <KpiTab
            period={{
              from,
              to,
              onFromChange: setFrom,
              onToChange: setTo,
              onCalculate: () => void calculateKpi(),
              onPreset: setDatePreset,
              kpi,
              calculating: kpiLoading,
              error: kpiError,
            }}
            channels={channels}
            monthly={biMonthly}
            loading={loading}
            forecast={forecastState}
            reviews={reviews}
            reviewsLoading={reviewsLoading}
            reviewsError={reviewsError}
            categories={categories}
            busyId={decidingId}
            onDecide={(id, a) => void handleDecide(id, a)}
          />
        )}
        {activeTab === 'bi' && <BiTab monthly={biMonthly} profiles={biProfiles} loading={loading} />}
        {activeTab === 'packages' && <PackagesTab list={packageList} onListChange={setPackageList} categories={categories} loading={loading} />}
        {activeTab === 'inventory' && <InventoryTab items={consumables} onItemsChange={setConsumables} loading={loading} />}
        {activeTab === 'staff' && <StaffTab list={staffList} onListChange={setStaffList} loading={loading} />}
        {activeTab === 'quality' && (
          <QualityTab stats={qualityStats} onStatsChange={setQualityStats} reviews={guestReviews} onReviewsChange={setGuestReviews} loading={loading} />
        )}
        {activeTab === 'forecast' && <ForecastTab state={forecastState} loading={loading} />}
        {activeTab === 'rules' && (
          <RulesTab
            reviews={reviews}
            categories={categories}
            categoryId={categoryId}
            onCategoryChange={setCategoryId}
            filter={reviewFilter}
            onFilterChange={changeReviewFilter}
            loading={reviewsLoading}
            busyId={decidingId}
            onDecide={(id, a) => void handleDecide(id, a)}
            error={reviewsError}
          />
        )}
      </div>
    </section>
  );
}
