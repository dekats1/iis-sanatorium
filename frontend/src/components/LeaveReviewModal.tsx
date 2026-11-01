import { useId, useState, type FormEvent } from 'react';
import { reviews } from '../api/endpoints';
import type { VoucherView } from '../types';
import { Button, ErrorBox, Field, Modal } from './ui';
import { Icon } from './icons';

interface LeaveReviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  voucher: VoucherView;
  clientName?: string;
  onSuccess: () => void;
}

const STAR_WORDS = ['', 'Плохо', 'Так себе', 'Нормально', 'Хорошо', 'Отлично'];

function StarRatingInput({
  label,
  value,
  onChange,
  large = false,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  large?: boolean;
}) {
  const labelId = useId();
  return (
    <div className={`gx-stars-row ${large ? 'is-large' : ''}`}>
      <span id={labelId} className="gx-stars-label">{label}</span>
      <div className="gx-stars" role="group" aria-labelledby={labelId}>
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            type="button"
            className={`gx-star ${star <= value ? 'is-on' : ''}`}
            aria-pressed={star === value}
            aria-label={`${star} из 5 звёзд`}
            title={`${star} из 5 звёзд`}
            onClick={() => onChange(star)}
          >
            <Icon name="star" size={large ? 26 : 22} />
          </button>
        ))}
        <span className="gx-stars-word" aria-hidden="true">{STAR_WORDS[value]}</span>
      </div>
    </div>
  );
}

function npsTone(score: number): 'promoter' | 'passive' | 'detractor' {
  if (score >= 9) return 'promoter';
  if (score <= 6) return 'detractor';
  return 'passive';
}

export default function LeaveReviewModal({
  isOpen,
  onClose,
  voucher,
  clientName = 'Отдыхающий гость',
  onSuccess,
}: LeaveReviewModalProps) {
  const formId = useId();
  const npsLabelId = useId();
  const [overallRating, setOverallRating] = useState(5);
  const [npsScore, setNpsScore] = useState(10);
  const [roomRating, setRoomRating] = useState(5);
  const [treatmentRating, setTreatmentRating] = useState(5);
  const [foodRating, setFoodRating] = useState(5);
  const [serviceRating, setServiceRating] = useState(5);
  const [comment, setComment] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [commentError, setCommentError] = useState<string | undefined>(undefined);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setCommentError(undefined);

    if (!comment.trim()) {
      setCommentError('Пожалуйста, напишите пару слов о ваших впечатлениях');
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
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={busy}>
            Отмена
          </Button>
          <Button variant="primary" type="submit" form={formId} loading={busy} icon={<Icon name="star" size={18} />}>
            {busy ? 'Отправка...' : 'Отправить отзыв и получить +50 б.'}
          </Button>
        </>
      }
    >
      <form id={formId} onSubmit={handleSubmit} className="u-stack-16" noValidate>
        <ErrorBox error={error} />

        <div className="gx-bonus">
          <span className="gx-bonus-icon" aria-hidden="true">
            <Icon name="sparkles" size={20} />
          </span>
          <div>
            <strong>+50 бонусных баллов лояльности!</strong>
            <div className="u-muted-sm">Начислим на ваш бонусный счёт сразу после отправки честного отзыва.</div>
          </div>
        </div>

        <div className="gx-review-overall">
          <StarRatingInput label="Общая оценка отдыха в санатории:" value={overallRating} onChange={setOverallRating} large />
        </div>

        <div className="gx-review-cats">
          <StarRatingInput label="Номер и комфорт проживания:" value={roomRating} onChange={setRoomRating} />
          <StarRatingInput label="Медицинские процедуры и врачи:" value={treatmentRating} onChange={setTreatmentRating} />
          <StarRatingInput label="Диетическое питание и столовая:" value={foodRating} onChange={setFoodRating} />
          <StarRatingInput label="Сервис и забота персонала:" value={serviceRating} onChange={setServiceRating} />
        </div>

        <div className="gx-nps">
          <span id={npsLabelId} className="gx-nps-label">
            С какой вероятностью вы порекомендуете санаторий друзьям? (NPS)
          </span>
          <div className="gx-nps-scale" role="group" aria-labelledby={npsLabelId}>
            {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((score) => (
              <button
                key={score}
                type="button"
                className={`gx-nps-btn tone-${npsTone(score)}`}
                aria-pressed={npsScore === score}
                aria-label={`${score} из 10`}
                onClick={() => setNpsScore(score)}
              >
                {score}
              </button>
            ))}
          </div>
          <div className="gx-nps-legend" aria-hidden="true">
            <span>Точно нет (0)</span>
            <span>Нейтрально (7–8)</span>
            <span>Обязательно (9–10)</span>
          </div>
        </div>

        <Field label="Ваш отзыв и пожелания:" required error={commentError}>
          <textarea
            value={comment}
            onChange={(e) => {
              setComment(e.target.value);
              if (commentError) setCommentError(undefined);
            }}
            rows={4}
            required
            aria-invalid={commentError ? true : undefined}
            placeholder="Что вам особенно понравилось? Какие процедуры принесли наибольшую пользу? Что мы могли бы улучшить?"
          />
        </Field>
      </form>
    </Modal>
  );
}
