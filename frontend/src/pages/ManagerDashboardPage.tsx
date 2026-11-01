import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { bi, directory, inventory, packages, pricing, reports, reviews as guestReviewsApi, staff } from '../api/endpoints';
import {
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorBox,
  Field,
  formatDateTime,
  Modal,
  money,
  StatCard,
  StatusBadge,
  TableWrap,
  today,
} from '../components/ui';
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
  StaffStatus,
} from '../types';

type ManagerTab = 'kpi' | 'bi' | 'packages' | 'inventory' | 'staff' | 'quality' | 'forecast' | 'rules';

function ForecastChart({ points }: { points: ForecastPoint[] }) {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  if (!Array.isArray(points) || points.length < 2) {
    return (
      <EmptyState
        title="Нет данных прогноза"
        description="Нажмите «Пересчитать прогноз», чтобы запустить ML-модель расчёта спроса для выбранной категории."
      />
    );
  }

  const w = 780;
  const h = 260;
  const padLeft = 46;
  const padRight = 30;
  const padTop = 30;
  const padBottom = 42;

  const chartW = w - padLeft - padRight;
  const chartH = h - padTop - padBottom;

  const x = (i: number) => padLeft + (i * chartW) / (points.length - 1);
  const y = (v: number) => padTop + chartH - (Math.max(0, Math.min(100, Number(v) || 0)) * chartH) / 100;

  const pointsPath = points.map((p, i) => `${x(i)},${y(p.predicted_occ)}`).join(' ');
  const areaPath = `${x(0)},${y(0)} ${pointsPath} ${x(points.length - 1)},${y(0)}`;

  const hoveredPoint = hoveredIdx !== null && points[hoveredIdx] ? points[hoveredIdx] : null;

  return (
    <div style={{ position: 'relative', width: '100%' }}>
      <svg
        viewBox={`0 0 ${w} ${h}`}
        role="img"
        aria-label="Интерактивный прогноз загрузки, %"
        className="chart"
        style={{ width: '100%', height: 'auto', display: 'block' }}
      >
        <defs>
          <linearGradient id="chartGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.32" />
            <stop offset="100%" stopColor="var(--accent)" stopOpacity="0.01" />
          </linearGradient>
        </defs>

        {[0, 25, 50, 75, 100].map((t) => (
          <g key={t}>
            <line
              x1={padLeft}
              y1={y(t)}
              x2={w - padRight}
              y2={y(t)}
              stroke="var(--line)"
              strokeDasharray={t === 0 || t === 100 ? undefined : '4 4'}
            />
            <text x={padLeft - 8} y={y(t) + 4} fontSize="11" textAnchor="end" fill="var(--text-muted)">
              {t}%
            </text>
          </g>
        ))}

        <line
          x1={padLeft}
          y1={y(80)}
          x2={w - padRight}
          y2={y(80)}
          stroke="var(--ok)"
          strokeOpacity="0.5"
          strokeWidth="1.2"
          strokeDasharray="2 3"
        />
        <text x={w - padRight} y={y(80) - 4} fontSize="10" textAnchor="end" fill="var(--ok)" fontWeight="600">
          Целевая загрузка: 80%
        </text>

        <polygon points={areaPath} fill="url(#chartGradient)" />
        <polyline points={pointsPath} fill="none" stroke="var(--accent)" strokeWidth="3" strokeLinejoin="round" />

        {points.map((p, i) => (
          <g key={i} onMouseEnter={() => setHoveredIdx(i)} onMouseLeave={() => setHoveredIdx(null)}>
            <circle
              cx={x(i)}
              cy={y(p.predicted_occ)}
              r={hoveredIdx === i ? 6 : 3}
              fill={hoveredIdx === i ? 'var(--accent)' : 'var(--surface)'}
              stroke="var(--accent)"
              strokeWidth={hoveredIdx === i ? 3 : 2}
            />
            <rect x={x(i) - 8} y={padTop} width={16} height={chartH} fill="transparent" style={{ cursor: 'pointer' }} />
          </g>
        ))}

        {hoveredIdx !== null && (
          <line
            x1={x(hoveredIdx)}
            y1={padTop}
            x2={x(hoveredIdx)}
            y2={padTop + chartH}
            stroke="var(--accent)"
            strokeWidth="1"
            strokeDasharray="3 3"
          />
        )}

        <text x={padLeft} y={h - 12} fontSize="11" fill="var(--text-muted)" fontWeight="500">
          {points[0]?.stay_date}
        </text>
        {points.length > 2 && (
          <text
            x={padLeft + chartW / 2}
            y={h - 12}
            fontSize="11"
            textAnchor="middle"
            fill="var(--text-muted)"
            fontWeight="500"
          >
            {points[Math.floor(points.length / 2)]?.stay_date}
          </text>
        )}
        <text x={w - padRight} y={h - 12} fontSize="11" textAnchor="end" fill="var(--text-muted)" fontWeight="500">
          {points[points.length - 1]?.stay_date}
        </text>
      </svg>

      {hoveredPoint && (
        <div
          style={{
            position: 'absolute',
            top: 14,
            right: 20,
            background: 'var(--surface)',
            border: '1px solid var(--line-strong)',
            borderRadius: 'var(--radius-md)',
            padding: '8px 14px',
            boxShadow: 'var(--shadow-card)',
            fontSize: '0.86rem',
            pointerEvents: 'none',
          }}
        >
          <div>
            Дата: <strong>{hoveredPoint.stay_date}</strong>
          </div>
          <div style={{ color: 'var(--accent)', fontWeight: 700 }}>
            Прогноз загрузки: {hoveredPoint.predicted_occ != null ? Number(hoveredPoint.predicted_occ).toFixed(1) : '0.0'}%
          </div>
        </div>
      )}
    </div>
  );
}

