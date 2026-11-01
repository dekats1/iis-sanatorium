import { useState, type FormEvent } from 'react';
import { reviews } from '../api/endpoints';
import type { VoucherView } from '../types';
import { Button, ErrorBox, Modal } from './ui';

interface LeaveReviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  voucher: VoucherView;
  clientName?: string;
  onSuccess: () => void;
}

function StarRatingInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <span style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text)' }}>{label}</span>
      <div style={{ display: 'flex', gap: 4 }}>
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            type="button"
            onClick={() => onChange(star)}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              fontSize: '1.45rem',
              color: star <= value ? '#f59e0b' : 'var(--line)',
              padding: '0 2px',
              transition: 'transform 0.15s ease',
            }}
            title={`${star} из 5 звёзд`}
          >
            ★
          </button>
        ))}
      </div>
    </div>
  );
}

export default function LeaveReviewModal({
  isOpen,
  onClose,
  voucher,
  clientName = 'Отдыхающий гость',
  onSuccess,
}: LeaveReviewModalProps) {
  const [overallRating, setOverallRating] = useState(5);
  const [npsScore, setNpsScore] = useState(10);
  const [roomRating, setRoomRating] = useState(5);
  const [treatmentRating, setTreatmentRating] = useState(5);
  const [foodRating, setFoodRating] = useState(5);
  const [serviceRating, setServiceRating] = useState(5);
  const [comment, setComment] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!comment.trim()) {
      setError(new Error('Пожалуйста, напишите пару слов о ваших впечатлениях'));
      return;
    }

    setBusy(true);
    try {
      await reviews.create({
        voucherId: voucher.id,
        clientId: voucher.clientId,
        clientName,
        categoryName: voucher.categoryId ? `Категория #${voucher.categoryId}` : 'Номер санатория',
        roomNumber: voucher.roomNumber || undefined,
        stayDates: `${voucher.checkIn ?? ''} — ${voucher.checkOut ?? ''}`,
        overallRating,
        npsScore,
        categoriesRating: {
          room: roomRating,
          treatment: treatmentRating,
          food: foodRating,
          service: serviceRating,
        },
        comment: comment.trim(),
      });
      onSuccess();
      onClose();
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Оценка отдыха и лечения • Путёвка #${voucher.id}`}
      size="md"
    >
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <ErrorBox error={error} />

        {/* Bonus Reward Notification */}
        <div
          style={{
            background: 'linear-gradient(135deg, rgba(13, 148, 136, 0.12), rgba(16, 185, 129, 0.12))',
            border: '1px solid rgba(13, 148, 136, 0.3)',
            borderRadius: 8,
            padding: '12px 14px',
            display: 'flex',
            alignItems: 'center',
            gap: 10,
          }}
        >
          <span style={{ fontSize: '1.4rem' }}>🎁</span>
          <div style={{ fontSize: '0.86rem', color: 'var(--text)' }}>
            <strong>+50 бонусных баллов лояльности!</strong>
            <div style={{ color: 'var(--text-muted)' }}>
              Начислим на ваш бонусный счёт сразу после отправки честного отзыва.
            </div>
          </div>
        </div>

        {/* Overall Rating */}
        <div style={{ background: 'var(--bg-subtle)', padding: 14, borderRadius: 8 }}>
          <StarRatingInput
            label="Общая оценка отдыха в санатории:"
            value={overallRating}
            onChange={setOverallRating}
          />
        </div>

        {/* Detailed Category Star Ratings */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: '0 4px' }}>
          <StarRatingInput
            label="Номер и комфорт проживания:"
            value={roomRating}
            onChange={setRoomRating}
          />
          <StarRatingInput
            label="Медицинские процедуры и врачи:"
            value={treatmentRating}
            onChange={setTreatmentRating}
          />
          <StarRatingInput
            label="Диетическое питание и столовая:"
            value={foodRating}
            onChange={setFoodRating}
          />
          <StarRatingInput
            label="Сервис и забота персонала:"
            value={serviceRating}
            onChange={setServiceRating}
          />
        </div>

        {/* NPS Scale 0 to 10 */}
        <div style={{ borderTop: '1px solid var(--line)', paddingTop: 14 }}>
          <label style={{ display: 'block', fontSize: '0.88rem', fontWeight: 600, marginBottom: 8, color: 'var(--text)' }}>
            С какой вероятностью вы порекомендуете санаторий друзьям? (NPS)
          </label>
          <div style={{ display: 'flex', gap: 4, justifyContent: 'space-between' }}>
            {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((score) => {
              const isSelected = npsScore === score;
              const isPromoter = score >= 9;
              const isDetractor = score <= 6;
              const activeColor = isPromoter
                ? '#10b981'
                : isDetractor
                ? '#ef4444'
                : '#f59e0b';

              return (
                <button
                  key={score}
                  type="button"
                  onClick={() => setNpsScore(score)}
                  style={{
                    flex: 1,
                    height: 36,
                    padding: 0,
                    borderRadius: 6,
                    border: isSelected ? `2px solid ${activeColor}` : '1px solid var(--line)',
                    background: isSelected ? activeColor : 'var(--surface)',
                    color: isSelected ? '#ffffff' : 'var(--text)',
                    fontWeight: isSelected ? 800 : 500,
                    fontSize: '0.85rem',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                  }}
                >
                  {score}
                </button>
              );
            })}
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 4 }}>
            <span>Точно нет (0)</span>
            <span>Нейтрально (7–8)</span>
            <span>Обязательно (9–10)</span>
          </div>
        </div>

        {/* Text Review */}
        <div>
          <label style={{ display: 'block', fontSize: '0.88rem', fontWeight: 600, marginBottom: 6, color: 'var(--text)' }}>
            Ваш отзыв и пожелания:
          </label>
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            rows={4}
            required
            placeholder="Что вам особенно понравилось? Какие процедуры принесли наибольшую пользу? Что мы могли бы улучшить?"
            style={{
              width: '100%',
              padding: '10px 12px',
              borderRadius: 8,
              border: '1.5px solid var(--line)',
              background: 'var(--bg)',
              color: 'var(--text)',
              fontSize: '0.9rem',
              boxSizing: 'border-box',
              resize: 'vertical',
            }}
          />
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 8 }}>
          <Button variant="secondary" onClick={onClose} disabled={busy}>
            Отмена
          </Button>
          <Button variant="primary" type="submit" disabled={busy}>
            {busy ? 'Отправка...' : 'Отправить отзыв и получить +50 б.'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
