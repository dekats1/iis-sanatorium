import { useMemo, useState, type FormEvent } from 'react';
import { reviews as guestReviewsApi } from '../../api/endpoints';
import { Badge, Button, Card, EmptyState, ErrorBox, Field, formatDateTime, Modal, Pagination, Skeleton, SkeletonRows, StatCard, useToast } from '../ui';
import { DataTable, type Column } from '../DataTable';
import { Icon } from '../icons';
import type { GuestReview, ReviewQualityStats } from '../../types';
import { ShareBar } from './charts';

type QualityFilter = 'ALL' | 'ATTENTION' | '5' | '4' | '3';
type TopProc = ReviewQualityStats['topRatedProcedures'][number];

const needsAttention = (r: GuestReview) => r.overallRating <= 3 || r.npsScore <= 6 || !r.managementResponse;
const PAGE = 10;
const DEFAULT_REPLIER = 'Служба заботы о гостях';

function Rating({ value }: { value: number }) {
  return (
    <span className="mgr-rating">
      <Icon name="star" size={14} />
      {value.toFixed(1)}
    </span>
  );
}

export default function QualityTab({
  stats,
  onStatsChange,
  reviews,
  onReviewsChange,
  loading,
}: {
  stats: ReviewQualityStats | null;
  onStatsChange: (s: ReviewQualityStats) => void;
  reviews: GuestReview[];
  onReviewsChange: (fn: (prev: GuestReview[]) => GuestReview[]) => void;
  loading: boolean;
}) {
  const toast = useToast();
  const [filter, setFilter] = useState<QualityFilter>('ALL');
  const [page, setPage] = useState(1);
  const [target, setTarget] = useState<GuestReview | null>(null);
  const [replyText, setReplyText] = useState('');
  const [replier, setReplier] = useState(DEFAULT_REPLIER);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);

  const attention = useMemo(() => reviews.filter(needsAttention).length, [reviews]);
  const filtered = useMemo(
    () =>
      reviews.filter((r) => {
        if (filter === 'ATTENTION') return needsAttention(r);
        if (filter === '5') return r.overallRating === 5;
        if (filter === '4') return r.overallRating === 4;
        if (filter === '3') return r.overallRating <= 3;
        return true;
      }),
    [reviews, filter],
  );
  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE));
  const pageRows = filtered.slice((Math.min(page, pageCount) - 1) * PAGE, Math.min(page, pageCount) * PAGE);

  const openReply = (rev: GuestReview) => {
    setError(null);
    setTarget(rev);
    setReplyText(rev.managementResponse?.replyText ?? '');
    setReplier(rev.managementResponse?.replierName ?? DEFAULT_REPLIER);
  };

  async function sendReply(e: FormEvent) {
    e.preventDefault();
    if (!target || !replyText.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const updated = await guestReviewsApi.reply(target.id, replyText, replier);
      onReviewsChange((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
      onStatsChange(await guestReviewsApi.stats());
      setTarget(null);
      setReplyText('');
      toast.success('Ответ на отзыв опубликован.');
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  }

  const procColumns: Column<TopProc>[] = [
    { key: 'name', header: 'Процедура', render: (p) => <strong>{p.name}</strong>, sortValue: (p) => p.name, className: 'wrap' },
    { key: 'avg', header: 'Оценка', align: 'right', render: (p) => <Rating value={p.avgRating} />, sortValue: (p) => p.avgRating },
    { key: 'count', header: 'Отзывов', align: 'right', render: (p) => p.reviewCount, sortValue: (p) => p.reviewCount },
    {
      key: 'status',
      header: 'Статус',
      render: (p) =>
        p.avgRating >= 4.8 ? (
          <Badge variant="good" icon="star">Хит</Badge>
        ) : p.avgRating >= 4.2 ? (
          <Badge variant="neutral">Стабильно</Badge>
        ) : (
          <Badge variant="wait" icon="alertTriangle">Требует внимания</Badge>
        ),
    },
  ];

  const aspects = stats
    ? [
        { label: 'Номерной фонд и комфорт', value: stats.categoryAverages.room },
        { label: 'Лечение и процедуры', value: stats.categoryAverages.treatment },
        { label: 'Питание и диетические столы', value: stats.categoryAverages.food },
        { label: 'Сервис и ресепшн', value: stats.categoryAverages.service },
      ]
    : [];

  const chips: { id: QualityFilter; label: string }[] = [
    { id: 'ALL', label: `Все (${reviews.length})` },
    { id: 'ATTENTION', label: `Требуют внимания (${attention})` },
    { id: '5', label: '5 звёзд' },
    { id: '4', label: '4 звезды' },
    { id: '3', label: '3 и ниже' },
  ];

  return (
    <div className="u-stack-16">
      <div className="kpi-grid u-m0">
        <StatCard label="Средняя оценка гостей" value={stats ? `${stats.averageOverall.toFixed(2)} / 5` : '—'} subvalue="Индекс удовлетворённости (CSAT)" color="c-teal" icon={<Icon name="star" size={20} />} />
        <StatCard
          label="Индекс NPS"
          value={stats ? `${stats.npsIndex > 0 ? '+' : ''}${stats.npsIndex}%` : '—'}
          subvalue={`Промоутеры ${stats?.promotersCount ?? 0} · нейтралы ${stats?.passivesCount ?? 0} · критики ${stats?.detractorsCount ?? 0}`}
          color="c-blue"
          icon={<Icon name="heart" size={20} />}
        />
        <StatCard label="Всего отзывов" value={stats?.totalReviews ?? 0} subvalue="Верифицированы по путёвкам" icon={<Icon name="inbox" size={20} />} />
        <StatCard label="Требуют внимания" value={attention} subvalue="Низкая оценка, NPS ≤ 6 или нет ответа" color={attention > 0 ? 'c-amber' : 'c-teal'} icon={<Icon name="alertTriangle" size={20} />} />
      </div>

      <div className="grid">
        <Card title="Оценки по направлениям" subtitle="Средний балл по ключевым зонам сервиса">
          {loading || !stats ? (
            <SkeletonRows rows={5} />
          ) : (
            <div className="u-stack-12">
              {aspects.map((a) => (
                <div key={a.label}>
                  <div className="u-between u-mb-4 u-text-sm">
                    <span className="u-semibold">{a.label}</span>
                    <strong className="u-accent">{a.value.toFixed(1)} / 5</strong>
                  </div>
                  <ShareBar value={(a.value / 5) * 100} label={a.label} />
                </div>
              ))}
              <div className="mgr-label u-mt-12">Распределение оценок</div>
              {[5, 4, 3, 2, 1].map((s) => {
                const c = stats.ratingsDistribution[s as keyof ReviewQualityStats['ratingsDistribution']] || 0;
                const pct = stats.totalReviews > 0 ? (c / stats.totalReviews) * 100 : 0;
                return (
                  <div key={s} className="mgr-dist-row">
                    <span className="mgr-rating">
                      <Icon name="star" size={14} />
                      {s}
                    </span>
                    <ShareBar value={pct} tone={s >= 4 ? 'ok' : s === 3 ? 'warn' : 'danger'} label={`${s} звёзд: ${c}`} />
                    <span className="u-muted-sm u-right">{c}</span>
                  </div>
                );
              })}
            </div>
          )}
        </Card>

        <Card title="Рейтинг процедур" subtitle="По отзывам пациентов">
          <DataTable
            rows={stats?.topRatedProcedures ?? []}
            columns={procColumns}
            rowKey={(p) => p.name}
            label="Рейтинг медицинских процедур"
            loading={loading}
            dense
            initialSort={{ key: 'avg', dir: 'desc' }}
            emptyTitle="Оценок процедур пока нет"
          />
        </Card>
      </div>

      <Card title="Отзывы гостей и ответы администрации" subtitle="Впечатления пациентов и официальные ответы санатория">
        <div className="chip-row u-mb-16" role="group" aria-label="Фильтр отзывов">
          {chips.map((c) => (
            <button
              key={c.id}
              type="button"
              className="chip"
              aria-pressed={filter === c.id}
              onClick={() => {
                setFilter(c.id);
                setPage(1);
              }}
            >
              {c.id === 'ATTENTION' && <Icon name="alertTriangle" size={16} />}
              {c.label}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="u-stack-12">
            <Skeleton height={140} />
            <Skeleton height={140} />
          </div>
        ) : pageRows.length === 0 ? (
          <EmptyState
            title="Отзывы не найдены"
            description="По выбранному фильтру отзывов нет."
            action={filter !== 'ALL' ? <Button variant="secondary" onClick={() => setFilter('ALL')}>Показать все</Button> : undefined}
          />
        ) : (
          <ul className="u-stack-12 mgr-reviews">
            {pageRows.map((rev) => {
              const promoter = rev.npsScore >= 9;
              const detractor = rev.npsScore <= 6;
              return (
                <li key={rev.id} className="mgr-review">
                  <div className="mgr-review-head">
                    <div>
                      <strong>{rev.clientName}</strong>
                      <div className="u-muted-sm">
                        {rev.categoryName}
                        {rev.roomNumber ? ` · комн. ${rev.roomNumber}` : ''} · {rev.stayDates}
                      </div>
                    </div>
                    <div className="chip-row">
                      <Badge variant={rev.overallRating >= 4 ? 'good' : rev.overallRating === 3 ? 'wait' : 'bad'} icon="star">
                        {rev.overallRating} из 5
                      </Badge>
                      <Badge variant={promoter ? 'good' : detractor ? 'bad' : 'neutral'} title="Net Promoter Score">
                        NPS {rev.npsScore}/10 · {promoter ? 'промоутер' : detractor ? 'критик' : 'нейтрал'}
                      </Badge>
                      <span className="u-muted-sm">{formatDateTime(rev.createdAt)}</span>
                    </div>
                  </div>

                  <div className="mgr-criteria">
                    <span>Номер: <strong>{rev.categoriesRating.room}</strong></span>
                    <span>Лечение: <strong>{rev.categoriesRating.treatment}</strong></span>
                    <span>Питание: <strong>{rev.categoriesRating.food}</strong></span>
                    <span>Сервис: <strong>{rev.categoriesRating.service}</strong></span>
                  </div>

                  {rev.procedureFeedback && rev.procedureFeedback.length > 0 && (
                    <ul className="chip-row mgr-proc-feedback">
                      {rev.procedureFeedback.map((pf, i) => (
                        <li key={i}>
                          <Icon name="stethoscope" size={16} /> <strong>{pf.procedureName}</strong>: {pf.rating}
                          {pf.comment ? ` — «${pf.comment}»` : ''}
                        </li>
                      ))}
                    </ul>
                  )}

                  <blockquote className="mgr-quote">«{rev.comment}»</blockquote>

                  {rev.managementResponse ? (
                    <div className="mgr-reply">
                      <div className="u-between">
                        <span className="u-flex-center">
                          <Icon name="mail" size={16} />
                          <strong className="u-accent">{rev.managementResponse.replierName}</strong>
                          <span className="u-muted-sm">{formatDateTime(rev.managementResponse.repliedAt)}</span>
                        </span>
                        <Button variant="ghost" size="sm" icon={<Icon name="edit" size={16} />} onClick={() => openReply(rev)}>
                          Редактировать ответ
                        </Button>
                      </div>
                      <p className="u-m0 u-mt-4">{rev.managementResponse.replyText}</p>
                    </div>
                  ) : (
                    <div className="mgr-review-foot">
                      <Badge variant="wait" icon="clock">Ожидает ответа санатория</Badge>
                      <Button variant="primary" size="sm" icon={<Icon name="mail" size={16} />} onClick={() => openReply(rev)}>
                        Ответить гостю
                      </Button>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
        <Pagination page={Math.min(page, pageCount)} pageCount={pageCount} onChange={setPage} />
      </Card>

      <Modal
        isOpen={Boolean(target)}
        onClose={() => setTarget(null)}
        title="Официальный ответ на отзыв"
        size="md"
        footer={
          <>
            <Button type="button" variant="secondary" onClick={() => setTarget(null)} disabled={busy}>
              Отмена
            </Button>
            <Button type="submit" form="mgr-reply-form" variant="primary" loading={busy} disabled={!replyText.trim()}>
              Опубликовать ответ
            </Button>
          </>
        }
      >
        {target && (
          <form id="mgr-reply-form" onSubmit={(e) => void sendReply(e)}>
            <div className="mgr-reply-source">
              <div className="u-semibold">
                {target.clientName} · оценка {target.overallRating} из 5 · NPS {target.npsScore}/10
              </div>
              <p className="u-muted u-m0 u-mt-4">«{target.comment}»</p>
            </div>
            <Field label="Подпись / должность" required>
              <input value={replier} required placeholder="Главный врач Воронова С. М." onChange={(e) => setReplier(e.target.value)} />
            </Field>
            <Field label="Текст ответа" required>
              <textarea rows={5} value={replyText} required placeholder="Благодарим вас за обратную связь…" onChange={(e) => setReplyText(e.target.value)} />
            </Field>
            <ErrorBox error={error} />
          </form>
        )}
      </Modal>
    </div>
  );
}
