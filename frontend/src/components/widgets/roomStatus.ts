import type { InteractiveRoom, RoomStatus } from '../../types';
import type { IconName } from '../icons';
import { CATEGORY_MEDIA } from '../../api/interactiveMapAndRecommendations';

export type RoomTone = 'good' | 'bad' | 'wait' | 'info' | 'neutral';
export type RoomFilter = RoomStatus | 'ALL' | 'UNAVAILABLE';

export interface RoomStatusView {
  /** Ключ для CSS-модификатора карточки. */
  key: 'vacant' | 'occupied' | 'cleaning' | 'reserved' | 'unavailable';
  tone: RoomTone;
  icon: IconName;
  short: string;
  long: string;
}

const STAFF: Record<RoomStatus, RoomStatusView> = {
  VACANT: { key: 'vacant', tone: 'good', icon: 'checkCircle', short: 'Свободен', long: 'Свободен' },
  OCCUPIED: { key: 'occupied', tone: 'bad', icon: 'user', short: 'Занят', long: 'Занят гостем' },
  CLEANING: { key: 'cleaning', tone: 'wait', icon: 'droplet', short: 'Уборка', long: 'На санитарной уборке' },
  RESERVED: { key: 'reserved', tone: 'info', icon: 'calendar', short: 'Бронь', long: 'Забронирован' },
};

const CLIENT_VACANT: RoomStatusView = {
  key: 'vacant',
  tone: 'good',
  icon: 'checkCircle',
  short: 'Свободен',
  long: 'Свободен для бронирования',
};

const CLIENT_UNAVAILABLE: RoomStatusView = {
  key: 'unavailable',
  tone: 'neutral',
  icon: 'lock',
  short: 'Недоступен',
  long: 'Недоступен для бронирования',
};

/** Сотрудники видят точный статус, клиенты — только «свободен / недоступен» (152-ФЗ). */
export function roomStatusView(status: RoomStatus, isAdmin: boolean): RoomStatusView {
  if (isAdmin) return STAFF[status] ?? STAFF.RESERVED;
  return status === 'VACANT' ? CLIENT_VACANT : CLIENT_UNAVAILABLE;
}

export function roomPhotos(room: InteractiveRoom): string[] {
  return room.photos && room.photos.length > 0 ? room.photos : CATEGORY_MEDIA[room.categoryId]?.photos || [];
}
