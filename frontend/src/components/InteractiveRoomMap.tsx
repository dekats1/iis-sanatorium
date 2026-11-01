import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { interactiveRooms } from '../api/endpoints';
import type { InteractiveRoom, RoomStatus } from '../types';
import { Icon, type IconName } from './icons';
import { RoomImage } from './RoomArt';
import { Button, EmptyState, ErrorBox, Skeleton, money, useToast } from './ui';
import RoomDetailsModal from './widgets/RoomDetailsModal';
import { roomPhotos, roomStatusView, type RoomFilter, type RoomTone } from './widgets/roomStatus';

interface InteractiveRoomMapProps {
  onSelectRoom?: (room: InteractiveRoom) => void;
  isAdmin?: boolean;
}

const FLOORS = [1, 2, 3];

interface FilterChip {
  id: RoomFilter;
  label: string;
  count: number;
  tone?: RoomTone;
  icon?: IconName;
}

export default function InteractiveRoomMap({ onSelectRoom, isAdmin = false }: InteractiveRoomMapProps) {
  const navigate = useNavigate();
  const toast = useToast();
  const [floor, setFloor] = useState<number>(1);
  const [statusFilter, setStatusFilter] = useState<RoomFilter>('ALL');
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
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [statusBusy, setStatusBusy] = useState(false);

  const loadData = async () => {
    setLoading(true);
    setError(null);
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
    } catch (e) {
      setError(e);
    } finally {
      setLoading(false);
      setLoaded(true);
    }
  };

  useEffect(() => {
    void loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [floor, statusFilter, isAdmin]);

  const handleStatusChange = async (newStatus: RoomStatus) => {
    if (!selectedRoom || !isAdmin) return;
    setStatusBusy(true);
    try {
      const updated = await interactiveRooms.updateStatus(selectedRoom.id, newStatus);
      setSelectedRoom(updated);
      toast.success(newStatus === 'CLEANING' ? `Номер №${updated.roomNumber} отправлен на уборку` : `Номер №${updated.roomNumber} снова свободен`);
      await loadData();
    } catch (e) {
      console.error(e);
      toast.error(e instanceof Error ? e.message : 'Не удалось изменить статус номера');
    } finally {
      setStatusBusy(false);
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

  const chips: FilterChip[] = isAdmin
    ? [
        { id: 'ALL', label: 'Все', count: stats.total },
        { id: 'VACANT', label: 'Свободен', count: stats.vacant, tone: 'good', icon: 'checkCircle' },
        { id: 'OCCUPIED', label: 'Занят', count: stats.occupied, tone: 'bad', icon: 'user' },
        { id: 'CLEANING', label: 'Уборка', count: stats.cleaning, tone: 'wait', icon: 'droplet' },
        { id: 'RESERVED', label: 'Бронь', count: stats.reserved, tone: 'info', icon: 'calendar' },
      ]
    : [
        { id: 'ALL', label: 'Все номера', count: stats.total },
        { id: 'VACANT', label: 'Свободные для бронирования', count: stats.vacant, tone: 'good', icon: 'checkCircle' },
        { id: 'UNAVAILABLE', label: 'Недоступные', count: stats.total - stats.vacant, tone: 'neutral', icon: 'lock' },
      ];

  const legend = chips.filter((c) => c.tone && c.icon);
  const firstLoad = loading && !loaded;

  return (
    <div className="gx-map">
      <div className="gx-map-controls">
        <div className="gx-floor-switch" role="group" aria-label="Этаж корпуса">
          {FLOORS.map((f) => (
            <button key={f} type="button" className="gx-floor-btn" aria-pressed={floor === f} onClick={() => setFloor(f)}>
              {f} этаж
            </button>
          ))}
        </div>

        <div className="chip-row" role="group" aria-label="Фильтр по статусу номера">
          {chips.map((c) => (
            <button key={c.id} type="button" className="chip" aria-pressed={statusFilter === c.id} onClick={() => setStatusFilter(c.id)}>
              {c.icon && <Icon name={c.icon} size={16} className={`gx-tone-ic tone-${c.tone}`} />}
              {c.label} ({c.count})
            </button>
          ))}
        </div>
      </div>

      <section className="gx-floor card" aria-busy={loading || undefined} aria-label={`План ${floor}-го этажа`}>
        <header className="gx-floor-head">
          <div>
            <h3 className="gx-floor-title">
              <Icon name="map" size={18} /> Главный спальный корпус — План {floor}-го этажа
            </h3>
            <ul className="gx-legend" aria-label="Обозначения">
              {legend.map((l) => (
                <li key={l.id} className={`gx-legend-item tone-${l.tone}`}>
                  <span className="gx-legend-swatch" aria-hidden="true" />
                  <Icon name={l.icon as IconName} size={14} />
                  {l.id === 'VACANT' ? 'Свободен' : l.id === 'UNAVAILABLE' ? 'Недоступен' : l.label}
                </li>
              ))}
            </ul>
          </div>
          <div className="gx-floor-summary">
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
        </header>

        <ErrorBox error={error} />

        {firstLoad ? (
          <div className="gx-rooms" aria-hidden="true">
            {Array.from({ length: 6 }, (_, i) => (
              <div key={i} className="gx-room gx-room-skeleton">
                <Skeleton height={120} className="gx-skel-photo" />
                <div className="gx-room-body">
                  <Skeleton width="40%" height={18} />
                  <Skeleton width="80%" />
                  <Skeleton width="60%" />
                </div>
              </div>
            ))}
          </div>
        ) : rooms.length === 0 && !error ? (
          <EmptyState
            title="Нет номеров по выбранному фильтру."
            description={`На ${floor}-м этаже нет номеров с выбранным статусом. Попробуйте другой этаж или сбросьте фильтр.`}
            icon={<Icon name="bed" size={40} />}
            action={
              statusFilter !== 'ALL' ? (
                <Button variant="outline" onClick={() => setStatusFilter('ALL')}>
                  Показать все номера
                </Button>
              ) : undefined
            }
          />
        ) : (
          <div className={`gx-rooms ${loading ? 'is-refreshing' : ''}`}>
            {rooms.map((room) => {
              const isVacant = room.status === 'VACANT';
              const view = roomStatusView(room.status, isAdmin);
              const photos = roomPhotos(room);

              return (
                <button
                  key={room.id}
                  type="button"
                  className={`gx-room is-${view.key}`}
                  onClick={() => setSelectedRoom(room)}
                  title={isVacant ? 'Выбрать номер' : 'Подробнее о номере'}
                >
                  <span className="gx-room-photo">
                    <RoomImage src={photos[0]} seed={room.categoryId} alt={room.categoryName} className="gx-room-img" />
                    {photos.length > 0 && (
                      <span className="gx-room-photo-count">
                        <Icon name="camera" size={14} /> {photos.length} фото
                      </span>
                    )}
                  </span>

                  <span className="gx-room-body">
                    <span className="gx-room-top">
                      <span className="gx-room-num">№ {room.roomNumber}</span>
                      <span className={`badge ${view.tone}`}>
                        <Icon name={view.icon} size={14} />
                        {view.short}
                      </span>
                    </span>

                    <span className="gx-room-cat">{room.categoryName}</span>

                    <span className="gx-room-meta">
                      <span><Icon name="users" size={14} /> {room.capacity} {room.capacity === 1 ? 'место' : 'места'}</span>
                      <span><Icon name="mountain" size={14} /> {room.windowView}</span>
                      {/* Конфиденциальность: имя гостя видит только персонал */}
                      {isAdmin && room.currentGuestName && (
                        <span className="gx-room-guest"><Icon name="user" size={14} /> {room.currentGuestName}</span>
                      )}
                    </span>

                    <span className="gx-room-bottom">
                      <span className="gx-room-price">{money(room.pricePerDay)} / сут.</span>
                      <span className="gx-room-cta">
                        {isVacant ? 'Выбрать' : 'Инфо'} <Icon name="arrowRight" size={16} />
                      </span>
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </section>

      {selectedRoom && (
        <RoomDetailsModal
          key={selectedRoom.id}
          room={selectedRoom}
          isAdmin={isAdmin}
          busy={statusBusy}
          onClose={() => setSelectedRoom(null)}
          onBook={handleBookRoom}
          onStatusChange={(s) => void handleStatusChange(s)}
          onShowVacant={() => {
            setStatusFilter('VACANT');
            setSelectedRoom(null);
          }}
        />
      )}
    </div>
  );
}
