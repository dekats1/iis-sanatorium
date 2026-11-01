import { useEffect, useState } from 'react';
import { Button, Modal } from './ui';

interface PhotoGalleryModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  photos: string[];
  initialIndex?: number;
  onBook?: () => void;
  bookButtonText?: string;
  extraInfo?: React.ReactNode;
}

const DEFAULT_PHOTO_LABELS = [
  'Основной интерьер и спальные места',
  'Оснащение, мебель и планировка',
  'Ванная комната и санузел',
  'Вид из окна номера',
];

export default function PhotoGalleryModal({
  isOpen,
  onClose,
  title,
  photos,
  initialIndex = 0,
  onBook,
  bookButtonText = 'Оформить бронирование',
  extraInfo,
}: PhotoGalleryModalProps) {
  const [currentIdx, setCurrentIdx] = useState(initialIndex);

  useEffect(() => {
    setCurrentIdx(initialIndex);
  }, [initialIndex, isOpen]);

  // Keyboard navigation: ArrowLeft, ArrowRight, Escape
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') {
        setCurrentIdx((i) => (i > 0 ? i - 1 : photos.length - 1));
      } else if (e.key === 'ArrowRight') {
        setCurrentIdx((i) => (i < photos.length - 1 ? i + 1 : 0));
      } else if (e.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, photos.length, onClose]);

  if (!isOpen || photos.length === 0) return null;

  const currentPhoto = photos[currentIdx];
  const photoCaption = DEFAULT_PHOTO_LABELS[currentIdx] || `Фотография ${currentIdx + 1}`;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title} size="lg">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {/* Main Large Viewport */}
        <div className="lightbox-viewport">
          <img
            src={currentPhoto}
            alt={`${title} - ${currentIdx + 1}`}
            className="lightbox-main-img"
          />

          {photos.length > 1 && (
            <>
              <button
                type="button"
                className="gallery-nav-btn prev"
                onClick={() => setCurrentIdx((i) => (i > 0 ? i - 1 : photos.length - 1))}
                title="Предыдущее фото (Стрелка влево)"
              >
                ‹
              </button>
              <button
                type="button"
                className="gallery-nav-btn next"
                onClick={() => setCurrentIdx((i) => (i < photos.length - 1 ? i + 1 : 0))}
                title="Следующее фото (Стрелка вправо)"
              >
                ›
              </button>
            </>
          )}

          <div className="lightbox-caption-bar">
            <span>{photoCaption}</span>
            <span className="lightbox-counter">
              {currentIdx + 1} из {photos.length}
            </span>
          </div>
        </div>

        {/* Thumbnail Strip */}
        {photos.length > 1 && (
          <div className="lightbox-thumbs-strip">
            {photos.map((p, idx) => (
              <button
                key={idx}
                type="button"
                className={`lightbox-thumb-btn ${idx === currentIdx ? 'active' : ''}`}
                onClick={() => setCurrentIdx(idx)}
                title={DEFAULT_PHOTO_LABELS[idx] || `Фото ${idx + 1}`}
              >
                <img src={p} alt="" className="lightbox-thumb-img" />
              </button>
            ))}
          </div>
        )}

        {extraInfo && <div>{extraInfo}</div>}

        {/* Action Controls */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 10 }}>
          {onBook && (
            <Button
              variant="primary"
              onClick={() => {
                onClose();
                onBook();
              }}
            >
              {bookButtonText}
            </Button>
          )}
          <Button variant="secondary" onClick={onClose}>
            Закрыть
          </Button>
        </div>
      </div>
    </Modal>
  );
}
