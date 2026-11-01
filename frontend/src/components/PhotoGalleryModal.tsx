import { useEffect, useState, type ReactNode } from 'react';
import { Button, Modal } from './ui';
import RoomGallery from './widgets/RoomGallery';

interface PhotoGalleryModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  photos: string[];
  initialIndex?: number;
  onBook?: () => void;
  bookButtonText?: string;
  extraInfo?: ReactNode;
}

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

  if (!isOpen || photos.length === 0) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Закрыть
          </Button>
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
        </>
      }
    >
      <div className="u-stack-12">
        <RoomGallery photos={photos} index={currentIdx} onIndexChange={setCurrentIdx} title={title} keyboard />
        {extraInfo && <div>{extraInfo}</div>}
      </div>
    </Modal>
  );
}
