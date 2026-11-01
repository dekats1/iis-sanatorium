import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { booking, waitlist, packages } from '../api/endpoints';
import { Badge, Button, EmptyState, ErrorBox, Field, SkeletonRows, Tabs, money, today, useToast } from '../components/ui';
import { Icon } from '../components/icons';
import { RoomImage } from '../components/RoomArt';
import { useAuth } from '../hooks/useAuth';
import type { CategoryAvailability, SanatoriumPackage } from '../types';
import InteractiveRoomMap from '../components/InteractiveRoomMap';
import SmartRecommendationWidget from '../components/SmartRecommendationWidget';
import PhotoGalleryModal from '../components/PhotoGalleryModal';
import { CATEGORY_MEDIA } from '../api/interactiveMapAndRecommendations';

type SortKey = 'price' | 'places' | 'name';

function addDays(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00`);
  d.setDate(d.getDate() + days);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Ближайшая пятница (включая сегодня). */
function nextFriday(): string {
  const d = new Date();
  const delta = (5 - d.getDay() + 7) % 7;
  return today(delta);
}

function nightsWord(n: number): string {
  const m10 = n % 10;
  const m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return 'ночь';
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return 'ночи';
  return 'ночей';
}

/** Поиск свободных мест (ФТ-05): карточки категорий, кнопка оформления всегда доступна, лист ожидания — только когда мест нет. */
export default function SearchPage() {
  const navigate = useNavigate();
  const { hasRole } = useAuth();
  const [activeTab, setActiveTab] = useState<'SEARCH' | 'PACKAGES' | 'MAP'>('SEARCH');
  const [from, setFrom] = useState(today(14));
  const [to, setTo] = useState(today(24));
  const [places, setPlaces] = useState(1);
  const [result, setResult] = useState<CategoryAvailability[] | null>(null);
  const [packageList, setPackageList] = useState<SanatoriumPackage[]>([]);
  const [galleryCategory, setGalleryCategory] = useState<{ name: string; categoryId: number; photos: string[] } | null>(null);
  const [error, setError] = useState<unknown>(null);
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [sort, setSort] = useState<SortKey>('price');
  const [onlyAvailable, setOnlyAvailable] = useState(false);

  useEffect(() => {
    packages.list(true).then(setPackageList).catch(console.error);
  }, []);

  const nights = Math.max(0, Math.round((new Date(to).getTime() - new Date(from).getTime()) / 86400000));

  function applyPreset(start: string, length: number) {
    setFrom(start);
    setTo(addDays(start, length));
  }

  async function search(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (to <= from) {
      setError(new Error('Дата выезда должна быть позже даты заезда'));
      return;
    }
    setBusy(true);
    try {
      setResult(await booking.availability(from, to, places));
    } catch (err) {
      setError(err);
      setResult(null);
    } finally {
      setBusy(false);
    }
  }

  async function joinWaitlist(categoryId: number) {
    setError(null);
    try {
      await waitlist.add({ categoryId, dateFrom: from, dateTo: to, places });
      toast.success('Вы добавлены в лист ожидания: при освобождении мест путёвка будет предложена вам.');
    } catch (err) {
      setError(err);
    }
  }

  const select = (c: CategoryAvailability) =>
    navigate(`/booking?category=${c.categoryId}&from=${from}&to=${to}&places=${places}`);

  const visible = useMemo(() => {
    if (!result) return null;
    const list = onlyAvailable ? result.filter((c) => c.freePlaces >= places && c.maxPlacesInOneRoom >= places) : [...result];
    list.sort((a, b) => {
      if (sort === 'name') return a.name.localeCompare(b.name, 'ru');
      if (sort === 'places') return b.freePlaces - a.freePlaces;
      return (a.pricePerPlaceDay ?? Infinity) - (b.pricePerPlaceDay ?? Infinity);
    });
    return list;
  }, [result, sort, onlyAvailable, places]);

  const friday = nextFriday();

  return (
    <section>
      <div className="page-head">
        <div>
          <h1>Поиск свободных номеров</h1>
          <p className="page-subtitle">Бронирование и планирование: выберите даты, категорию номера или оздоровительную программу.</p>
        </div>
      </div>

      <Tabs
        label="Разделы бронирования"
        value={activeTab}
        onChange={setActiveTab}
        tabs={[
          { id: 'SEARCH', label: 'Поиск по датам', icon: 'search' },
          { id: 'PACKAGES', label: 'Оздоровительные программы', icon: 'heart' },
          { id: 'MAP', label: 'Карта номеров', icon: 'map' },
        ]}
      />

      {activeTab === 'SEARCH' && (
        <>
          <form className="card search-form" onSubmit={search}>
            <div className="inline">
              <Field label="Заезд"><input type="date" value={from} min={today()} onChange={(e) => setFrom(e.target.value)} required /></Field>
              <Field label="Выезд"><input type="date" value={to} min={from} onChange={(e) => setTo(e.target.value)} required /></Field>
              <Field label="Мест">
                <input type="number" min={1} max={4} value={places} onChange={(e) => setPlaces(Number(e.target.value))} required />
              </Field>
              <Button type="submit" variant="primary" size="lg" loading={busy} icon={<Icon name="search" size={18} />}>Найти</Button>
            </div>
            <div className="preset-row" role="group" aria-label="Быстрый выбор дат">
              <span className="preset-label">Быстрый выбор:</span>
              <button type="button" className="chip" onClick={() => applyPreset(friday, 2)}>Выходные</button>
              <button type="button" className="chip" onClick={() => applyPreset(today(7), 7)}>Неделя</button>
              <button type="button" className="chip" onClick={() => applyPreset(today(7), 14)}>14 дней</button>
              {nights > 0 && <span className="preset-summary"><Icon name="calendar" size={16} /> {nights} {nightsWord(nights)}</span>}
            </div>
          </form>

          <ErrorBox error={error} />

          {busy && !result && <SkeletonRows rows={3} />}

          {visible && result && (
            <>
              <div className="results-bar">
                <p className="note">
                  Найдено категорий: <strong>{visible.length}</strong>
                  {visible.length !== result.length && ` из ${result.length}`}. Нажмите «Выбрать», чтобы перейти к оформлению выбранной категории.
                </p>
                <div className="results-controls">
                  <label className="check">
                    <input type="checkbox" checked={onlyAvailable} onChange={(e) => setOnlyAvailable(e.target.checked)} />
                    Только с местами
                  </label>
                  <Field label="Сортировка" className="field-compact">
                    <select value={sort} onChange={(e) => setSort(e.target.value as SortKey)}>
                      <option value="price">Сначала дешевле</option>
                      <option value="places">Больше свободных мест</option>
                      <option value="name">По названию</option>
                    </select>
                  </Field>
                </div>
              </div>

              {visible.length === 0 ? (
                <div className="card">
                  <EmptyState
                    title="Подходящих категорий нет"
                    description="Измените даты или количество мест, либо снимите фильтр «Только с местами»."
                    action={<Button onClick={() => setOnlyAvailable(false)}>Сбросить фильтр</Button>}
                  />
                </div>
              ) : (
                <div className="grid">
                  {visible.map((c) => {
                    const enough = c.freePlaces >= places && c.maxPlacesInOneRoom >= places;
                    const media = CATEGORY_MEDIA[c.categoryId];
                    const cover = c.coverUrl || media?.cover;
                    const photos = c.photos || media?.photos || [];
                    const total = c.priceAvailable && c.pricePerPlaceDay !== null ? c.pricePerPlaceDay * nights * places : null;

                    return (
                      <article key={c.categoryId} className={`category-card cat-${c.categoryId} with-photo`}>
                        <button
                          type="button"
                          className="category-photo-wrapper"
                          onClick={() => setGalleryCategory({ name: c.name, categoryId: c.categoryId, photos })}
                          aria-label={`Фотографии номера ${c.name}`}
                          disabled={photos.length === 0}
                        >
                          <RoomImage src={cover} seed={c.categoryId} className="category-photo-img" />
                          <span className="category-photo-count"><Icon name="camera" size={14} /> {photos.length} фото</span>
                        </button>
                        <div className="category-card-body">
                          <div className="category-card-title">
                            <h3>{c.name}</h3>
                            {enough ? (
                              <Badge variant="good" icon="checkCircle">Есть места</Badge>
                            ) : (
                              <Badge variant="wait" icon="clock">Мест нет</Badge>
                            )}
                          </div>
                          <p className="cc-places">
                            Свободно мест: <strong>{c.freePlaces}</strong>
                            {!enough && <span className="note"> (на {places} подходящего номера нет)</span>}
                          </p>
                          <div className="price-block">
                            {c.priceAvailable ? (
                              <>
                                <p className="kpi-value">{money(c.pricePerPlaceDay)} <span className="per">/ сутки</span></p>
                                {total !== null && nights > 0 && (
                                  <p className="price-total-line">Итого за {nights} {nightsWord(nights)}, {places} {places === 1 ? 'место' : 'мест'}: <strong>{money(total)}</strong></p>
                                )}
                              </>
                            ) : (
                              <p className="kpi-value kpi-pending">Цена уточняется при оформлении</p>
                            )}
                          </div>
                          <div className="category-card-actions">
                            {enough && (
                              <Button variant="primary" onClick={() => select(c)} icon={<Icon name="arrowRight" size={18} />}>
                                Выбрать
                              </Button>
                            )}
                            {!enough && hasRole('CLIENT') && (
                              <Button onClick={() => void joinWaitlist(c.categoryId)}>В лист ожидания</Button>
                            )}
                          </div>
                        </div>
                      </article>
                    );
                  })}
                </div>
              )}
            </>
          )}

          {!result && !busy && (
            <div className="card">
              <EmptyState
                title="Выберите даты и нажмите «Найти»"
                description="Мы покажем свободные категории номеров с ценой за сутки и итоговой стоимостью."
                icon={<Icon name="bed" size={40} />}
              />
            </div>
          )}

          {galleryCategory && (
            <PhotoGalleryModal
              isOpen={Boolean(galleryCategory)}
              onClose={() => setGalleryCategory(null)}
              title={`Фотографии номера • ${galleryCategory.name}`}
              photos={galleryCategory.photos}
              onBook={() => {
                const targetCat = result?.find((r) => r.categoryId === galleryCategory.categoryId);
                if (targetCat) select(targetCat);
              }}
              bookButtonText={`Забронировать «${galleryCategory.name}»`}
            />
          )}

          <SmartRecommendationWidget />
        </>
      )}

      {activeTab === 'PACKAGES' && (
        packageList.length === 0 ? (
          <div className="card"><EmptyState title="Программы пока не опубликованы" description="Загляните позже или воспользуйтесь поиском по датам." /></div>
        ) : (
          <div className="grid">
            {packageList.map((p) => (
              <article key={p.id} className="card package-tile">
                <Badge variant="primary" icon="sparkles">{p.badge}</Badge>
                <h3>{p.name}</h3>
                <p>{p.description}</p>
                <ul className="meta-list">
                  <li><Icon name="calendar" size={16} /> Длительность: <strong>{p.durationNights} {nightsWord(p.durationNights)}</strong></li>
                  <li><Icon name="heart" size={16} /> Процедур: <strong>{p.includedProcedures.length}</strong></li>
                </ul>
                <div className="package-tile-foot">
                  <span className="price-big">{money(p.packagePrice)}</span>
                  <Button variant="primary" onClick={() => navigate(`/booking?category=${p.categoryId}&packageId=${p.id}&from=${today()}&to=${today(p.durationNights)}`)}>Выбрать пакет</Button>
                </div>
              </article>
            ))}
          </div>
        )
      )}

      {activeTab === 'MAP' && <InteractiveRoomMap isAdmin={hasRole('BOOKING_ADMIN', 'SYSADMIN', 'MANAGER')} />}
    </section>
  );
}
