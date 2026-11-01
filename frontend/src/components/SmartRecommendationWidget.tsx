import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { smartRecommendations } from '../api/endpoints';
import type { HealthGoalOption, HealthRecommendationResult } from '../types';
import { Badge, Button, money, today } from './ui';

interface SmartRecommendationWidgetProps {
  onApplyRecommendation?: (rec: HealthRecommendationResult) => void;
}

export default function SmartRecommendationWidget({ onApplyRecommendation }: SmartRecommendationWidgetProps) {
  const navigate = useNavigate();
  const goals = smartRecommendations.getGoals();
  const [selectedGoalId, setSelectedGoalId] = useState<string>('CARDIO');
  const [hasMobilityIssue, setHasMobilityIssue] = useState<boolean>(false);
  const [hasAllergies, setHasAllergies] = useState<boolean>(false);
  const [nights, setNights] = useState<number>(14);
  const [recommendation, setRecommendation] = useState<HealthRecommendationResult | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [expanded, setExpanded] = useState<boolean>(true);

  useEffect(() => {
    setLoading(true);
    smartRecommendations
      .recommend({
        goalId: selectedGoalId,
        hasMobilityIssue,
        allergies: hasAllergies ? ['хвоя', 'грязи'] : [],
        nights,
      })
      .then(setRecommendation)
      .finally(() => setLoading(false));
  }, [selectedGoalId, hasMobilityIssue, hasAllergies, nights]);

  const handleApply = () => {
    if (!recommendation) return;
    if (onApplyRecommendation) {
      onApplyRecommendation(recommendation);
      return;
    }
    const checkIn = today(14);
    const checkOut = today(14 + nights);
    const catId = recommendation.packageSuggestion?.categoryId || (hasMobilityIssue ? 1 : 2);
    navigate(
      `/booking?category=${catId}&from=${checkIn}&to=${checkOut}&places=1&profile=${recommendation.profileId}&diet=${recommendation.dietId}`
    );
  };

  const handleApplyPackage = () => {
    if (!recommendation?.packageSuggestion) return;
    const pkg = recommendation.packageSuggestion;
    const checkIn = today(14);
    const checkOut = today(14 + pkg.durationNights);
    navigate(
      `/booking?category=${pkg.categoryId}&from=${checkIn}&to=${checkOut}&places=1&profile=${pkg.profileId}&diet=${pkg.dietId}&packageId=${pkg.id}`
    );
  };

  return (
    <div className="smart-rec-container">
      <div className="smart-rec-header">
        <div>
          <span className="smart-rec-badge">Клинический подбор</span>
          <h2 style={{ fontSize: '1.25rem', margin: '8px 0 4px 0', fontWeight: 800 }}>
            Подбор лечебного профиля и процедур
          </h2>
          <p style={{ margin: 0, fontSize: '0.88rem', color: 'var(--text-muted)' }}>
            На основе клинических протоколов санаторно-курортного лечения
          </p>
        </div>
        <Button variant="ghost" size="sm" onClick={() => setExpanded(!expanded)}>
          {expanded ? 'Свернуть' : 'Развернуть'}
        </Button>
      </div>

      {expanded && (
        <>
          {/* Step 1: Health Goal selection */}
          <div style={{ marginTop: 12 }}>
            <label style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-muted)' }}>
              1. ЦЕЛЕВОЙ ОЗДОРОВИТЕЛЬНЫЙ ПРОФИЛЬ:
            </label>
            <div className="goals-grid">
              {goals.map((goal: HealthGoalOption) => (
                <button
                  key={goal.id}
                  type="button"
                  className={`goal-card-btn ${selectedGoalId === goal.id ? 'selected' : ''}`}
                  onClick={() => setSelectedGoalId(goal.id)}
                >
                  <span className="goal-card-title">{goal.title}</span>
                  <span className="goal-card-desc">
                    {goal.description}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Step 2: Individual Preferences & Toggles */}
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: 18,
              padding: '14px 18px',
              background: 'var(--bg)',
              borderRadius: 'var(--radius-lg)',
              alignItems: 'center',
              marginTop: 14,
            }}
          >
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: '0.88rem' }}>
              <input
                type="checkbox"
                checked={hasMobilityIssue}
                onChange={(e) => setHasMobilityIssue(e.target.checked)}
              />
              <span>Трудности с лестницами (рекомендовать 1 этаж)</span>
            </label>

            <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: '0.88rem' }}>
              <input
                type="checkbox"
                checked={hasAllergies}
                onChange={(e) => setHasAllergies(e.target.checked)}
              />
              <span>Склонность к аллергиям (проверить противопоказания)</span>
            </label>

            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginLeft: 'auto' }}>
              <span style={{ fontSize: '0.88rem', color: 'var(--text-muted)' }}>Длительность курса:</span>
              <select
                value={nights}
                onChange={(e) => setNights(Number(e.target.value))}
                style={{ padding: '6px 12px', borderRadius: 8 }}
              >
                <option value={7}>7 ночей (экспресс-курс)</option>
                <option value={10}>10 ночей (стандарт)</option>
                <option value={12}>12 ночей</option>
                <option value={14}>14 ночей (полный терапевтический курс)</option>
                <option value={21}>21 ночь (санаторный максимум)</option>
              </select>
            </div>
          </div>

          {/* Step 3: Recommendation Result */}
          {loading ? (
            <p style={{ textAlign: 'center', padding: '24px', color: 'var(--text-muted)' }}>
              Анализ медицинских профилей и расчет курса...
            </p>
          ) : recommendation && (
            <div className="rec-result-box">
              <div className="rec-score-banner">
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div>
                    <span className="rec-score-val">{recommendation.matchScore}% соответствие</span>
                    <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                      Профиль: <strong>{recommendation.profileName}</strong> | Питание:{' '}
                      <strong>{recommendation.dietName}</strong>
                    </div>
                  </div>
                </div>
                <Badge variant="success">Проверено</Badge>
              </div>

              {/* Safety / Contraindication Alerts if any */}
              {recommendation.contraindicationsAlert.length > 0 && (
                <div
                  style={{
                    background: 'var(--warning-soft, #fffbeb)',
                    border: '1px solid var(--warning, #f59e0b)',
                    borderRadius: 8,
                    padding: 12,
                    marginBottom: 14,
                    fontSize: '0.85rem',
                  }}
                >
                  <strong>Корректировка по противопоказаниям:</strong>
                  <ul style={{ margin: '4px 0 0 18px', padding: 0 }}>
                    {recommendation.contraindicationsAlert.map((alert, i) => (
                      <li key={i}>{alert}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Floor accommodation note */}
              <p style={{ fontSize: '0.88rem', color: 'var(--text)', margin: '8px 0 14px 0' }}>
                <strong>Размещение:</strong> {recommendation.recommendedFloorNote}
              </p>

              {/* Recommended Procedures */}
              <h4 style={{ fontSize: '0.95rem', margin: '14px 0 8px 0' }}>
                Рекомендуемый комплекс медицинских процедур:
              </h4>
              <div className="rec-procedures-grid">
                {recommendation.procedures.map((proc, i) => (
                  <div key={i} className="rec-procedure-item">
                    <div className="rec-procedure-name">
                      {i + 1}. {proc.name}
                    </div>
                    <div className="rec-procedure-benefit">{proc.benefit}</div>
                  </div>
                ))}
              </div>

              {/* Lifestyle Advice */}
              <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', margin: '12px 0' }}>
                <strong>Рекомендация врача:</strong> {recommendation.goal.lifestyleAdvice}
              </div>

              {/* Suggested Ready-made Package Banner */}
              {recommendation.packageSuggestion && (
                <div
                  style={{
                    background: 'linear-gradient(135deg, rgba(13, 148, 136, 0.08), rgba(99, 102, 241, 0.08))',
                    border: '1.5px solid var(--primary)',
                    borderRadius: 'var(--radius-lg)',
                    padding: 16,
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginTop: 14,
                    flexWrap: 'wrap',
                    gap: 12,
                  }}
                >
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <Badge variant="primary">{recommendation.packageSuggestion.badge || 'Пакетное предложение'}</Badge>
                      <strong style={{ fontSize: '1.05rem' }}>
                        {recommendation.packageSuggestion.name}
                      </strong>
                    </div>
                    <p style={{ margin: '4px 0 0 0', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                      Включает проживание ({recommendation.packageSuggestion.durationNights} ночей), диетическое питание и лечебные процедуры
                    </p>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: '0.8rem', textDecoration: 'line-through', color: 'var(--text-muted)' }}>
                        {money(recommendation.packageSuggestion.basePrice)}
                      </div>
                      <div style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--primary)' }}>
                        {money(recommendation.packageSuggestion.packagePrice)}
                      </div>
                    </div>
                    <Button variant="primary" onClick={handleApplyPackage}>
                      Забронировать пакет
                    </Button>
                  </div>
                </div>
              )}

              {/* Alternative button if no package or custom booking wanted */}
              {!recommendation.packageSuggestion && (
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 14 }}>
                  <Button variant="primary" onClick={handleApply}>
                    Перейти к бронированию курса →
                  </Button>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
