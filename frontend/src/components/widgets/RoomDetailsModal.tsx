import { useState } from 'react';
import type { InteractiveRoom, RoomStatus } from '../../types';
import { Icon } from '../icons';
import { Badge, Button, Modal, Notice, money } from '../ui';
import RoomGallery from './RoomGallery';
import { roomPhotos, roomStatusView } from './roomStatus';

interface RoomDetailsModalProps {
  room: InteractiveRoom;
  isAdmin: boolean;
  busy: boolean;
  onClose: () => void;
  onBook: (room: InteractiveRoom) => void;
  onStatusChange: (status: RoomStatus) => void;
  onShowVacant: () => void;
}

/** Карточка номера: галерея, характеристики, размещение (только персоналу) и действия. */
export default function RoomDetailsModal({ room, isAdmin, busy, onClose, onBook, onStatusChange, onShowVacant }: RoomDetailsModalProps) {
  const [photoIdx, setPhotoIdx] = useState(0);
  const photos = roomPhotos(room);
  const view = roomStatusView(room.status, isAdmin);
  const isVacant = room.status === 'VACANT';

  const footer = (
    <>
      {isAdmin && room.status === 'CLEANING' && (
        <Button variant="outline" icon={<Icon name="check" size={18} />} loading={busy} onClick={() => onStatusChange('VACANT')}>
          Завершить уборку
        </Button>
      )}
      {isAdmin && isVacant && (
        <Button variant="outline" icon={<Icon name="droplet" size={18} />} loading={busy} onClick={() => onStatusChange('CLEANING')}>
          Назначить уборку
        </Button>
      )}
      {isVacant ? (
        <Button variant="primary" icon={<Icon name="arrowRight" size={18} />} onClick={() => onBook(room)}>
          Забронировать №{room.roomNumber}
        </Button>
      ) : !isAdmin ? (
        <>
          <Button variant="secondary" onClick={onClose}>
            Закрыть
          </Button>
          <Button variant="outline" icon={<Icon name="filter" size={18} />} onClick={onShowVacant}>
            Показать свободные номера
          </Button>
        </>
      ) : (
        <Button variant="secondary" onClick={onClose}>
          Закрыть
        </Button>
      )}
    </>
  );

  return (
    <Modal isOpen onClose={onClose} title={`Номер №${room.roomNumber} — ${room.categoryName}`} size="lg" footer={footer}>
      <div className="u-stack-16">
        <div className="gx-room-head">
          <div>
            <p className="gx-room-place">
              <Icon name="mapPin" size={16} /> {room.building}, {room.floor} этаж
            </p>
            <p className="gx-room-price">
              {money(room.pricePerDay)} <span>/ сутки</span>
            </p>
          </div>
          <Badge variant={view.tone} icon={view.icon}>
            {view.long}
          </Badge>
        </div>

        {photos.length > 0 && (
          <RoomGallery
            photos={photos}
            index={photoIdx}
            onIndexChange={setPhotoIdx}
            title={`Фото номера ${room.roomNumber}`}
            seed={room.categoryId}
          />
        )}

        {/* Вежливое уведомление клиенту: без раскрытия причины недоступности */}
        {!isAdmin && !isVacant && (
          <Notice tone="info">
            Данный номер в настоящее время недоступен для бронирования. Вы можете ознакомиться с оснащением номера или выбрать любой из доступных свободных номеров на плане.
          </Notice>
        )}

        {room.notes && (isAdmin || isVacant) && (
          <div className="gx-room-note">
            <Icon name="info" size={18} />
            <span>
              <strong>Особенность:</strong> {room.notes}
            </span>
          </div>
        )}

        <div className="gx-room-facts">
          <div className="gx-room-fact">
            <span className="gx-room-fact-label"><Icon name="users" size={16} /> Вместимость</span>
            <span>
              {room.capacity} {room.capacity === 1 ? 'место' : 'места'}
            </span>
          </div>
          <div className="gx-room-fact">
            <span className="gx-room-fact-label"><Icon name="mountain" size={16} /> Вид из окна</span>
            <span>{room.windowView}</span>
          </div>
        </div>

        {room.amenities.length > 0 && (
          <div>
            <h4 className="gx-section-title">Удобства</h4>
            <ul className="gx-amenities">
              {room.amenities.map((amenity, i) => (
                <li key={i}>
                  <Icon name="check" size={14} /> {amenity}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Данные о госте — только персоналу */}
        {isAdmin && (room.status === 'OCCUPIED' || room.status === 'RESERVED') && (
          <div className="gx-room-stay">
            <h4 className="gx-section-title">Текущее размещение</h4>
            <dl className="gx-room-stay-list">
              <div>
                <dt>Гость</dt>
                <dd>{room.currentGuestName || 'Не указан'}</dd>
              </div>
              <div>
                <dt>Путёвка</dt>
                <dd><code>{room.voucherCode || '—'}</code></dd>
              </div>
              <div>
                <dt>Период</dt>
                <dd>{room.checkInDate} — {room.checkOutDate}</dd>
              </div>
            </dl>
          </div>
        )}
      </div>
    </Modal>
  );
}
