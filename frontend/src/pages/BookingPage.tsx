import { useEffect, useState, type FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { booking, clients, directory, loyalty } from '../api/endpoints';
import {
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorBox,
  Field,
  Notice,
  Stepper,
  money,
  StatusBadge,
} from '../components/ui';
import { Icon } from '../components/icons';
import { RoomImage } from '../components/RoomArt';
import { useAuth } from '../hooks/useAuth';
import PhotoGalleryModal from '../components/PhotoGalleryModal';
import { CATEGORY_MEDIA } from '../api/interactiveMapAndRecommendations';
import type { CategoryAvailability, ClientView, Coded, LoyaltyAccount, RoomCategory, SalesChannel, VoucherView } from '../types';

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
  const [offer, setOffer] = useState<CategoryAvailability | null>(null);

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

  useEffect(() => {
    if (!categoryId || !checkIn || !checkOut) return;
    booking
      .availability(checkIn, checkOut, places)
      .then((list) => setOffer(list.find((c) => c.categoryId === categoryId) ?? null))
      .catch(() => undefined);
  }, [categoryId, checkIn, checkOut, places]);

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
      <div className="card booking-missing">
        <EmptyState
          title="Параметры бронирования не выбраны"
          description="Пожалуйста, начните выбор номера со страницы поиска свободных мест."
          action={<Link to="/search" className="btn-link-reset"><Button variant="primary">Перейти к поиску номеров</Button></Link>}
        />
      </div>
    );
  }

  /** Возврат после оплаты: у администратора бронирования нет доступа к /my — ведём его в /admin-bookings. */
  function payTarget(url: string): string {
    if (!isAdmin) return url;
    try {
      const u = new URL(url, window.location.origin);
      if (u.origin === window.location.origin && u.pathname === '/my') return `/admin-bookings${u.search}`;
    } catch {
      /* некорректный URL — оставляем как есть */
    }
    return url;
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
        window.location.assign(payTarget(p.payUrl));
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
      window.location.assign(payTarget(p.payUrl));
    } catch (err) {
      setError(err);
    }
  }

  const nights = Math.max(1, Math.round((new Date(checkOut).getTime() - new Date(checkIn).getTime()) / 86400000));
  const categoryName = categories.find((c) => c.id === categoryId)?.name || offer?.name || `Категория №${categoryId}`;
  const perNight = offer?.priceAvailable ? offer.pricePerPlaceDay : null;
  const estimate = perNight !== null && perNight !== undefined ? perNight * nights * places : null;
  const discount = useBonuses ? bonusPointsToApply : 0;
  const media = CATEGORY_MEDIA[categoryId];

  return (
    <section>
      <div className="page-head">
        <div>
          <h1>Оформление путёвки в санаторий</h1>
          <p className="page-subtitle">
            Период проживания: с <strong>{checkIn}</strong> по <strong>{checkOut}</strong> ({nights} {nights === 1 ? 'ночь' : nights < 5 ? 'ночи' : 'ночей'}), мест в заявке: <strong>{places}</strong>
          </p>
        </div>
      </div>

      <Stepper steps={['Параметры', 'Оплата', 'Готово']} current={voucher ? 1 : 0} />

      <ErrorBox error={error} />

      {!voucher ? (
        <form onSubmit={submit} className="booking-layout">
          <div className="booking-main">
            {media && (
              <>
                <div className="booking-room-banner" role="button" tabIndex={0} onClick={() => setIsGalleryOpen(true)}
                     onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setIsGalleryOpen(true); } }}
                     aria-label="Открыть фотографии номера">
                  <RoomImage src={media.cover} seed={categoryId} className="booking-room-banner-img" />
                  <div className="booking-room-banner-overlay">
                    <div className="booking-banner-top">
                      <span className="booking-room-badge">
                        {params.get('room') ? `Выбран конкретный номер №${params.get('room')}` : 'Выбрана категория номера'}
                      </span>
                      <span className="booking-banner-photos-btn"><Icon name="camera" size={16} /> Все фото ({media.photos.length})</span>
                    </div>
                    <h3 className="booking-room-title">{categoryName}</h3>
                  </div>
                </div>
                {isGalleryOpen && (
                  <PhotoGalleryModal
                    isOpen={isGalleryOpen}
                    onClose={() => setIsGalleryOpen(false)}
                    title={`Фотографии номера • ${categoryName}`}
                    photos={media.photos}
                  />
                )}
              </>
            )}

            <Card title="Параметры бронирования" subtitle="Поля со звёздочкой обязательны">
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

              <div className="form-grid">
                <Field label="Лечебный профиль оздоровления" required>
                  <select value={profileId} onChange={(e) => setProfileId(e.target.value)} required>
                    <option value="">— Выберите профиль —</option>
                    {profiles.map((p) => (<option key={p.id} value={p.id}>{p.name}</option>))}
                  </select>
                </Field>
                <Field label="Диетическое питание (Стол)">
                  <select value={dietId} onChange={(e) => setDietId(e.target.value)}>
                    <option value="">Стандартное питание (Без диеты)</option>
                    {diets.map((d) => (<option key={d.id} value={d.id}>{d.name} ({d.code})</option>))}
                  </select>
                </Field>
              </div>

              <Field label="Канал бронирования / Партнёр" required>
                <select value={channelId} onChange={(e) => setChannelId(e.target.value)} required>
                  <option value="">— Выберите канал —</option>
                  {channels.map((c) => (<option key={c.id} value={c.id}>{c.name} (комиссия {c.commissionPct}%)</option>))}
                </select>
              </Field>

              {loyaltyAcc && loyaltyAcc.balance > 0 && (
                <div className="loyalty-redeem">
                  <div className="loyalty-redeem-head">
                    <label className="check">
                      <input type="checkbox" checked={useBonuses} onChange={(e) => setUseBonuses(e.target.checked)} />
                      <span>Списать бонусы программы лояльности</span>
                    </label>
                    <Badge variant="good" icon="star">Доступно: {loyaltyAcc.balance.toLocaleString('ru-RU')} баллов</Badge>
                  </div>
                  {useBonuses && (
                    <div className="loyalty-redeem-body">
                      <p className="field-hint">1 бонусный балл = 1 BYN скидки (можно оплатить до 30% суммы бронирования).</p>
                      <div className="row">
                        <input
                          type="number" min={1} max={loyaltyAcc.balance} value={bonusPointsToApply}
                          aria-label="Количество бонусных баллов" className="input-narrow"
                          onChange={(e) => setBonusPointsToApply(Math.min(loyaltyAcc.balance, Math.max(0, Number(e.target.value))))}
                        />
                        <strong className="discount-line">Скидка: -{money(bonusPointsToApply)}</strong>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </Card>
          </div>

          <aside className="booking-summary card" aria-label="Итог бронирования">
            <h3>Ваша путёвка</h3>
            <dl>
              <dt>Категория</dt><dd>{categoryName}</dd>
              <dt>Заезд</dt><dd>{checkIn}</dd>
              <dt>Выезд</dt><dd>{checkOut}</dd>
              <dt>Мест</dt><dd>{places}</dd>
            </dl>
            <div className="price-lines">
              <div><span>Цена за сутки (место)</span><strong>{perNight !== null ? money(perNight) : 'уточняется'}</strong></div>
              <div><span>{nights} × {places} (ночей × мест)</span><strong>{estimate !== null ? money(estimate) : '—'}</strong></div>
              {discount > 0 && <div className="is-discount"><span>Бонусы</span><strong>-{money(discount)}</strong></div>}
            </div>
            <div className="price-total">
              <span>Итого</span>
              <strong>{estimate !== null ? money(Math.max(0, estimate - discount)) : 'при оформлении'}</strong>
            </div>
            <Button type="submit" variant="primary" size="lg" className="btn-block" loading={busy} disabled={!profileId || !channelId || (isAdmin && !clientId)}>
              {busy ? 'Оформление…' : 'Забронировать и перейти к оплате'}
            </Button>
            <Link to="/search" className="btn-link-reset"><Button type="button" variant="secondary" className="btn-block">Назад к поиску</Button></Link>
            <p className="field-hint"><Icon name="shield" size={14} /> Оплата проходит на защищённой странице платёжного эмулятора.</p>
          </aside>
        </form>
      ) : (
        <Card className="booking-done" title={`Путёвка #${voucher.id} успешно сформирована`} subtitle="Заявка зафиксирована в системе бронирования">
          <dl>
            <dt>Статус:</dt>
            <dd><StatusBadge status={voucher.status} /></dd>
            <dt>Номер комнаты:</dt>
            <dd>{voucher.roomNumber ? `№ ${voucher.roomNumber}` : 'Будет назначен при заезде'}</dd>
            <dt>Тариф в сутки:</dt>
            <dd>{money(voucher.pricePerPlaceDay, voucher.currency ?? 'BYN')}</dd>
            <dt>Итого к оплате:</dt>
            <dd className="price-big">{money(voucher.totalPrice, voucher.currency ?? 'BYN')}</dd>
          </dl>

          {voucher.status === 'AWAITING_PAYMENT' && (
            <Notice tone="warning">
              Оплату необходимо завершить до{' '}
              <strong>{voucher.paymentDeadline ? new Date(voucher.paymentDeadline).toLocaleTimeString('ru-RU') : '—'}</strong>
              , иначе бронь будет автоматически аннулирована.
            </Notice>
          )}

          <div className="row row-end">
            <Link to="/my" className="btn-link-reset"><Button variant="secondary">В мои путёвки</Button></Link>
            {voucher.status === 'AWAITING_PAYMENT' && (
              <Button variant="primary" onClick={() => void pay()}>Перейти на страницу оплаты</Button>
            )}
          </div>
        </Card>
      )}
    </section>
  );
}
