import { useState, type FormEvent, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { booking, waitlist, packages } from '../api/endpoints';
import { ErrorBox, Field, money, today, Badge } from '../components/ui';
import { useAuth } from '../hooks/useAuth';
import type { CategoryAvailability, SanatoriumPackage } from '../types';
import InteractiveRoomMap from '../components/InteractiveRoomMap';
import SmartRecommendationWidget from '../components/SmartRecommendationWidget';
import PhotoGalleryModal from '../components/PhotoGalleryModal';
import { CATEGORY_MEDIA } from '../api/interactiveMapAndRecommendations';

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
  const [galleryCategory, setGalleryCategory] = useState<{
    name: string;
    categoryId: number;
    photos: string[];
  } | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [info, setInfo] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    packages.list(true).then(setPackageList).catch(console.error);
  }, []);

  async function search(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setInfo('');
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
      setInfo('Вы добавлены в лист ожидания: при освобождении мест путёвка будет предложена вам.');
    } catch (err) {
      setError(err);
    }
  }

  const select = (c: CategoryAvailability) =>
    navigate(`/booking?category=${c.categoryId}&from=${from}&to=${to}&places=${places}`);

  return (
    <section className="search-hero">
      <div className="page-head">
        <h1>Бронирование и планирование</h1>
        <div style={{ display: 'flex', gap: 10, marginTop: 10 }}>
          <button className={`tab-btn ${activeTab === 'SEARCH' ? 'active' : ''}`} onClick={() => setActiveTab('SEARCH')}>Поиск по датам</button>
          <button className={`tab-btn ${activeTab === 'PACKAGES' ? 'active' : ''}`} onClick={() => setActiveTab('PACKAGES')}>Оздоровительные программы</button>
          <button className={`tab-btn ${activeTab === 'MAP' ? 'active' : ''}`} onClick={() => setActiveTab('MAP')}>Карта номеров</button>
        </div>
      </div>

      {activeTab === 'SEARCH' && (
        <>
          <form className="card inline" onSubmit={search}>
            <Field label="Заезд"><input type="date" value={from} min={today()} onChange={(e) => setFrom(e.target.value)} required /></Field>
            <Field label="Выезд"><input type="date" value={to} min={from} onChange={(e) => setTo(e.target.value)} required /></Field>
            <Field label="Мест">
              <input type="number" min={1} max={4} value={places} onChange={(e) => setPlaces(Number(e.target.value))} required />
            </Field>
            <button type="submit" className="primary" disabled={busy}>Найти</button>
          </form>
          <ErrorBox error={error} />
          {info && <p className="ok">{info}</p>}
          {result && (
            <>
              <p className="note">Найдено категорий: {result.length}. Нажмите «Оформить», чтобы перейти к бронированию выбранной категории.</p>
              <div className="grid">
                {result.map((c) => {
                  const enough = c.freePlaces >= places && c.maxPlacesInOneRoom >= places;
                  const media = CATEGORY_MEDIA[c.categoryId];
                  const cover = c.coverUrl || media?.cover;
                  const photos = c.photos || media?.photos || [];

                  return (
                    <article key={c.categoryId} className={`category-card cat-${c.categoryId} with-photo`}>
                      {cover && (
                        <div
                          className="category-photo-wrapper"
                          onClick={() => setGalleryCategory({ name: c.name, categoryId: c.categoryId, photos })}
                          title="Нажмите, чтобы просмотреть все фотографии номера"
                        >
                          <img src={cover} alt={c.name} className="category-photo-img" loading="lazy" />
                          <div className="category-photo-overlay-hint">
                            <span>🔍 Просмотреть фото ({photos.length})</span>
                          </div>
                          <span className="category-photo-count">
                            📷 {photos.length} фото
                          </span>
                        </div>
                      )}
                      <div className="category-card-body">
                        <h3>{c.name}</h3>
                        <div style={{ marginBottom: 8 }}>
                          <button
                            type="button"
                            className="view-photos-link-btn"
                            onClick={() => setGalleryCategory({ name: c.name, categoryId: c.categoryId, photos })}
                          >
                            📷 Смотреть все фото ({photos.length})
                          </button>
                        </div>
                        <p className="cc-places">
                          Свободно мест: <strong>{c.freePlaces}</strong>
                          {!enough && <span className="note"> (на {places} подходящего номера нет)</span>}
                        </p>
                        <p className="kpi-value">
                          {c.priceAvailable ? `${money(c.pricePerPlaceDay)} / сутки` : 'Цена уточняется при оформлении'}
                        </p>
                        <div className="category-card-actions">
                          {enough && (
                            <button type="button" className="primary" onClick={() => select(c)}>
                              Оформить бронирование
                            </button>
                          )}
                          {!enough && hasRole('CLIENT') && (
                            <button type="button" onClick={() => void joinWaitlist(c.categoryId)}>
                              В лист ожидания
                            </button>
                          )}
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            </>
          )}

          {/* Lightbox Photo Gallery Modal for Category */}
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
        <div className="grid" style={{ marginTop: 20 }}>
          {packageList.map((p) => (
            <article key={p.id} className="card">
              <Badge variant="primary">{p.badge}</Badge>
              <h3>{p.name}</h3>
              <p>{p.description}</p>
              <p>Длительность: <strong>{p.durationNights} ночей</strong></p>
              <p>Процедур: {p.includedProcedures.length}</p>
              <div style={{ marginTop: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '1.2rem', fontWeight: 800 }}>{money(p.packagePrice)}</span>
                <button className="primary" onClick={() => navigate(`/booking?category=${p.categoryId}&packageId=${p.id}&from=${today()}&to=${today(p.durationNights)}`)}>Выбрать пакет</button>
              </div>
            </article>
          ))}
        </div>
      )}

      {activeTab === 'MAP' && (
        <InteractiveRoomMap isAdmin={hasRole('BOOKING_ADMIN', 'SYSADMIN', 'MANAGER')} />
      )}
    </section>
  );
}

