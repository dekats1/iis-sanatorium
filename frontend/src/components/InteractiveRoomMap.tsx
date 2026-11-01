import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { interactiveRooms } from '../api/endpoints';
import { CATEGORY_MEDIA } from '../api/interactiveMapAndRecommendations';
import type { InteractiveRoom, RoomStatus } from '../types';
import { Badge, Button, Modal, money } from './ui';

interface InteractiveRoomMapProps {
  onSelectRoom?: (room: InteractiveRoom) => void;
  isAdmin?: boolean;
}

export default function InteractiveRoomMap({ onSelectRoom, isAdmin = false }: InteractiveRoomMapProps) {
  const navigate = useNavigate();
  const [floor, setFloor] = useState<number>(1);
  const [statusFilter, setStatusFilter] = useState<RoomStatus | 'ALL' | 'UNAVAILABLE'>('ALL');
  const [rooms, setRooms] = useState<InteractiveRoom[]>([]);
  const [stats, setStats] = useState({
    total: 18,
    vacant: 11,
    occupied: 4,
    cleaning: 2,
    reserved: 1,
    occupancyPercent: 22.2,
  });
  const [selectedRoom, setSelectedRoom] = useState<InteractiveRoom | null>(null);
  const [galleryPhotoIdx, setGalleryPhotoIdx] = useState<number>(0);
  const [loading, setLoading] = useState(false);

  const handleOpenRoomModal = (room: InteractiveRoom) => {
    setSelectedRoom(room);
    setGalleryPhotoIdx(0);
  };

  const loadData = async () => {
    setLoading(true);
    try {
      const isFilterUnavailable = statusFilter === 'UNAVAILABLE';
      const [list, st] = await Promise.all([
        interactiveRooms.list({
          floor,
          status: statusFilter === 'ALL' || isFilterUnavailable ? undefined : statusFilter,
          isStaff: isAdmin,
        }),
        interactiveRooms.stats(),
      ]);
      setRooms(isFilterUnavailable ? list.filter((r) => r.status !== 'VACANT') : list);
      setStats(st);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [floor, statusFilter, isAdmin]);

  const handleStatusChange = async (newStatus: RoomStatus) => {
    if (!selectedRoom || !isAdmin) return;
    try {
      const updated = await interactiveRooms.updateStatus(selectedRoom.id, newStatus);
      setSelectedRoom(updated);
      await loadData();
    } catch (e) {
      console.error(e);
    }
  };

  const handleBookRoom = (room: InteractiveRoom) => {
    if (onSelectRoom) {
      onSelectRoom(room);
    } else {
      navigate(`/booking?category=${room.categoryId}&room=${room.roomNumber}&places=${room.capacity}`);
    }
    setSelectedRoom(null);
  };

  const floorVacantCount = rooms.filter((r) => r.status === 'VACANT').length;

  return (
    <div className="room-map-wrapper">
      {/* Controls: Floor selector and Status Legend */}
      <div className="room-map-controls">
        <div className="floor-nav">
          {[1, 2, 3].map((f) => (
            <button
              key={f}
              type="button"
              className={`floor-nav-btn ${floor === f ? 'active' : ''}`}
              onClick={() => setFloor(f)}
            >
              {f} этаж
            </button>
          ))}
        </div>

        <div className="room-status-legend">
          {isAdmin ? (
            /* Staff / Administrator Operational Legend */
            <>
              <span
                className="legend-item"
                style={{ fontWeight: statusFilter === 'ALL' ? 700 : 500 }}
                onClick={() => setStatusFilter('ALL')}
              >
                Все ({stats.total})
              </span>
              <span
                className="legend-item"
                style={{ fontWeight: statusFilter === 'VACANT' ? 700 : 500 }}
                onClick={() => setStatusFilter('VACANT')}
              >
                <span className="status-dot VACANT" /> Свободен ({stats.vacant})
              </span>
              <span
                className="legend-item"
                style={{ fontWeight: statusFilter === 'OCCUPIED' ? 700 : 500 }}
                onClick={() => setStatusFilter('OCCUPIED')}
              >
                <span className="status-dot OCCUPIED" /> Занят ({stats.occupied})
              </span>
              <span
                className="legend-item"
                style={{ fontWeight: statusFilter === 'CLEANING' ? 700 : 500 }}
                onClick={() => setStatusFilter('CLEANING')}
              >
                <span className="status-dot CLEANING" /> Уборка ({stats.cleaning})
              </span>
              <span
                className="legend-item"
                style={{ fontWeight: statusFilter === 'RESERVED' ? 700 : 500 }}
                onClick={() => setStatusFilter('RESERVED')}
              >
                <span className="status-dot RESERVED" /> Бронь ({stats.reserved})
              </span>
            </>
          ) : (
            /* Client / Public Privacy Legend (152-ФЗ / GDPR) */
            <>
              <span
                className="legend-item"
                style={{ fontWeight: statusFilter === 'ALL' ? 700 : 500 }}
                onClick={() => setStatusFilter('ALL')}
              >
                Все номера ({stats.total})
              </span>
              <span
                className="legend-item"
                style={{ fontWeight: statusFilter === 'VACANT' ? 700 : 500 }}
                onClick={() => setStatusFilter('VACANT')}
              >
                <span className="status-dot VACANT" /> Свободные для бронирования ({stats.vacant})
              </span>
              <span
                className="legend-item"
                style={{ fontWeight: statusFilter === 'UNAVAILABLE' ? 700 : 500 }}
                onClick={() => setStatusFilter('UNAVAILABLE')}
              >
                <span className="status-dot UNAVAILABLE" /> Недоступные ({stats.total - stats.vacant})
              </span>
            </>
          )}
        </div>
      </div>

      {/* Schematic Floor Grid */}
      <div className="floor-schematic">
        <div className="building-header">
          <div className="building-title">
            <span>Главный спальный корпус — План {floor}-го этажа</span>
          </div>
          <div style={{ fontSize: '0.88rem', color: 'var(--text-muted)' }}>
            {isAdmin ? (
              <>
                Загрузка: <strong>{stats.occupancyPercent}%</strong>
              </>
            ) : (
              <>
                Свободно на этаже: <strong>{floorVacantCount}</strong> из <strong>{rooms.length}</strong>
              </>
            )}
          </div>
        </div>

        {loading ? (
          <p style={{ textAlign: 'center', padding: '30px', color: 'var(--text-muted)' }}>
            Загрузка...
          </p>
        ) : rooms.length === 0 ? (
          <p style={{ textAlign: 'center', padding: '30px', color: 'var(--text-muted)' }}>
            Нет номеров по выбранному фильтру.
          </p>
        ) : (
          <div className="rooms-matrix">
            {rooms.map((room) => {
              const isVacant = room.status === 'VACANT';

              // Text and badge variant: full staff details vs privacy-neutral for clients
              let statusRu = isVacant ? 'Свободен' : 'Недоступен';
              let statusVariant: 'success' | 'danger' | 'warning' | 'info' | 'neutral' = isVacant
                ? 'success'
                : 'neutral';

              if (isAdmin) {
                statusRu =
                  room.status === 'VACANT'
                    ? 'Свободен'
                    : room.status === 'OCCUPIED'
                    ? 'Занят'
                    : room.status === 'CLEANING'
                    ? 'Уборка'
                    : 'Бронь';
                statusVariant =
                  room.status === 'VACANT'
                    ? 'success'
                    : room.status === 'OCCUPIED'
                    ? 'danger'
                    : room.status === 'CLEANING'
                    ? 'warning'
                    : 'info';
              }

              const cardClass = isAdmin
                ? room.status
                : isVacant
                ? 'VACANT'
                : 'client-unavailable';

              const roomPhotos = room.photos && room.photos.length > 0 ? room.photos : CATEGORY_MEDIA[room.categoryId]?.photos || [];
              const roomCover = roomPhotos[0];

              return (
                <div
                  key={room.id}
                  className={`room-card-interactive ${cardClass}`}
                  onClick={() => handleOpenRoomModal(room)}
                  title={isVacant ? 'Выбрать номер' : 'Подробнее о номере'}
                >
                  {roomCover && (
                    <div className="room-card-photo-header">
                      <img src={roomCover} alt={room.categoryName} className="room-card-thumb-img" loading="lazy" />
                      <span className="room-card-photo-badge">
                        {roomPhotos.length} фото
                      </span>
                    </div>
                  )}

                  <div className="room-card-body-content">
                    <div className="room-card-top">
                      <span className="room-num-badge">
                        № {room.roomNumber}
                      </span>
                      <Badge variant={statusVariant}>
                        {statusRu}
                      </Badge>
                    </div>

                    <div className="room-category-name">{room.categoryName}</div>

                    <div className="room-card-meta">
                      <div>Вместимость: {room.capacity} {room.capacity === 1 ? 'место' : 'места'}</div>
                      <div>Вид: {room.windowView}</div>
                      {/* Privacy: guest names are NEVER rendered to clients or public visitors */}
                      {isAdmin && room.currentGuestName && (
                        <div style={{ color: 'var(--text-darker)', fontWeight: 600 }}>
                          {room.currentGuestName}
                        </div>
                      )}
                    </div>

                    <div className="room-card-bottom">
                      <span className="room-price-val">{money(room.pricePerDay)} / сут.</span>
                      <Button variant="ghost" size="sm">
                        {isVacant ? 'Выбрать →' : 'Инфо →'}
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Selected Room Details Modal */}
      {selectedRoom && (() => {
        const selectedPhotos = selectedRoom.photos && selectedRoom.photos.length > 0
          ? selectedRoom.photos
          : CATEGORY_MEDIA[selectedRoom.categoryId]?.photos || [];

        return (
          <Modal
            isOpen={Boolean(selectedRoom)}
            onClose={() => setSelectedRoom(null)}
            title={`Номер №${selectedRoom.roomNumber} — ${selectedRoom.categoryName}`}
            size="lg"
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <span style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>
                    {selectedRoom.building}, {selectedRoom.floor} этаж
                  </span>
                  <div style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--primary)' }}>
                    {money(selectedRoom.pricePerDay)} <span style={{ fontSize: '0.85rem', fontWeight: 500 }}>/ сутки</span>
                  </div>
                </div>
                <Badge
                  variant={
                    isAdmin
                      ? selectedRoom.status === 'VACANT'
                        ? 'success'
                        : selectedRoom.status === 'OCCUPIED'
                        ? 'danger'
                        : selectedRoom.status === 'CLEANING'
                        ? 'warning'
                        : 'info'
                      : selectedRoom.status === 'VACANT'
                      ? 'success'
                      : 'neutral'
                  }
                >
                  {isAdmin
                    ? selectedRoom.status === 'VACANT'
                      ? 'Свободен'
                      : selectedRoom.status === 'OCCUPIED'
                      ? 'Занят гостем'
                      : selectedRoom.status === 'CLEANING'
                      ? 'На санитарной уборке'
                      : 'Забронирован'
                    : selectedRoom.status === 'VACANT'
                    ? 'Свободен для бронирования'
                    : 'Недоступен для бронирования'}
                </Badge>
              </div>

              {/* Interactive Photo Gallery with Viewport & Thumbnails */}
              {selectedPhotos.length > 0 && (
                <div className="room-modal-gallery">
                  <div className="room-gallery-viewport">
                    <img
                      src={selectedPhotos[galleryPhotoIdx]}
                      alt={`Фото номера ${selectedRoom.roomNumber} (${galleryPhotoIdx + 1})`}
                      className="room-gallery-current-img"
                    />
                    {selectedPhotos.length > 1 && (
                      <>
                        <button
                          type="button"
                          className="gallery-nav-btn prev"
                          onClick={(e) => {
                            e.stopPropagation();
                            setGalleryPhotoIdx((i) => (i > 0 ? i - 1 : selectedPhotos.length - 1));
                          }}
                          title="Предыдущее фото"
                        >
                          ‹
                        </button>
                        <button
                          type="button"
                          className="gallery-nav-btn next"
                          onClick={(e) => {
                            e.stopPropagation();
                            setGalleryPhotoIdx((i) => (i < selectedPhotos.length - 1 ? i + 1 : 0));
                          }}
                          title="Следующее фото"
                        >
                          ›
                        </button>
                      </>
                    )}
                    <div className="gallery-counter-pill">
                      {galleryPhotoIdx + 1} / {selectedPhotos.length}
                    </div>
                  </div>

                  {selectedPhotos.length > 1 && (
                    <div className="gallery-thumbs-row">
                      {selectedPhotos.map((imgUrl, idx) => (
                        <button
                          key={idx}
                          type="button"
                          className={`gallery-thumb-item ${idx === galleryPhotoIdx ? 'active' : ''}`}
                          onClick={() => setGalleryPhotoIdx(idx)}
                          title={`Посмотреть фото ${idx + 1}`}
                        >
                          <img src={imgUrl} alt="" className="gallery-thumb-img" />
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Polite privacy notice for clients if room is currently unavailable */}
              {!isAdmin && selectedRoom.status !== 'VACANT' && (
                <div
                  style={{
                    background: 'var(--surface-muted, #f8fafc)',
                    border: '1px solid var(--line)',
                    padding: 14,
                    borderRadius: 8,
                    fontSize: '0.88rem',
                    color: 'var(--text-muted)',
                    lineHeight: 1.5,
                  }}
                >
                  Данный номер в настоящее время недоступен для бронирования. Вы можете ознакомиться с оснащением номера или выбрать любой из доступных свободных номеров на плане.
                </div>
              )}

              {/* Room feature notes (only displayed if vacant or for staff) */}
              {selectedRoom.notes && (isAdmin || selectedRoom.status === 'VACANT') && (
                <div style={{ background: 'var(--bg-subtle)', padding: 12, borderRadius: 8, fontSize: '0.88rem' }}>
                  <strong>Особенность:</strong> {selectedRoom.notes}
                </div>
              )}

              <div>
                <h4 style={{ fontSize: '0.95rem', marginBottom: 8 }}>Вид из окна</h4>
                <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                  {selectedRoom.windowView}
                </p>
              </div>

              <div>
                <h4 style={{ fontSize: '0.95rem', marginBottom: 8 }}>Удобства</h4>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {selectedRoom.amenities.map((amenity, i) => (
                    <Badge key={i} variant="neutral">
                      {amenity}
                    </Badge>
                  ))}
                </div>
              </div>

              {/* Current Guest placement info: PRIVACY-PROTECTED, ONLY FOR STAFF */}
              {isAdmin && (selectedRoom.status === 'OCCUPIED' || selectedRoom.status === 'RESERVED') && (
                <div style={{ background: 'var(--surface-muted, #f8fafc)', border: '1px solid var(--line)', padding: 14, borderRadius: 8 }}>
                  <h4 style={{ fontSize: '0.95rem', margin: '0 0 8px 0', color: 'var(--text)' }}>
                    Текущее размещение
                  </h4>
                  <div style={{ fontSize: '0.88rem', display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <div>Гость: <strong>{selectedRoom.currentGuestName || 'Не указан'}</strong></div>
                    <div>Путёвка: <code>{selectedRoom.voucherCode || '—'}</code></div>
                    <div>Период: {selectedRoom.checkInDate} — {selectedRoom.checkOutDate}</div>
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 10, flexWrap: 'wrap' }}>
                {isAdmin && selectedRoom.status === 'CLEANING' && (
                  <Button variant="outline" onClick={() => handleStatusChange('VACANT')}>
                    Завершить уборку
                  </Button>
                )}

                {isAdmin && selectedRoom.status === 'VACANT' && (
                  <Button variant="outline" onClick={() => handleStatusChange('CLEANING')}>
                    Назначить уборку
                  </Button>
                )}

                {selectedRoom.status === 'VACANT' ? (
                  <Button variant="primary" onClick={() => handleBookRoom(selectedRoom)}>
                    Забронировать №{selectedRoom.roomNumber}
                  </Button>
                ) : !isAdmin ? (
                  <>
                    <Button
                      variant="outline"
                      onClick={() => {
                        setStatusFilter('VACANT');
                        setSelectedRoom(null);
                      }}
                    >
                      Показать свободные номера
                    </Button>
                    <Button variant="secondary" onClick={() => setSelectedRoom(null)}>
                      Закрыть
                    </Button>
                  </>
                ) : (
                  <Button variant="secondary" onClick={() => setSelectedRoom(null)}>
                    Закрыть
                  </Button>
                )}
              </div>
            </div>
          </Modal>
        );
      })()}
    </div>
  );
}
