import { useEffect } from 'react';
import { Icon } from '../icons';
import { RoomImage } from '../RoomArt';

export const DEFAULT_PHOTO_LABELS = [
  'Основной интерьер и спальные места',
  'Оснащение, мебель и планировка',
  'Ванная комната и санузел',
  'Вид из окна номера',
];

interface RoomGalleryProps {
  photos: string[];
  index: number;
  onIndexChange: (index: number) => void;
  /** Основа для alt: «<title> - N». */
  title: string;
  /** Seed запасной иллюстрации для обычных URL. */
  seed?: number;
  captions?: string[];
  /** Листать клавишами ←/→ (пока галерея на экране). */
  keyboard?: boolean;
}

/** Лайтбокс: большой кадр, стрелки, подпись со счётчиком и лента миниатюр. */
export default function RoomGallery({
  photos,
  index,
  onIndexChange,
  title,
  seed = 0,
  captions = DEFAULT_PHOTO_LABELS,
  keyboard = true,
}: RoomGalleryProps) {
  const count = photos.length;
  const safeIndex = count === 0 ? 0 : Math.min(Math.max(index, 0), count - 1);
  const prev = () => onIndexChange(safeIndex > 0 ? safeIndex - 1 : count - 1);
  const next = () => onIndexChange(safeIndex < count - 1 ? safeIndex + 1 : 0);

  useEffect(() => {
    if (!keyboard || count < 2) return undefined;
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName)) return;
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        onIndexChange(safeIndex > 0 ? safeIndex - 1 : count - 1);
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        onIndexChange(safeIndex < count - 1 ? safeIndex + 1 : 0);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [keyboard, count, safeIndex, onIndexChange]);

  if (count === 0) return null;

  const caption = captions[safeIndex] || `Фотография ${safeIndex + 1}`;

  return (
    <div className="gx-gallery">
      <div className="gx-viewport">
        <RoomImage
          src={photos[safeIndex]}
          seed={seed + safeIndex}
          alt={`${title} - ${safeIndex + 1}`}
          className="gx-main-img"
        />

        {count > 1 && (
          <>
            <button type="button" className="gx-nav gx-nav-prev" onClick={prev} aria-label="Предыдущее фото" title="Предыдущее фото (Стрелка влево)">
              <Icon name="chevronLeft" size={20} />
            </button>
            <button type="button" className="gx-nav gx-nav-next" onClick={next} aria-label="Следующее фото" title="Следующее фото (Стрелка вправо)">
              <Icon name="chevronRight" size={20} />
            </button>
          </>
        )}

        <div className="gx-caption">
          <span className="gx-caption-text">{caption}</span>
          <span className="gx-counter" aria-live="polite">
            {safeIndex + 1} из {count}
          </span>
        </div>
      </div>

      {count > 1 && (
        <div className="gx-thumbs" role="group" aria-label="Миниатюры фотографий">
          {photos.map((p, i) => (
            <button
              key={`${p}-${i}`}
              type="button"
              className="gx-thumb"
              aria-current={i === safeIndex ? 'true' : undefined}
              aria-label={`Фото ${i + 1}: ${captions[i] || `Фотография ${i + 1}`}`}
              title={captions[i] || `Фото ${i + 1}`}
              onClick={() => onIndexChange(i)}
            >
              <RoomImage src={p} seed={seed + i} alt="" className="gx-thumb-img" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
