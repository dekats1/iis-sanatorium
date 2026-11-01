import { useEffect, useState, type FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { booking, clients, directory, loyalty } from '../api/endpoints';
import {
  Badge,
  Button,
  Card,
  ErrorBox,
  Field,
  money,
  StatusBadge,
} from '../components/ui';
import { useAuth } from '../hooks/useAuth';
import PhotoGalleryModal from '../components/PhotoGalleryModal';
import { CATEGORY_MEDIA } from '../api/interactiveMapAndRecommendations';
import type { ClientView, Coded, LoyaltyAccount, RoomCategory, SalesChannel, VoucherView } from '../types';

export default function BookingPage() {
  const [params] = useSearchParams();
  const { hasRole } = useAuth();
  const isAdmin = hasRole('BOOKING_ADMIN');
  const categoryId = Number(params.get('category'));
  const checkIn = params.get('from') ?? '';
  const checkOut = params.get('to') ?? '';
  const places = Number(params.get('places') ?? 1);

  const [profiles, setProfiles] = useState<Coded[]>([]);
  const [diets, setDiets] = useState<Coded[]>([]);
  const [channels, setChannels] = useState<SalesChannel[]>([]);
  const [clientList, setClientList] = useState<ClientView[]>([]);
  const [categories, setCategories] = useState<RoomCategory[]>([]);
  const [isGalleryOpen, setIsGalleryOpen] = useState(false);
  const [profileId, setProfileId] = useState('');
  const [dietId, setDietId] = useState('');
  const [channelId, setChannelId] = useState('');
  const [clientId, setClientId] = useState(params.get('client') ?? '');
  const [voucher, setVoucher] = useState<VoucherView | null>(null);

  // Loyalty Program Integration
  const [loyaltyAcc, setLoyaltyAcc] = useState<LoyaltyAccount | null>(null);
  const [useBonuses, setUseBonuses] = useState(false);
  const [bonusPointsToApply, setBonusPointsToApply] = useState(0);

  const [error, setError] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    Promise.all([directory.profiles(), directory.diets(), directory.channels(), directory.categories()])
      .then(([p, d, c, cats]) => {
        setProfiles(p);
        setDiets(d);
        setChannels(c);
        setCategories(cats);
        if (p[0]) setProfileId(String(p[0].id));
        if (c[0]) setChannelId(String(c[0].id));
      })
      .catch(setError);

    if (isAdmin) {
      clients.search('').then(setClientList).catch(() => undefined);
    }
  }, [isAdmin]);

  // Load loyalty account for current user or selected client
  useEffect(() => {
    const targetClientId = isAdmin && clientId ? Number(clientId) : 1;
    loyalty
      .account(targetClientId)
      .then((acc) => {
        setLoyaltyAcc(acc);
        setBonusPointsToApply(Math.min(acc.balance, 100));
      })
      .catch(() => undefined);
  }, [isAdmin, clientId]);

  if (!categoryId || !checkIn || !checkOut) {
    return (
      <div className="card" style={{ maxWidth: 500, margin: '40px auto', textAlign: 'center' }}>
        <h3>Параметры бронирования не выбраны</h3>
        <p style={{ color: 'var(--text-muted)' }}>
          Пожалуйста, начните выбор номера со страницы поиска свободных мест.
        </p>
        <Link to="/search">
          <Button variant="primary">Перейти к поиску номеров</Button>
        </Link>
      </div>
    );
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const activeClientId = isAdmin && clientId ? Number(clientId) : undefined;
      const created = await booking.create({
        clientId: activeClientId,
        categoryId,
        checkIn,
        checkOut,
        places,
        profileId: Number(profileId),
        channelId: Number(channelId),
        dietId: dietId ? Number(dietId) : undefined,
      });

      // Apply loyalty bonuses if requested
      if (useBonuses && bonusPointsToApply > 0 && loyaltyAcc) {
        try {
          await loyalty.applyBonuses(
            activeClientId ?? loyaltyAcc.clientId,
            created.id,
            bonusPointsToApply
          );
        } catch {
          // ignore bonus deduction failure, voucher is still created
        }
      }

      setVoucher(created);

      // Redirect to payment emulator
      try {
        const p = await booking.pay(created.id);
        window.location.assign(p.payUrl);
        return;
      } catch (payErr) {
        setError(payErr);
      }
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  }

  async function pay() {
    if (!voucher) return;
    setError(null);
    try {
      const p = await booking.pay(voucher.id);
      window.location.assign(p.payUrl);
    } catch (err) {
      setError(err);
    }
  }

  return (
    <section>
      <div className="page-head">
        <div>
          <h1>Оформление путёвки в санаторий</h1>
          <p className="card-subtitle">
            Период проживания: с <strong>{checkIn}</strong> по <strong>{checkOut}</strong> (мест в заявке: <strong>{places}</strong>)
          </p>
        </div>
      </div>

      <ErrorBox error={error} />

      {!voucher ? (
        <form onSubmit={submit} style={{ maxWidth: 780, margin: '0 auto' }}>
          {/* Selected Room Photo Banner */}
          {categoryId && CATEGORY_MEDIA[categoryId] && (
            <>
              <div
                className="booking-room-banner"
                onClick={() => setIsGalleryOpen(true)}
                title="Нажмите, чтобы просмотреть все фотографии номера"
                style={{ cursor: 'pointer' }}
              >
                <img
                  src={CATEGORY_MEDIA[categoryId].cover}
                  alt=""
                  className="booking-room-banner-img"
                />
                <div className="booking-room-banner-overlay">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span className="booking-room-badge">
                      {params.get('room') ? `Выбран конкретный номер №${params.get('room')}` : 'Выбрана категория номера'}
                    </span>
                    <button
                      type="button"
                      className="booking-banner-photos-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        setIsGalleryOpen(true);
                      }}
                    >
                      📷 Все фото ({CATEGORY_MEDIA[categoryId].photos.length})
                    </button>
                  </div>
                  <h3 className="booking-room-title">
                    {categories.find((c) => c.id === categoryId)?.name || `Категория №${categoryId}`}
                  </h3>
                  <p className="booking-room-subtitle">
                    Период: {checkIn} — {checkOut} • Мест в номере: {places} • Нажмите для просмотра галереи
                  </p>
                </div>
              </div>

              {isGalleryOpen && (
                <PhotoGalleryModal
                  isOpen={isGalleryOpen}
                  onClose={() => setIsGalleryOpen(false)}
                  title={`Фотографии номера • ${categories.find((c) => c.id === categoryId)?.name || `Категория №${categoryId}`}`}
                  photos={CATEGORY_MEDIA[categoryId].photos}
                />
              )}
            </>
          )}

          <Card title="Параметры бронирования">
            {isAdmin && (
              <Field label="Гость (Клиент)" required>
                <select value={clientId} onChange={(e) => setClientId(e.target.value)} required>
                  <option value="">— Выберите гостя из базы —</option>
                  {clientList.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.lastName} {c.firstName} {c.middleName ?? ''} (род. {c.birthDate}, #{c.id})
                    </option>
                  ))}
                </select>
              </Field>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              <Field label="Лечебный профиль оздоровления" required>
                <select value={profileId} onChange={(e) => setProfileId(e.target.value)} required>
                  <option value="">— Выберите профиль —</option>
                  {profiles.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </Field>

              <Field label="Диетическое питание (Стол)">
                <select value={dietId} onChange={(e) => setDietId(e.target.value)}>
                  <option value="">Стандартное питание (Без диеты)</option>
                  {diets.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name} ({d.code})
                    </option>
                  ))}
                </select>
              </Field>
            </div>

            <Field label="Канал бронирования / Партнёр" required>
              <select value={channelId} onChange={(e) => setChannelId(e.target.value)} required>
                <option value="">— Выберите канал —</option>
                {channels.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} (комиссия {c.commissionPct}%)
                  </option>
                ))}
              </select>
            </Field>

            {/* Loyalty bonus redemption widget */}
            {loyaltyAcc && loyaltyAcc.balance > 0 && (
              <div
                style={{
                  background: 'var(--surface-alt)',
                  border: '1px solid var(--line-strong)',
                  borderRadius: 'var(--radius-md)',
                  padding: 16,
                  marginTop: 18,
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <label className="check" style={{ fontWeight: 700 }}>
                    <input
                      type="checkbox"
                      checked={useBonuses}
                      onChange={(e) => setUseBonuses(e.target.checked)}
                    />
                    <span>⭐ Списать бонусы программы лояльности</span>
                  </label>
                  <Badge variant="good">
                    Доступно: {loyaltyAcc.balance.toLocaleString('ru-RU')} баллов
                  </Badge>
                </div>

                {useBonuses && (
                  <div style={{ marginTop: 12, paddingLeft: 26 }}>
                    <p style={{ fontSize: '0.84rem', color: 'var(--text-muted)', margin: '0 0 8px' }}>
                      1 бонусный балл = 1 BYN скидки (можно оплатить до 30% суммы бронирования).
                    </p>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <input
                        type="number"
                        min={1}
                        max={loyaltyAcc.balance}
                        value={bonusPointsToApply}
                        onChange={(e) =>
                          setBonusPointsToApply(
                            Math.min(loyaltyAcc.balance, Math.max(0, Number(e.target.value)))
                          )
                        }
                        style={{ width: 140 }}
                      />
                      <span style={{ fontWeight: 600, color: 'var(--accent)' }}>
                        Скидка: -{money(bonusPointsToApply)}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            )}

            <div
              style={{
                display: 'flex',
                justifyContent: 'flex-end',
                gap: 12,
                marginTop: 24,
                paddingTop: 16,
                borderTop: '1px solid var(--line)',
              }}
            >
              <Link to="/search">
                <Button type="button" variant="secondary">
                  Назад к поиску
                </Button>
              </Link>
              <Button
                type="submit"
                variant="primary"
                disabled={busy || !profileId || !channelId || (isAdmin && !clientId)}
              >
                {busy ? 'Оформление…' : 'Забронировать и перейти к оплате'}
              </Button>
            </div>
          </Card>
        </form>
      ) : (
        <Card
          title={`Путёвка #${voucher.id} успешно сформирована`}
          subtitle="Заявка зафиксирована в системе бронирования"
          style={{ maxWidth: 640, margin: '0 auto' }}
        >
          <dl style={{ margin: '16px 0 24px', fontSize: '0.95rem' }}>
            <dt>Статус:</dt>
            <dd>
              <StatusBadge status={voucher.status} />
            </dd>
            <dt>Номер комнаты:</dt>
            <dd>{voucher.roomNumber ? `№ ${voucher.roomNumber}` : 'Будет назначен при заезде'}</dd>
            <dt>Тариф в сутки:</dt>
            <dd>{money(voucher.pricePerPlaceDay, voucher.currency ?? 'BYN')}</dd>
            <dt>Итого к оплате:</dt>
            <dd style={{ color: 'var(--accent)', fontWeight: 800, fontSize: '1.2rem' }}>
              {money(voucher.totalPrice, voucher.currency ?? 'BYN')}
            </dd>
          </dl>

          {voucher.status === 'AWAITING_PAYMENT' && (
            <div
              style={{
                background: 'var(--amber-soft)',
                padding: '14px 18px',
                borderRadius: 'var(--radius-md)',
                marginBottom: 20,
              }}
            >
              <p style={{ margin: 0, fontSize: '0.9rem', color: '#7A4B06', lineHeight: 1.5 }}>
                ⏳ Оплату необходимо завершить до{' '}
                <strong>
                  {voucher.paymentDeadline
                    ? new Date(voucher.paymentDeadline).toLocaleTimeString('ru-RU')
                    : '—'}
                </strong>
                , иначе бронь будет автоматически аннулирована.
              </p>
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
            <Link to="/my">
              <Button variant="secondary">В мои путёвки</Button>
            </Link>
            {voucher.status === 'AWAITING_PAYMENT' && (
              <Button variant="primary" onClick={() => void pay()}>
                Перейти на страницу оплаты
              </Button>
            )}
          </div>
        </Card>
      )}
    </section>
  );
}