export default function ManagerDashboardPage() {
  const [activeTab, setActiveTab] = useState<ManagerTab>('kpi');

  // KPI date range
  const [from, setFrom] = useState(today(-30));
  const [to, setTo] = useState(today());
  const [kpi, setKpi] = useState<KpiView | null>(null);
  const [channels, setChannels] = useState<ChannelRevenue[]>([]);
  const [kpiLoading, setKpiLoading] = useState(false);

  // BI state (Идея 9)
  const [biMonthly, setBiMonthly] = useState<BiMonthlyPoint[]>([]);
  const [biProfiles, setBiProfiles] = useState<ProfilePopularity[]>([]);
  const [biPeriod, setBiPeriod] = useState<6 | 12 | 24>(12);

  // Packages state (Идея 10)
  const [packageList, setPackageList] = useState<SanatoriumPackage[]>([]);
  const [packageModalOpen, setPackageModalOpen] = useState(false);
  const [pkgForm, setPkgForm] = useState({
    name: '',
    description: '',
    categoryId: 1,
    profileId: 1,
    durationNights: 10,
    basePrice: 1200,
    packagePrice: 1020,
    badge: 'Новинка',
  });

  // Consumables state (Идея 8)
  const [consumables, setConsumables] = useState<ConsumableItem[]>([]);
  const [inventoryModalOpen, setInventoryModalOpen] = useState(false);
  const [newInv, setNewInv] = useState({
    sku: 'MED-NEW-01',
    name: '',
    category: 'Бальнеология',
    cabinetId: 1,
    cabinetName: 'Кабинет №1',
    unit: 'кг',
    stockQuantity: 50,
    minThreshold: 20,
  });

  // Staff state (Идея 7)
  const [staffList, setStaffList] = useState<StaffMember[]>([]);
  const [staffModalOpen, setStaffModalOpen] = useState(false);
  const [newStaff, setNewStaff] = useState({
    fullName: '',
    role: 'Врач-терапевт',
    cabinetName: 'Кабинет №10',
    shiftHours: '08:30 – 16:30',
    maxSlotsPerDay: 16,
    assignedSlotsToday: 10,
    rating: 4.9,
  });

  // Quality & NPS state (Идея 6)
  const [qualityStats, setQualityStats] = useState<ReviewQualityStats | null>(null);
  const [guestReviews, setGuestReviews] = useState<GuestReview[]>([]);
  const [qualityFilter, setQualityFilter] = useState<'ALL' | 'ATTENTION' | '5' | '4' | '3'>('ALL');
  const [replyReviewModal, setReplyReviewModal] = useState<GuestReview | null>(null);
  const [replyText, setReplyText] = useState('');
  const [replyReplierName, setReplyReplierName] = useState('Служба заботы о гостях');
  const [replyBusy, setReplyBusy] = useState(false);

  // Forecast state
  const [categories, setCategories] = useState<RoomCategory[]>([]);
  const [categoryId, setCategoryId] = useState('');
  const [forecast, setForecast] = useState<ForecastPoint[]>([]);
  const [forecastResult, setForecastResult] = useState<ForecastRunResult | null>(null);
  const [forecastLoading, setForecastLoading] = useState(false);

  // Rules & Reviews state
  const [reviews, setReviews] = useState<PriceReview[]>([]);
  const [reviewFilter, setReviewFilter] = useState<'PENDING_REVIEW' | 'ALL'>('PENDING_REVIEW');
  const [ruleModalOpen, setRuleModalOpen] = useState(false);
  const [rule, setRule] = useState({
    from: today(),
    to: today(90),
    pMin: '',
    pMax: '',
    minLos: '1',
    closed: false,
  });

  const [error, setError] = useState<unknown>(null);
  const [message, setMessage] = useState('');

  const handleSendReply = async (e: FormEvent) => {
    e.preventDefault();
    if (!replyReviewModal || !replyText.trim()) return;
    setReplyBusy(true);
    try {
      const updated = await guestReviewsApi.reply(replyReviewModal.id, replyText, replyReplierName);
      setGuestReviews((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
      const newStats = await guestReviewsApi.stats();
      setQualityStats(newStats);
      setReplyReviewModal(null);
      setReplyText('');
      setMessage('Ответ на отзыв гостя успешно опубликован');
    } catch (err) {
      setError(err);
    } finally {
      setReplyBusy(false);
    }
  };

  const loadReviews = useCallback(async () => {
    try {
      const data = await pricing.reviews(reviewFilter === 'ALL' ? undefined : 'PENDING_REVIEW');
      setReviews(data);
    } catch (err) {
      setError(err);
    }
  }, [reviewFilter]);

  const loadInitial = useCallback(async () => {
    try {
      const [cats, chs, initKpi, monthly, profs, pkgs, invs, stfs, qStats, qReviews] = await Promise.all([
        directory.categories(),
        reports.channels().catch(() => [] as ChannelRevenue[]),
        reports.kpi(from, to).catch(() => null),
        bi.monthlyStats(),
        bi.profilePopularity(),
        packages.list(),
        inventory.list(),
        staff.list(),
        guestReviewsApi.stats(),
        guestReviewsApi.list(),
      ]);
      setCategories(cats);
      if (cats.length > 0) setCategoryId(String(cats[0].id));
      setChannels(chs);
      setKpi(initKpi);
      setBiMonthly(monthly);
      setBiProfiles(profs);
      setPackageList(pkgs);
      setConsumables(invs);
      setStaffList(stfs);
      setQualityStats(qStats);
      setGuestReviews(qReviews);
    } catch (err) {
      setError(err);
    }
  }, [from, to]);

  useEffect(() => {
    void loadInitial();
  }, [loadInitial]);

  useEffect(() => {
    void loadReviews();
  }, [loadReviews]);

  useEffect(() => {
    if (categoryId) {
      pricing
        .forecast(Number(categoryId), today(), today(60))
        .then(setForecast)
        .catch(() => setForecast([]));
    }
  }, [categoryId]);

  async function calculateKpi(start = from, end = to) {
    setError(null);
    if (end < start) {
      setError(new Error('Дата окончания не может быть раньше даты начала.'));
      return;
    }
    setKpiLoading(true);
    try {
      const data = await reports.kpi(start, end);
      setKpi(data);
    } catch (err) {
      setError(err);
    } finally {
      setKpiLoading(false);
    }
  }

  const setDatePreset = (days: number) => {
    const newFrom = today(-days);
    const newTo = today();
    setFrom(newFrom);
    setTo(newTo);
    void calculateKpi(newFrom, newTo);
  };

  async function runForecast() {
    if (!categoryId) return;
    setError(null);
    setMessage('');
    setForecastLoading(true);
    try {
      const res = await pricing.runForecast(Number(categoryId));
      setForecastResult(res);
      const points = await pricing.forecast(Number(categoryId), today(), today(60));
      setForecast(Array.isArray(points) ? points : []);
      const numMape = res.mape != null ? Number(res.mape) : null;
      const mapeStr = numMape != null && !isNaN(numMape) ? `, средняя ошибка MAPE: ${numMape.toFixed(1)}%` : '';
      setMessage(`Прогноз успешно построен! Прогон #${res.run_id}, точек: ${res.points}${mapeStr}`);
    } catch (err) {
      setError(err);
    } finally {
      setForecastLoading(false);
    }
  }

  async function saveCorridor(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setMessage('');
    const pMin = Number(rule.pMin);
    const pMax = Number(rule.pMax);
    if (pMin > pMax) {
      setError(new Error('Минимальная цена не может превышать максимальную.'));
      return;
    }
    try {
      await pricing.createCorridor({
        category_id: Number(categoryId),
        date_from: rule.from,
        date_to: rule.to,
        p_min: pMin,
        p_max: pMax,
        min_los: Number(rule.minLos),
        closed: rule.closed,
      });
      setMessage('Ценовой коридор успешно сохранён и активирован.');
      setRuleModalOpen(false);
    } catch (err) {
      setError(err);
    }
  }

  async function handleDecide(id: number, action: 'ACKNOWLEDGE' | 'RULE_ADJUSTED') {
    setError(null);
    try {
      await pricing.decide(id, action);
      setMessage(
        action === 'ACKNOWLEDGE'
          ? 'Рекомендация ИИ принята и применена к тарифам.'
          : 'Отмечено: ценовые правила скорректированы.'
      );
      await loadReviews();
    } catch (err) {
      setError(err);
    }
  }

  // Packages handlers (Идея 10)
  async function handleSavePackage(e: FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      const discount = Math.round(((pkgForm.basePrice - pkgForm.packagePrice) / pkgForm.basePrice) * 100);
      const cat = categories.find((c) => c.id === Number(pkgForm.categoryId));
      const created = await packages.create({
        name: pkgForm.name,
        description: pkgForm.description,
        categoryId: Number(pkgForm.categoryId),
        categoryName: cat?.name ?? 'Стандарт',
        profileId: Number(pkgForm.profileId),
        profileName: 'Профиль оздоровления',
        durationNights: Number(pkgForm.durationNights),
        includedProcedures: [
          { procedureId: 1, procedureName: 'Минеральная ванна', sessions: 5 },
          { procedureId: 2, procedureName: 'Спелеотерапия', sessions: 6 },
        ],
        basePrice: Number(pkgForm.basePrice),
        packagePrice: Number(pkgForm.packagePrice),
        discountPercent: Math.max(0, discount),
        isActive: true,
        badge: pkgForm.badge || undefined,
      });
      setPackageList(await packages.list());
      setPackageModalOpen(false);
      setMessage(`Оздоровительный пакет «${created.name}» успешно создан и опубликован!`);
    } catch (err) {
      setError(err);
    }
  }

  async function handleTogglePackage(id: number) {
    await packages.toggleActive(id);
    setPackageList(await packages.list());
  }

  async function handleDeletePackage(id: number) {
    if (!window.confirm('Удалить пакет?')) return;
    await packages.remove(id);
    setPackageList(await packages.list());
    setMessage('Пакет удалён.');
  }

  // Inventory handlers (Идея 8)
  async function handleRestock(id: number, amount: number) {
    await inventory.restock(id, amount);
    setConsumables(await inventory.list());
    setMessage('Партия расходных материалов оприходована на склад.');
  }

  async function handleWriteOff(id: number, amount: number) {
    await inventory.writeOff(id, amount);
    setConsumables(await inventory.list());
    setMessage('Расход материалов списан со склада.');
  }

  async function handleAddInventory(e: FormEvent) {
    e.preventDefault();
    await inventory.add({
      sku: newInv.sku,
      name: newInv.name,
      category: newInv.category,
      cabinetId: Number(newInv.cabinetId),
      cabinetName: newInv.cabinetName,
      unit: newInv.unit,
      stockQuantity: Number(newInv.stockQuantity),
      minThreshold: Number(newInv.minThreshold),
    });
    setConsumables(await inventory.list());
    setInventoryModalOpen(false);
    setMessage(`Позиция «${newInv.name}» добавлена на склад.`);
  }

  // Staff handlers (Идея 7)
  async function handleStaffStatusChange(id: number, st: StaffStatus) {
    await staff.updateStatus(id, st);
    setStaffList(await staff.list());
    setMessage('Статус сотрудника обновлён.');
  }

  async function handleAddStaff(e: FormEvent) {
    e.preventDefault();
    await staff.add({
      fullName: newStaff.fullName,
      role: newStaff.role,
      cabinetName: newStaff.cabinetName,
      shiftHours: newStaff.shiftHours,
      status: 'ON_SHIFT',
      assignedSlotsToday: Number(newStaff.assignedSlotsToday),
      maxSlotsPerDay: Number(newStaff.maxSlotsPerDay),
      rating: Number(newStaff.rating),
    });
    setStaffList(await staff.list());
    setStaffModalOpen(false);
    setMessage(`Сотрудник ${newStaff.fullName} добавлен в график смен.`);
  }

  // Channel calculations
  const channelTotals = useMemo(() => {
    const totalRev = channels.reduce((sum, c) => sum + c.revenue, 0);
    const totalComm = channels.reduce((sum, c) => sum + c.commission, 0);
    const totalVouchers = channels.reduce((sum, c) => sum + c.vouchers, 0);
    const netRevenue = totalRev - totalComm;
    return { totalRev, totalComm, totalVouchers, netRevenue };
  }, [channels]);

  // Quality & NPS calculations (Идея 6)
  const filteredGuestReviews = useMemo(() => {
    return guestReviews.filter((r) => {
      if (qualityFilter === 'ATTENTION') {
        return r.overallRating <= 3 || r.npsScore <= 6 || !r.managementResponse;
      }
      if (qualityFilter === '5') return r.overallRating === 5;
      if (qualityFilter === '4') return r.overallRating === 4;
      if (qualityFilter === '3') return r.overallRating <= 3;
      return true;
    });
  }, [guestReviews, qualityFilter]);

  const attentionReviewsCount = useMemo(() => {
    return guestReviews.filter((r) => r.overallRating <= 3 || r.npsScore <= 6 || !r.managementResponse).length;
  }, [guestReviews]);

  const activeCategory = categories.find((c) => String(c.id) === categoryId);

  return (
    <section>
      {/* Page Header */}
      <div className="page-head">
        <div>
          <h1>Панель управления и бизнес-аналитики (BI & Operations)</h1>
          <p className="card-subtitle">
            Комплексный мониторинг загрузки, BI-отчёты, конструктор пакетных туров, склад расходников и персонал
          </p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          {activeTab === 'bi' && (
            <Button variant="primary" onClick={() => void bi.exportCsv()}>
              📥 Выгрузить отчёт (CSV)
            </Button>
          )}
          {activeTab === 'packages' && (
            <Button variant="primary" onClick={() => setPackageModalOpen(true)}>
              + Новый пакетный тур
            </Button>
          )}
          {activeTab === 'inventory' && (
            <Button variant="primary" onClick={() => setInventoryModalOpen(true)}>
              + Добавить расходник
            </Button>
          )}
          {activeTab === 'staff' && (
            <Button variant="primary" onClick={() => setStaffModalOpen(true)}>
              + Новый сотрудник
            </Button>
          )}
          {activeTab === 'rules' && (
            <Button variant="primary" onClick={() => setRuleModalOpen(true)}>
              + Ценовой коридор
            </Button>
          )}
        </div>
      </div>

      <ErrorBox error={error} />
      {message && <p className="ok">{message}</p>}

      {/* Modern Multi-Tab Navigation */}
      <div className="tabs" style={{ flexWrap: 'wrap' }}>
        <button
          type="button"
          className={`tab ${activeTab === 'kpi' ? 'active' : ''}`}
          onClick={() => setActiveTab('kpi')}
        >
          Доходность и каналы
        </button>
        <button
          type="button"
          className={`tab ${activeTab === 'bi' ? 'active' : ''}`}
          onClick={() => setActiveTab('bi')}
        >
          BI-аналитика
        </button>
        <button
          type="button"
          className={`tab ${activeTab === 'packages' ? 'active' : ''}`}
          onClick={() => setActiveTab('packages')}
        >
          Пакетные предложения ({packageList.length})
        </button>
        <button
          type="button"
          className={`tab ${activeTab === 'inventory' ? 'active' : ''}`}
          onClick={() => setActiveTab('inventory')}
        >
          Складской учёт
        </button>
        <button
          type="button"
          className={`tab ${activeTab === 'staff' ? 'active' : ''}`}
          onClick={() => setActiveTab('staff')}
        >
          Персонал и смены
        </button>
        <button
          type="button"
          className={`tab ${activeTab === 'quality' ? 'active' : ''}`}
          onClick={() => setActiveTab('quality')}
        >
          Контроль качества & NPS ({qualityStats?.totalReviews || 0})
        </button>
        <button
          type="button"
          className={`tab ${activeTab === 'forecast' ? 'active' : ''}`}
          onClick={() => setActiveTab('forecast')}
        >
          Прогноз спроса (ML)
        </button>
        <button
          type="button"
          className={`tab ${activeTab === 'rules' ? 'active' : ''}`}
          onClick={() => setActiveTab('rules')}
        >
          Коридоры цен
        </button>
      </div>

      {/* TAB 1: KPI & Channels */}
      {activeTab === 'kpi' && (
        <>
          <Card>
            <div className="filter-toolbar">
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center' }}>
                <span style={{ fontSize: '0.88rem', fontWeight: 650, color: 'var(--text-muted)' }}>
                  Быстрый период:
                </span>
                <Button variant="secondary" size="sm" onClick={() => setDatePreset(7)}>
                  7 дней
                </Button>
                <Button variant="secondary" size="sm" onClick={() => setDatePreset(30)}>
                  30 дней
                </Button>
                <Button variant="secondary" size="sm" onClick={() => setDatePreset(90)}>
                  Квартал
                </Button>
              </div>

              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center' }}>
                <Field label="С даты" className="inline-field" style={{ margin: 0 }}>
                  <input
                    type="date"
                    value={from}
                    onChange={(e) => setFrom(e.target.value)}
                    style={{ minHeight: 38 }}
                  />
                </Field>
                <Field label="По дату" className="inline-field" style={{ margin: 0 }}>
                  <input
                    type="date"
                    value={to}
                    onChange={(e) => setTo(e.target.value)}
                    style={{ minHeight: 38 }}
                  />
                </Field>
                <Button
                  variant="primary"
                  onClick={() => void calculateKpi()}
                  disabled={kpiLoading}
                  style={{ alignSelf: 'flex-end' }}
                >
                  {kpiLoading ? 'Расчёт…' : 'Рассчитать'}
                </Button>
              </div>
            </div>

            {kpi && (
              <div className="kpi-grid" style={{ marginTop: 20 }}>
                <StatCard
                  label="Загрузка фонда (Occ)"
                  value={`${kpi.occPct.toFixed(1)}%`}
                  subvalue="Цель: 80% койко-фонда"
                  color={kpi.occPct >= 70 ? 'c-teal' : 'c-amber'}
                  icon="🏨"
                />
                <StatCard
                  label="Средняя цена (ADR)"
                  value={money(kpi.adr)}
                  subvalue="Average Daily Rate"
                  color="c-blue"
                  icon="🏷️"
                />
                <StatCard
                  label="Доход на номер (RevPAR)"
                  value={money(kpi.revpar)}
                  subvalue="Revenue Per Available Room"
                  color="default"
                  icon="💰"
                />
                <StatCard
                  label="Койко-дни (продано/всего)"
                  value={`${kpi.soldPlaceDays} / ${kpi.availablePlaceDays}`}
                  subvalue={`Свободно: ${Math.max(0, kpi.availablePlaceDays - kpi.soldPlaceDays)} мест`}
                  color="c-amber"
                  icon="🛏️"
                />
              </div>
            )}
          </Card>

          <Card
            title="Эффективность каналов продаж"
            subtitle="Сравнение выручки, комиссионных затрат и чистого дохода по источникам бронирования"
            style={{ marginTop: 24 }}
          >
            <TableWrap>
              <table>
                <thead>
                  <tr>
                    <th>Канал продаж</th>
                    <th>Оформлено путёвок</th>
                    <th>Выручка брутто</th>
                    <th>Доля в выручке</th>
                    <th>Комиссия партнёра</th>
                    <th>Чистая выручка</th>
                    <th>Средний чек</th>
                  </tr>
                </thead>
                <tbody>
                  {channels.map((c) => {
                    const net = c.revenue - c.commission;
                    const sharePct = channelTotals.totalRev > 0 ? (c.revenue / channelTotals.totalRev) * 100 : 0;
                    return (
                      <tr key={c.channel}>
                        <td>
                          <strong>{c.channel}</strong>
                        </td>
                        <td>{c.vouchers}</td>
                        <td>
                          <strong>{money(c.revenue)}</strong>
                        </td>
                        <td>{sharePct.toFixed(1)}%</td>
                        <td style={{ color: 'var(--danger)' }}>{money(c.commission)}</td>
                        <td style={{ color: 'var(--ok)', fontWeight: 700 }}>{money(net)}</td>
                        <td>{money(c.vouchers > 0 ? c.revenue / c.vouchers : 0)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </TableWrap>
          </Card>
        </>
      )}

      {/* TAB 2: BI Reports (Идея 9) */}
      {activeTab === 'bi' && (
        <>
          <Card
            title="Динамика выручки и выполнения плана (План vs Факт)"
            subtitle={`Помесячная статистика доходов санатория (${biPeriod} мес.)`}
            actions={
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div className="tabs" style={{ margin: 0 }}>
                  <button
                    type="button"
                    className={`tab ${biPeriod === 6 ? 'active' : ''}`}
                    onClick={() => setBiPeriod(6)}
                  >
                    6 мес
                  </button>
                  <button
                    type="button"
                    className={`tab ${biPeriod === 12 ? 'active' : ''}`}
                    onClick={() => setBiPeriod(12)}
                  >
                    12 мес
                  </button>
                  <button
                    type="button"
                    className={`tab ${biPeriod === 24 ? 'active' : ''}`}
                    onClick={() => setBiPeriod(24)}
                  >
                    24 мес
                  </button>
                </div>
                <Button variant="outline" size="sm" onClick={() => void bi.exportCsv()}>
                  Экспорт в CSV
                </Button>
              </div>
            }
          >
            {/* Custom SVG Bar Chart */}
            <div className="bi-bar-container-wrap">
              <div className="bi-bar-container">
                {biMonthly.slice(-biPeriod).map((m, idx) => {
                  const displayedList = biMonthly.slice(-biPeriod);
                  const maxVal = Math.max(...displayedList.map((b) => Math.max(b.revenue, b.targetRevenue, 10000))) * 1.1;
                  const factHeight = Math.round((m.revenue / maxVal) * 160);
                  const targetHeight = Math.round((m.targetRevenue / maxVal) * 160);
                  const isOverperforming = m.revenue >= m.targetRevenue;
                  return (
                    <div key={idx} className="bi-bar-column">
                      <div className="bi-bar-bars">
                        <div
                          className="bi-bar-fact"
                          style={{
                            height: `${factHeight}px`,
                            background: isOverperforming ? 'var(--ok)' : 'var(--accent)',
                          }}
                          title={`Факт: ${money(m.revenue)}`}
                        />
                        <div
                          className="bi-bar-target"
                          style={{ height: `${targetHeight}px` }}
                          title={`План: ${money(m.targetRevenue)}`}
                        />
                      </div>
                      <div className="bi-bar-label">{m.month}</div>
                      <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)' }}>
                        {money(m.revenue)}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 20, justifyContent: 'center', marginTop: 12, fontSize: '0.82rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <div style={{ width: 14, height: 14, background: 'var(--ok)', borderRadius: 3 }} />
                <span>Фактическая выручка (BYN)</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <div style={{ width: 14, height: 14, background: 'var(--line-strong)', borderRadius: 3 }} />
                <span>Плановый целевой показатель</span>
              </div>
            </div>
          </Card>

          <Card
            title="Востребованность лечебных профилей"
            subtitle="Доля путевок и вклад каждого медицинского направления в общую структуру дохода"
            style={{ marginTop: 24 }}
          >
            <TableWrap>
              <table>
                <thead>
                  <tr>
                    <th>Медицинский профиль оздоровления</th>
                    <th>Оформлено путёвок</th>
                    <th>Доля в загрузке (%)</th>
                    <th>Общая выручка направления</th>
                    <th>Визуальная структура</th>
                  </tr>
                </thead>
                <tbody>
                  {biProfiles.map((p) => (
                    <tr key={p.profileId}>
                      <td>
                        <strong>{p.profileName}</strong>
                      </td>
                      <td>{p.vouchersCount}</td>
                      <td>
                        <strong>{p.sharePercent}%</strong>
                      </td>
                      <td style={{ color: 'var(--accent)', fontWeight: 700 }}>{money(p.revenue)}</td>
                      <td>
                        <div style={{ width: 160, height: 8, background: 'var(--line)', borderRadius: 4, overflow: 'hidden' }}>
                          <div style={{ width: `${p.sharePercent}%`, height: '100%', background: 'var(--accent)' }} />
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </TableWrap>
          </Card>
        </>
      )}

      {/* TAB 3: Package Constructor (Идея 10) */}
      {activeTab === 'packages' && (
        <>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <p className="card-subtitle">
              Готовые санаторные туры объединяют проживание, диету и курсовые процедуры со специальной пакетной скидкой
            </p>
            <Button variant="primary" onClick={() => setPackageModalOpen(true)}>
              + Создать пакет
            </Button>
          </div>

          <div className="package-grid">
            {packageList.map((pkg) => (
              <div key={pkg.id} className="package-card">
                <div>
                  <div className="package-card-header">
                    <h3>{pkg.name}</h3>
                    {pkg.badge && <span className="package-card-badge">{pkg.badge}</span>}
                  </div>
                  <div className="package-badges-row">
                    <Badge variant="info">{pkg.durationNights} ночей</Badge>
                    <Badge variant="neutral">{pkg.categoryName}</Badge>
                    <Badge variant={pkg.isActive ? 'good' : 'bad'}>
                      {pkg.isActive ? 'Активен' : 'Скрыт'}
                    </Badge>
                  </div>
                  <p className="package-card-desc">{pkg.description}</p>

                  <div className="package-procedures-list">
                    <h5>Включённые процедуры курса:</h5>
                    <div>
                      {pkg.includedProcedures.map((it, idx) => (
                        <span key={idx} className="package-proc-tag">
                          ✓ {it.procedureName} ({it.sessions} сеансов)
                        </span>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="package-card-footer">
                  <div>
                    <div className="package-price-old">{money(pkg.basePrice)}</div>
                    <div className="package-price-current">{money(pkg.packagePrice)}</div>
                    <div style={{ fontSize: '0.78rem', color: 'var(--ok)', fontWeight: 700 }}>
                      Скидка {pkg.discountPercent}%
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => void handleTogglePackage(pkg.id)}
                    >
                      {pkg.isActive ? 'Скрыть' : 'Включить'}
                    </Button>
                    <Button
                      variant="danger"
                      size="sm"
                      onClick={() => void handleDeletePackage(pkg.id)}
                    >
                      ×
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Modal: Create Package */}
          <Modal
            isOpen={packageModalOpen}
            onClose={() => setPackageModalOpen(false)}
            title="Конструктор нового оздоровительного пакета"
            size="md"
          >
            <form onSubmit={handleSavePackage}>
              <Field label="Название пакета" required>
                <input
                  value={pkgForm.name}
                  required
                  placeholder="Здоровое сердце (Премиум)"
                  onChange={(e) => setPkgForm({ ...pkgForm, name: e.target.value })}
                />
              </Field>

              <Field label="Описание и назначение" required>
                <textarea
                  rows={2}
                  required
                  placeholder="Опишите комплексное оздоровительное воздействие программы..."
                  value={pkgForm.description}
                  onChange={(e) => setPkgForm({ ...pkgForm, description: e.target.value })}
                />
              </Field>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                <Field label="Категория номера" required>
                  <select
                    value={pkgForm.categoryId}
                    onChange={(e) => setPkgForm({ ...pkgForm, categoryId: Number(e.target.value) })}
                  >
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </Field>

                <Field label="Длительность (ночей)" required>
                  <input
                    type="number"
                    min={3}
                    max={30}
                    value={pkgForm.durationNights}
                    required
                    onChange={(e) => setPkgForm({ ...pkgForm, durationNights: Number(e.target.value) })}
                  />
                </Field>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                <Field label="Базовая цена по отдельности (BYN)" required>
                  <input
                    type="number"
                    min={100}
                    value={pkgForm.basePrice}
                    required
                    onChange={(e) => setPkgForm({ ...pkgForm, basePrice: Number(e.target.value) })}
                  />
                </Field>

                <Field label="Пакетная стоимость со скидкой (BYN)" required>
                  <input
                    type="number"
                    min={50}
                    value={pkgForm.packagePrice}
                    required
                    onChange={(e) => setPkgForm({ ...pkgForm, packagePrice: Number(e.target.value) })}
                  />
                </Field>
              </div>

              <Field label="Промо-бейдж (например, Хит продаж, Выгода 15%)">
                <input
                  value={pkgForm.badge}
                  placeholder="Хит сезона"
                  onChange={(e) => setPkgForm({ ...pkgForm, badge: e.target.value })}
                />
              </Field>

              <div
                style={{
                  display: 'flex',
                  justifyContent: 'flex-end',
                  gap: 10,
                  marginTop: 20,
                  paddingTop: 16,
                  borderTop: '1px solid var(--line)',
                }}
              >
                <Button type="button" variant="secondary" onClick={() => setPackageModalOpen(false)}>
                  Отмена
                </Button>
                <Button type="submit" variant="primary">
                  Опубликовать пакет
                </Button>
              </div>
            </form>
          </Modal>
        </>
      )}

      {/* TAB 4: Consumables & Inventory (Идея 8) */}
      {activeTab === 'inventory' && (
        <Card title="Складской учёт лечебных материалов и расходников" subtitle="Контроль остатков, пополнение запасов и списание">
          <div className="kpi-grid">
            <StatCard label="Всего наименований" value={consumables.length} color="c-blue" icon="📦" />
            <StatCard
              label="В норме"
              value={consumables.filter((i) => i.status === 'IN_STOCK').length}
              color="c-teal"
              icon="✅"
            />
            <StatCard
              label="Низкий остаток"
              value={consumables.filter((i) => i.status === 'LOW_STOCK').length}
              color="c-amber"
              icon="⚠️"
            />
            <StatCard
              label="Критический дефицит"
              value={consumables.filter((i) => i.status === 'CRITICAL').length}
              color="c-red"
              icon="🚨"
            />
          </div>

          <TableWrap>
            <table>
              <thead>
                <tr>
                  <th>Артикул</th>
                  <th>Наименование расходника</th>
                  <th>Категория</th>
                  <th>Кабинет расхода</th>
                  <th>Текущий остаток</th>
                  <th>Мин. порог</th>
                  <th>Статус запаса</th>
                  <th style={{ textAlign: 'right' }}>Действия</th>
                </tr>
              </thead>
              <tbody>
                {consumables.map((item) => (
                  <tr key={item.id}>
                    <td>
                      <code style={{ fontSize: '0.82rem' }}>{item.sku}</code>
                    </td>
                    <td>
                      <strong>{item.name}</strong>
                    </td>
                    <td>{item.category}</td>
                    <td>{item.cabinetName}</td>
                    <td>
                      <strong style={{ fontSize: '1.05rem' }}>
                        {item.stockQuantity} {item.unit}
                      </strong>
                    </td>
                    <td>
                      {item.minThreshold} {item.unit}
                    </td>
                    <td>
                      <span className={`stock-pill ${item.status}`}>
                        {item.status === 'IN_STOCK'
                          ? '✓ В норме'
                          : item.status === 'LOW_STOCK'
                          ? '⚠️ Заканчивается'
                          : '🚨 Дефицит!'}
                      </span>
                    </td>
                    <td style={{ textAlign: 'right' }} className="actions">
                      <div style={{ display: 'inline-flex', gap: 6 }}>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => void handleRestock(item.id, 10)}
                          title="Оприходовать партию +10"
                        >
                          +10 Приход
                        </Button>
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => void handleWriteOff(item.id, 5)}
                          title="Списать расход на процедуры -5"
                        >
                          -5 Списать
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableWrap>

          {/* Modal: Add Consumable */}
          <Modal
            isOpen={inventoryModalOpen}
            onClose={() => setInventoryModalOpen(false)}
            title="Новая позиция складского учёта"
            size="md"
          >
            <form onSubmit={handleAddInventory}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 14 }}>
                <Field label="Артикул (SKU)" required>
                  <input
                    value={newInv.sku}
                    required
                    onChange={(e) => setNewInv({ ...newInv, sku: e.target.value })}
                  />
                </Field>
                <Field label="Наименование материала" required>
                  <input
                    value={newInv.name}
                    required
                    placeholder="Парафин медицинский очищенный"
                    onChange={(e) => setNewInv({ ...newInv, name: e.target.value })}
                  />
                </Field>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                <Field label="Категория" required>
                  <select
                    value={newInv.category}
                    onChange={(e) => setNewInv({ ...newInv, category: e.target.value })}
                  >
                    <option value="Бальнеология">Бальнеология</option>
                    <option value="Грязелечение">Грязелечение</option>
                    <option value="Массаж">Массаж</option>
                    <option value="Фитобар">Фитобар</option>
                    <option value="Расходные материалы">Расходные материалы</option>
                  </select>
                </Field>
                <Field label="Единица измерения" required>
                  <select
                    value={newInv.unit}
                    onChange={(e) => setNewInv({ ...newInv, unit: e.target.value })}
                  >
                    <option value="кг">кг</option>
                    <option value="л">л</option>
                    <option value="шт">шт</option>
                    <option value="упак">упак</option>
                    <option value="рулон">рулон</option>
                  </select>
                </Field>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                <Field label="Начальный остаток" required>
                  <input
                    type="number"
                    min={0}
                    value={newInv.stockQuantity}
                    required
                    onChange={(e) => setNewInv({ ...newInv, stockQuantity: Number(e.target.value) })}
                  />
                </Field>
                <Field label="Неснижаемый порог (Мин. запас)" required>
                  <input
                    type="number"
                    min={1}
                    value={newInv.minThreshold}
                    required
                    onChange={(e) => setNewInv({ ...newInv, minThreshold: Number(e.target.value) })}
                  />
                </Field>
              </div>

              <Field label="Кабинет расхода" required>
                <input
                  value={newInv.cabinetName}
                  required
                  placeholder="Кабинет парафинолечения №7"
                  onChange={(e) => setNewInv({ ...newInv, cabinetName: e.target.value })}
                />
              </Field>

              <div
                style={{
                  display: 'flex',
                  justifyContent: 'flex-end',
                  gap: 10,
                  marginTop: 20,
                  paddingTop: 16,
                  borderTop: '1px solid var(--line)',
                }}
              >
                <Button type="button" variant="secondary" onClick={() => setInventoryModalOpen(false)}>
                  Отмена
                </Button>
                <Button type="submit" variant="primary">
                  Добавить на склад
                </Button>
              </div>
            </form>
          </Modal>
        </Card>
      )}

      {/* TAB 5: Staff & Shifts (Идея 7) */}
      {activeTab === 'staff' && (
        <Card title="Медицинский персонал и загрузка смен" subtitle="График смен, распределение кабинетов и занятость специалистов">
          <div className="staff-grid">
            {staffList.map((member) => (
              <div key={member.id} className="staff-card">
                <div>
                  <div className="staff-card-header">
                    <div>
                      <div className="staff-name">{member.fullName}</div>
                      <div className="staff-role">{member.role}</div>
                    </div>
                    <Badge
                      variant={
                        member.status === 'ON_SHIFT'
                          ? 'good'
                          : member.status === 'VACATION'
                          ? 'info'
                          : 'bad'
                      }
                    >
                      {member.status === 'ON_SHIFT'
                        ? 'На смене'
                        : member.status === 'VACATION'
                        ? 'В отпуске'
                        : 'Больничный'}
                    </Badge>
                  </div>

                  <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', lineHeight: 1.6 }}>
                    <div>📍 {member.cabinetName}</div>
                    <div>⏰ Смена: {member.shiftHours}</div>
                    <div>⭐ Рейтинг отзывов: <strong>{member.rating} / 5.0</strong></div>
                  </div>

                  <div className="staff-utilization">
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', fontWeight: 650 }}>
                      <span>Загрузка на сегодня</span>
                      <span>
                        {member.assignedSlotsToday} / {member.maxSlotsPerDay} сеансов ({member.utilizationPercent}%)
                      </span>
                    </div>
                    <div className="staff-progress-bar">
                      <div
                        className="staff-progress-fill"
                        style={{
                          width: `${member.utilizationPercent}%`,
                          background:
                            member.utilizationPercent >= 90
                              ? 'var(--danger)'
                              : member.utilizationPercent >= 60
                              ? 'var(--ok)'
                              : 'var(--amber)',
                        }}
                      />
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: 6, marginTop: 14, paddingTop: 10, borderTop: '1px solid var(--line)' }}>
                  <select
                    value={member.status}
                    onChange={(e) => void handleStaffStatusChange(member.id, e.target.value as StaffStatus)}
                    style={{ fontSize: '0.82rem', minHeight: 34, padding: '4px 8px' }}
                  >
                    <option value="ON_SHIFT">На смене</option>
                    <option value="VACATION">В отпуске</option>
                    <option value="SICK_LEAVE">Больничный</option>
                  </select>
                </div>
              </div>
            ))}
          </div>

          {/* Modal: Add Staff */}
          <Modal
            isOpen={staffModalOpen}
            onClose={() => setStaffModalOpen(false)}
            title="Добавление сотрудника в график"
            size="md"
          >
            <form onSubmit={handleAddStaff}>
              <Field label="ФИО сотрудника" required>
                <input
                  value={newStaff.fullName}
                  required
                  placeholder="Др. Новикова Ирина Петровна"
                  onChange={(e) => setNewStaff({ ...newStaff, fullName: e.target.value })}
                />
              </Field>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                <Field label="Должность / Специализация" required>
                  <input
                    value={newStaff.role}
                    required
                    placeholder="Врач-физиотерапевт"
                    onChange={(e) => setNewStaff({ ...newStaff, role: e.target.value })}
                  />
                </Field>
                <Field label="Закреплённый кабинет" required>
                  <input
                    value={newStaff.cabinetName}
                    required
                    placeholder="Кабинет №15"
                    onChange={(e) => setNewStaff({ ...newStaff, cabinetName: e.target.value })}
                  />
                </Field>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                <Field label="Часы смены" required>
                  <input
                    value={newStaff.shiftHours}
                    required
                    placeholder="08:00 – 16:30"
                    onChange={(e) => setNewStaff({ ...newStaff, shiftHours: e.target.value })}
                  />
                </Field>
                <Field label="Максимум слотов/сеансов в день" required>
                  <input
                    type="number"
                    min={1}
                    max={30}
                    value={newStaff.maxSlotsPerDay}
                    required
                    onChange={(e) => setNewStaff({ ...newStaff, maxSlotsPerDay: Number(e.target.value) })}
                  />
                </Field>
              </div>

              <div
                style={{
                  display: 'flex',
                  justifyContent: 'flex-end',
                  gap: 10,
                  marginTop: 20,
                  paddingTop: 16,
                  borderTop: '1px solid var(--line)',
                }}
              >
                <Button type="button" variant="secondary" onClick={() => setStaffModalOpen(false)}>
                  Отмена
                </Button>
                <Button type="submit" variant="primary">
                  Сохранить сотрудника
                </Button>
              </div>
            </form>
          </Modal>
        </Card>
      )}

      {/* TAB: Quality & NPS Control */}
      {activeTab === 'quality' && (
        <>
          {/* KPI Summary Cards */}
          <div className="grid kpi-grid">
            <StatCard
              label="Средняя оценка гостей"
              value={qualityStats ? `${qualityStats.averageOverall.toFixed(2)} ★` : '—'}
              subvalue="Общий индекс удовлетворённости (CSAT)"
              color="c-teal"
            />
            <StatCard
              label="Индекс NPS (лояльность)"
              value={
                qualityStats
                  ? `${qualityStats.npsIndex > 0 ? '+' : ''}${qualityStats.npsIndex}%`
                  : '—'
              }
              subvalue={`Промоутеры: ${qualityStats?.promotersCount ?? 0} | Нейтралы: ${qualityStats?.passivesCount ?? 0} | Детракторы: ${qualityStats?.detractorsCount ?? 0}`}
              color="c-blue"
            />
            <StatCard
              label="Всего отзывов"
              value={String(qualityStats?.totalReviews || 0)}
              subvalue="100% верифицированы по путёвкам (+50 баллов)"
              color="default"
            />
            <StatCard
              label="Оценка медблока"
              value={qualityStats ? `${qualityStats.categoryAverages.treatment.toFixed(2)} ★` : '—'}
              subvalue="Процедуры, врачи и оздоровительные курсы"
              color="c-amber"
            />
          </div>

          {/* Diagnostic Breakdown: Categories & Star distribution & Top procedures */}
          <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: 20, marginBottom: 24 }}>
            {/* Aspect & Stars Breakdown Card */}
            <Card
              title="Оценки направлений и звёздность"
              subtitle="Аналитика удовлетворённости гостей по ключевым зонам сервиса"
            >
              {qualityStats && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, fontSize: '0.88rem' }}>
                      <span style={{ fontWeight: 600 }}>Номерной фонд и комфорт</span>
                      <strong style={{ color: 'var(--accent)' }}>{qualityStats.categoryAverages.room.toFixed(1)} / 5.0</strong>
                    </div>
                    <div className="rating-progress-bar">
                      <div
                        className="rating-progress-fill"
                        style={{ width: `${(qualityStats.categoryAverages.room / 5) * 100}%` }}
                      />
                    </div>
                  </div>

                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, fontSize: '0.88rem' }}>
                      <span style={{ fontWeight: 600 }}>Лечение и процедуры</span>
                      <strong style={{ color: 'var(--accent)' }}>{qualityStats.categoryAverages.treatment.toFixed(1)} / 5.0</strong>
                    </div>
                    <div className="rating-progress-bar">
                      <div
                        className="rating-progress-fill"
                        style={{ width: `${(qualityStats.categoryAverages.treatment / 5) * 100}%` }}
                      />
                    </div>
                  </div>

                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, fontSize: '0.88rem' }}>
                      <span style={{ fontWeight: 600 }}>Питание и диет-столы</span>
                      <strong style={{ color: 'var(--accent)' }}>{qualityStats.categoryAverages.food.toFixed(1)} / 5.0</strong>
                    </div>
                    <div className="rating-progress-bar">
                      <div
                        className="rating-progress-fill"
                        style={{ width: `${(qualityStats.categoryAverages.food / 5) * 100}%` }}
                      />
                    </div>
                  </div>

                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, fontSize: '0.88rem' }}>
                      <span style={{ fontWeight: 600 }}>Сервис, ресепшн и забота</span>
                      <strong style={{ color: 'var(--accent)' }}>{qualityStats.categoryAverages.service.toFixed(1)} / 5.0</strong>
                    </div>
                    <div className="rating-progress-bar">
                      <div
                        className="rating-progress-fill"
                        style={{ width: `${(qualityStats.categoryAverages.service / 5) * 100}%` }}
                      />
                    </div>
                  </div>

                  <hr style={{ border: 'none', borderTop: '1px solid var(--line)', margin: '10px 0' }} />

                  {/* Star Distribution */}
                  <div style={{ fontSize: '0.84rem' }}>
                    <div style={{ fontWeight: 700, marginBottom: 8, color: 'var(--text-muted)' }}>
                      РАСПРЕДЕЛЕНИЕ ОЦЕНОК ПО ЗВЁЗДАМ:
                    </div>
                    {[5, 4, 3, 2, 1].map((stars) => {
                      const count = qualityStats.ratingsDistribution[stars as keyof typeof qualityStats.ratingsDistribution] || 0;
                      const pct = qualityStats.totalReviews > 0 ? (count / qualityStats.totalReviews) * 100 : 0;
                      return (
                        <div key={stars} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                          <span style={{ width: 45, fontWeight: 600, color: '#f59e0b' }}>{stars} ★</span>
                          <div className="rating-progress-bar" style={{ flex: 1, height: 8 }}>
                            <div
                              className="rating-progress-fill"
                              style={{ width: `${pct}%`, background: stars >= 4 ? 'var(--ok)' : stars === 3 ? '#f59e0b' : 'var(--danger)' }}
                            />
                          </div>
                          <span style={{ width: 36, textAlign: 'right', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                            {count}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </Card>

            {/* Top Procedures Card */}
            <Card
              title="Рейтинг медицинских процедур"
              subtitle="Оценки процедур на основе непосредственных отзывов пациентов"
            >
              {qualityStats && (
                <TableWrap>
                  <table>
                    <thead>
                      <tr>
                        <th>Процедура</th>
                        <th>Средняя оценка</th>
                        <th>Отзывов</th>
                        <th>Статус</th>
                      </tr>
                    </thead>
                    <tbody>
                      {qualityStats.topRatedProcedures.map((proc, idx) => (
                        <tr key={idx}>
                          <td>
                            <strong>{proc.name}</strong>
                          </td>
                          <td>
                            <span style={{ color: '#f59e0b', fontWeight: 700, fontSize: '0.94rem' }}>
                              ★ {proc.avgRating.toFixed(1)}
                            </span>
                          </td>
                          <td>{proc.reviewCount} оценок</td>
                          <td>
                            {proc.avgRating >= 4.8 ? (
                              <Badge variant="good">Хит оздоровления</Badge>
                            ) : proc.avgRating >= 4.2 ? (
                              <Badge variant="neutral">Стабильный спрос</Badge>
                            ) : (
                              <Badge variant="warning">Требует внимания</Badge>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </TableWrap>
              )}
            </Card>
          </div>

          {/* Feedback Feed & Responses Card */}
          <Card
            title="Отзывы гостей и ответы администрации"
            subtitle="Мониторинг впечатлений пациентов с возможностью официального ответа руководства"
          >
            {/* Filter toolbar */}
            <div className="filter-toolbar" style={{ marginBottom: 16 }}>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <Button
                  variant={qualityFilter === 'ALL' ? 'primary' : 'secondary'}
                  size="sm"
                  onClick={() => setQualityFilter('ALL')}
                >
                  Все отзывы ({guestReviews.length})
                </Button>
                <Button
                  variant={qualityFilter === 'ATTENTION' ? 'primary' : 'secondary'}
                  size="sm"
                  onClick={() => setQualityFilter('ATTENTION')}
                  style={attentionReviewsCount > 0 && qualityFilter !== 'ATTENTION' ? { borderColor: 'var(--warn)', color: 'var(--warn)' } : undefined}
                >
                  ⚠️ Требуют внимания ({attentionReviewsCount})
                </Button>
                <Button
                  variant={qualityFilter === '5' ? 'primary' : 'secondary'}
                  size="sm"
                  onClick={() => setQualityFilter('5')}
                >
                  ★★★★★ (5 звёзд)
                </Button>
                <Button
                  variant={qualityFilter === '4' ? 'primary' : 'secondary'}
                  size="sm"
                  onClick={() => setQualityFilter('4')}
                >
                  ★★★★☆ (4 звезды)
                </Button>
                <Button
                  variant={qualityFilter === '3' ? 'primary' : 'secondary'}
                  size="sm"
                  onClick={() => setQualityFilter('3')}
                >
                  ★★★☆☆ (3 звезды и ниже)
                </Button>
              </div>
            </div>

            {/* List of guest reviews */}
            {filteredGuestReviews.length === 0 ? (
              <EmptyState
                title="Отзывы не найдены"
                description="По выбранному фильтру отзывов пока нет."
              />
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                {filteredGuestReviews.map((rev) => {
                  const isDetractor = rev.npsScore <= 6;
                  const isPromoter = rev.npsScore >= 9;
                  return (
                    <div key={rev.id} className="quality-review-card">
                      {/* Review Header */}
                      <div className="quality-review-header">
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                          <span style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text)' }}>
                            {rev.clientName}
                          </span>
                          <span style={{ fontSize: '0.84rem', color: 'var(--text-muted)' }}>
                            ({rev.categoryName} {rev.roomNumber ? `• комн. ${rev.roomNumber}` : ''})
                          </span>
                          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                            {rev.stayDates}
                          </span>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                          <span
                            className="quality-star-badge"
                            title={`Оценка: ${rev.overallRating} из 5`}
                          >
                            {'★'.repeat(rev.overallRating)}{'☆'.repeat(5 - rev.overallRating)} ({rev.overallRating}.0)
                          </span>
                          <span
                            className={`nps-pill ${isPromoter ? 'nps-promoter' : isDetractor ? 'nps-detractor' : 'nps-passive'}`}
                            title="Net Promoter Score"
                          >
                            NPS: {rev.npsScore}/10 ({isPromoter ? 'Промоутер' : isDetractor ? 'Детрактор' : 'Нейтрал'})
                          </span>
                          <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                            {formatDateTime(rev.createdAt)}
                          </span>
                        </div>
                      </div>

                      {/* Criteria Scores */}
                      <div className="quality-criteria-row">
                        <span className="quality-criterion-pill">
                          Номер: <strong>{rev.categoriesRating.room}★</strong>
                        </span>
                        <span className="quality-criterion-pill">
                          Лечение: <strong>{rev.categoriesRating.treatment}★</strong>
                        </span>
                        <span className="quality-criterion-pill">
                          Питание: <strong>{rev.categoriesRating.food}★</strong>
                        </span>
                        <span className="quality-criterion-pill">
                          Сервис: <strong>{rev.categoriesRating.service}★</strong>
                        </span>
                      </div>

                      {/* Procedures feedback tags */}
                      {rev.procedureFeedback && rev.procedureFeedback.length > 0 && (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 10 }}>
                          {rev.procedureFeedback.map((pf, pIdx) => (
                            <span key={pIdx} className="procedure-feedback-tag">
                              🩺 <strong>{pf.procedureName}</strong>: ★{pf.rating}
                              {pf.comment ? ` — «${pf.comment}»` : ''}
                            </span>
                          ))}
                        </div>
                      )}

                      {/* Guest Comment */}
                      <div className="quality-review-comment">
                        «{rev.comment}»
                      </div>

                      {/* Management Response or Reply Button */}
                      {rev.managementResponse ? (
                        <div className="quality-reply-box">
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                              <span style={{ fontSize: '0.9rem' }}>💬</span>
                              <strong style={{ fontSize: '0.86rem', color: 'var(--accent)' }}>
                                {rev.managementResponse.replierName}
                              </strong>
                              <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                                ({formatDateTime(rev.managementResponse.repliedAt)})
                              </span>
                            </div>
                            <Button
                              variant="secondary"
                              size="sm"
                              onClick={() => {
                                setReplyReviewModal(rev);
                                setReplyText(rev.managementResponse?.replyText || '');
                                setReplyReplierName(rev.managementResponse?.replierName || 'Служба заботы о гостях');
                              }}
                            >
                              Редактировать ответ
                            </Button>
                          </div>
                          <p style={{ margin: 0, fontSize: '0.88rem', color: 'var(--text)' }}>
                            {rev.managementResponse.replyText}
                          </p>
                        </div>
                      ) : (
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 12, paddingTop: 10, borderTop: '1px dashed var(--line)' }}>
                          <span style={{ fontSize: '0.82rem', color: 'var(--warn)', fontWeight: 600 }}>
                            ⚠️ Ожидает официального ответа санатория
                          </span>
                          <Button
                            variant="primary"
                            size="sm"
                            onClick={() => {
                              setReplyReviewModal(rev);
                              setReplyText('');
                              setReplyReplierName('Служба заботы о гостях');
                            }}
                          >
                            💬 Ответить гостю
                          </Button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </Card>

          {/* Reply Modal */}
          {replyReviewModal && (
            <Modal
              isOpen={Boolean(replyReviewModal)}
              onClose={() => setReplyReviewModal(null)}
              title="Официальный ответ на отзыв гостя"
              size="md"
            >
              <form onSubmit={handleSendReply}>
                <div style={{ background: 'var(--bg-subtle)', padding: 12, borderRadius: 'var(--radius-md)', marginBottom: 14 }}>
                  <div style={{ fontWeight: 650, fontSize: '0.88rem', marginBottom: 4 }}>
                    Отзыв от: {replyReviewModal.clientName} (★ {replyReviewModal.overallRating}.0, NPS {replyReviewModal.npsScore}/10)
                  </div>
                  <div style={{ fontSize: '0.84rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                    «{replyReviewModal.comment}»
                  </div>
                </div>

                <Field label="Подпись / Должность ответственного лица" required>
                  <input
                    value={replyReplierName}
                    required
                    placeholder="Главный врач Воронова С.М."
                    onChange={(e) => setReplyReplierName(e.target.value)}
                  />
                </Field>

                <Field label="Текст официального ответа гостю" required>
                  <textarea
                    rows={4}
                    value={replyText}
                    required
                    placeholder="Уважаемый(ая) ..., благодарим вас за обратную связь..."
                    onChange={(e) => setReplyText(e.target.value)}
                  />
                </Field>

                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'flex-end',
                    gap: 10,
                    marginTop: 16,
                    paddingTop: 14,
                    borderTop: '1px solid var(--line)',
                  }}
                >
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => setReplyReviewModal(null)}
                    disabled={replyBusy}
                  >
                    Отмена
                  </Button>
                  <Button type="submit" variant="primary" disabled={replyBusy || !replyText.trim()}>
                    {replyBusy ? 'Публикация…' : 'Опубликовать ответ'}
                  </Button>
                </div>
              </form>
            </Modal>
          )}
        </>
      )}

      {/* TAB 6: Demand Forecast (AI/ML) */}
      {activeTab === 'forecast' && (
        <Card
          title="Прогнозирование спроса на категории номеров"
          subtitle="Модель машинного обучения прогнозирует загрузку на следующие 60 дней"
        >
          <div className="filter-toolbar">
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
              <Field label="Категория номера" style={{ margin: 0, minWidth: 260 }}>
                <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} (вместимость {c.capacityTotal} чел.)
                    </option>
                  ))}
                </select>
              </Field>

              <Button
                variant="primary"
                onClick={() => void runForecast()}
                disabled={!categoryId || forecastLoading}
                style={{ alignSelf: 'flex-end' }}
              >
                {forecastLoading ? 'Построение прогноза…' : 'Пересчитать прогноз (ML)'}
              </Button>
            </div>

            {forecastResult && (
              <div
                style={{
                  background: 'var(--accent-soft)',
                  border: '1px solid var(--line)',
                  borderRadius: 'var(--radius-md)',
                  padding: '8px 14px',
                  fontSize: '0.85rem',
                  color: 'var(--accent)',
                }}
              >
                Прогон #{forecastResult.run_id} • Точек: {forecastResult.points} • MAPE:{' '}
                <strong>
                  {forecastResult.mape != null && !isNaN(Number(forecastResult.mape))
                    ? `${Number(forecastResult.mape).toFixed(1)}%`
                    : 'н/д'}
                </strong>
              </div>
            )}
          </div>

          <div style={{ marginTop: 20 }}>
            <h4 style={{ margin: '0 0 10px', fontSize: '1rem', fontWeight: 700 }}>
              График динамики прогнозируемой загрузки: {activeCategory?.name ?? ''}
            </h4>
            <ForecastChart points={forecast} />
          </div>
        </Card>
      )}

      {/* TAB 7: Pricing Corridors & AI Reviews */}
      {activeTab === 'rules' && (
        <>
          <Card
            title="Согласование рекомендаций динамического ценообразования"
            subtitle="Рекомендации ИИ при изменении рыночного спроса и загрузки"
            actions={
              <div className="tabs" style={{ margin: 0 }}>
                <button
                  type="button"
                  className={`tab ${reviewFilter === 'PENDING_REVIEW' ? 'active' : ''}`}
                  onClick={() => setReviewFilter('PENDING_REVIEW')}
                >
                  Требуют решения
                </button>
                <button
                  type="button"
                  className={`tab ${reviewFilter === 'ALL' ? 'active' : ''}`}
                  onClick={() => setReviewFilter('ALL')}
                >
                  Все рекомендации
                </button>
              </div>
            }
          >
            <TableWrap>
              <table>
                <thead>
                  <tr>
                    <th>Дата создания</th>
                    <th>Категория</th>
                    <th>Дата заезда</th>
                    <th>Рекомендовано ИИ</th>
                    <th>Применено</th>
                    <th>Разница</th>
                    <th>Коридор [Pmin — Pmax]</th>
                    <th>Статус</th>
                    <th style={{ textAlign: 'right' }}>Действия</th>
                  </tr>
                </thead>
                <tbody>
                  {reviews.length === 0 ? (
                    <tr>
                      <td colSpan={9}>
                        <EmptyState
                          title="Рекомендаций не найдено"
                          description="Все тарифы соответствуют текущим рыночным правилам и коридорам цен."
                        />
                      </td>
                    </tr>
                  ) : (
                    reviews.map((r) => {
                      const delta = r.price_recommended - r.price_applied;
                      const cat = categories.find((c) => c.id === r.category_id);
                      return (
                        <tr key={r.id}>
                          <td>{formatDateTime(r.created_at)}</td>
                          <td>
                            <strong>{cat?.name ?? `Категория #${r.category_id}`}</strong>
                          </td>
                          <td>{r.stay_date}</td>
                          <td style={{ fontWeight: 700, color: 'var(--accent)' }}>
                            {money(r.price_recommended)}
                          </td>
                          <td>{money(r.price_applied)}</td>
                          <td>
                            {delta > 0 ? (
                              <span style={{ color: 'var(--ok)', fontWeight: 600 }}>+{money(delta)}</span>
                            ) : (
                              <span style={{ color: 'var(--danger)', fontWeight: 600 }}>{money(delta)}</span>
                            )}
                          </td>
                          <td>
                            {money(r.p_min)} — {money(r.p_max)}
                          </td>
                          <td>
                            <StatusBadge status={r.status} />
                          </td>
                          <td style={{ textAlign: 'right' }} className="actions">
                            {r.status === 'PENDING_REVIEW' && (
                              <div style={{ display: 'inline-flex', gap: 6 }}>
                                <Button
                                  variant="primary"
                                  size="sm"
                                  onClick={() => void handleDecide(r.id, 'ACKNOWLEDGE')}
                                >
                                  Принять
                                </Button>
                                <Button
                                  variant="secondary"
                                  size="sm"
                                  onClick={() => void handleDecide(r.id, 'RULE_ADJUSTED')}
                                >
                                  Изменить
                                </Button>
                              </div>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </TableWrap>
          </Card>

          {/* Modal: Set Price Corridor */}
          <Modal
            isOpen={ruleModalOpen}
            onClose={() => setRuleModalOpen(false)}
            title="Установка ценового коридора"
            size="md"
          >
            <form onSubmit={(e) => void saveCorridor(e)}>
              <Field label="Категория номера" required>
                <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} required>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </Field>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                <Field label="Период с" required>
                  <input
                    type="date"
                    value={rule.from}
                    required
                    onChange={(e) => setRule({ ...rule, from: e.target.value })}
                  />
                </Field>
                <Field label="Период по" required>
                  <input
                    type="date"
                    value={rule.to}
                    required
                    onChange={(e) => setRule({ ...rule, to: e.target.value })}
                  />
                </Field>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                <Field label="Мин. цена (P_min), BYN" required>
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    placeholder="50.00"
                    value={rule.pMin}
                    required
                    onChange={(e) => setRule({ ...rule, pMin: e.target.value })}
                  />
                </Field>
                <Field label="Макс. цена (P_max), BYN" required>
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    placeholder="250.00"
                    value={rule.pMax}
                    required
                    onChange={(e) => setRule({ ...rule, pMax: e.target.value })}
                  />
                </Field>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                <Field label="Мин. срок заезда (Min LOS, ночей)" required>
                  <input
                    type="number"
                    min={1}
                    value={rule.minLos}
                    required
                    onChange={(e) => setRule({ ...rule, minLos: e.target.value })}
                  />
                </Field>
                <div style={{ display: 'flex', alignItems: 'center', marginTop: 24 }}>
                  <label className="check">
                    <input
                      type="checkbox"
                      checked={rule.closed}
                      onChange={(e) => setRule({ ...rule, closed: e.target.checked })}
                    />
                    <span>Закрыть продажу на период</span>
                  </label>
                </div>
              </div>

              <div
                style={{
                  display: 'flex',
                  justifyContent: 'flex-end',
                  gap: 10,
                  marginTop: 20,
                  paddingTop: 16,
                  borderTop: '1px solid var(--line)',
                }}
              >
                <Button type="button" variant="secondary" onClick={() => setRuleModalOpen(false)}>
                  Отмена
                </Button>
                <Button type="submit" variant="primary">
                  Сохранить коридор
                </Button>
              </div>
            </form>
          </Modal>
        </>
      )}
    </section>
  );
}
