import { useEffect, useId, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { smartRecommendations } from '../api/endpoints';
import type { HealthGoalOption, HealthRecommendationResult } from '../types';
import { Icon, type IconName } from './icons';
import { Badge, Button, Field, Notice, Skeleton, money, today } from './ui';

interface SmartRecommendationWidgetProps {
  onApplyRecommendation?: (rec: HealthRecommendationResult) => void;
}

const GOAL_ICONS: Record<string, IconName> = {
  CARDIO: 'heart',
  JOINTS: 'pulse',
  RESPIRATORY: 'waves',
  ANTISTRESS: 'leaf',
  DETOX_METABOLISM: 'sparkles',
};

export default function SmartRecommendationWidget({ onApplyRecommendation }: SmartRecommendationWidgetProps) {
  const navigate = useNavigate();
  const bodyId = useId();
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

  const pkg = recommendation?.packageSuggestion;

  return (
    <section className="card gx-rec" aria-labelledby={`${bodyId}-title`}>
      <header className="gx-rec-head">
        <span className="gx-rec-icon" aria-hidden="true">
          <Icon name="stethoscope" size={22} />
        </span>
        <div className="gx-rec-head-text">
          <Badge variant="info" icon="sparkles">Клинический подбор</Badge>
          <h2 id={`${bodyId}-title`} className="gx-rec-title">Подбор лечебного профиля и процедур</h2>
          <p className="u-muted-sm u-m0">На основе клинических протоколов санаторно-курортного лечения</p>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setExpanded(!expanded)}
          aria-expanded={expanded}
          aria-controls={bodyId}
          icon={<Icon name={expanded ? 'chevronUp' : 'chevronDown'} size={18} />}
        >
          {expanded ? 'Свернуть' : 'Развернуть'}
        </Button>
      </header>

      {expanded && (
        <div id={bodyId} className="gx-rec-body">
          {/* Шаг 1: цель оздоровления */}
          <fieldset className="gx-rec-step">
            <legend className="gx-rec-step-title">
              <span className="gx-step-num">1</span> Целевой оздоровительный профиль
            </legend>
            <div className="gx-goals">
              {goals.map((goal: HealthGoalOption) => (
                <button
                  key={goal.id}
                  type="button"
                  className="gx-goal"
                  aria-pressed={selectedGoalId === goal.id}
                  onClick={() => setSelectedGoalId(goal.id)}
                >
                  <span className="gx-goal-icon" aria-hidden="true">
                    <Icon name={GOAL_ICONS[goal.id] ?? 'leaf'} size={20} />
                  </span>
                  <span className="gx-goal-text">
                    <span className="gx-goal-title">{goal.title}</span>
                    <span className="gx-goal-desc">{goal.description}</span>
                  </span>
                  {selectedGoalId === goal.id && (
                    <span className="gx-goal-check" aria-hidden="true">
                      <Icon name="check" size={16} />
                    </span>
                  )}
                </button>
              ))}
            </div>
          </fieldset>

          {/* Шаг 2: индивидуальные особенности */}
          <fieldset className="gx-rec-step">
            <legend className="gx-rec-step-title">
              <span className="gx-step-num">2</span> Индивидуальные особенности
            </legend>
            <div className="gx-prefs">
              <div className="gx-checks">
                <label className="gx-check">
                  <input type="checkbox" checked={hasMobilityIssue} onChange={(e) => setHasMobilityIssue(e.target.checked)} />
                  <span>Трудности с лестницами (рекомендовать 1 этаж)</span>
                </label>
                <label className="gx-check">
                  <input type="checkbox" checked={hasAllergies} onChange={(e) => setHasAllergies(e.target.checked)} />
                  <span>Склонность к аллергиям (проверить противопоказания)</span>
                </label>
              </div>
              <Field label="Длительность курса" className="gx-nights">
                <select value={nights} onChange={(e) => setNights(Number(e.target.value))}>
                  <option value={7}>7 ночей (экспресс-курс)</option>
                  <option value={10}>10 ночей (стандарт)</option>
                  <option value={12}>12 ночей</option>
                  <option value={14}>14 ночей (полный терапевтический курс)</option>
                  <option value={21}>21 ночь (санаторный максимум)</option>
                </select>
              </Field>
            </div>
          </fieldset>

          {/* Шаг 3: результат */}
          <div className="gx-rec-step" aria-live="polite" aria-busy={loading || undefined}>
            <h3 className="gx-rec-step-title">
              <span className="gx-step-num">3</span> Рекомендация
            </h3>

            {loading && !recommendation ? (
              <div className="gx-rec-result" aria-label="Анализ медицинских профилей и расчет курса...">
                <Skeleton height={56} />
                <Skeleton width="70%" />
                <div className="gx-procs">
                  {Array.from({ length: 4 }, (_, i) => (
                    <Skeleton key={i} height={64} />
                  ))}
                </div>
              </div>
            ) : (
              recommendation && (
                <div className={`gx-rec-result ${loading ? 'is-refreshing' : ''}`}>
                  <div className="gx-score">
                    <div className="gx-score-main">
                      <span className="gx-score-val">{recommendation.matchScore}% соответствие</span>
                      <span className="gx-score-bar" aria-hidden="true">
                        <span className="gx-score-fill" style={{ width: `${recommendation.matchScore}%` }} />
                      </span>
                      <span className="u-muted-sm">
                        Профиль: <strong>{recommendation.profileName}</strong> | Питание: <strong>{recommendation.dietName}</strong>
                      </span>
                    </div>
                    <Badge variant="good" icon="checkCircle">Проверено</Badge>
                  </div>

                  {recommendation.contraindicationsAlert.length > 0 && (
                    <Notice tone="warning">
                      <strong>Корректировка по противопоказаниям:</strong>
                      <ul className="gx-alert-list">
                        {recommendation.contraindicationsAlert.map((alert, i) => (
                          <li key={i}>{alert}</li>
                        ))}
                      </ul>
                    </Notice>
                  )}

                  <p className="gx-rec-line">
                    <Icon name={hasMobilityIssue ? 'alertTriangle' : 'home'} size={16} />
                    <span>
                      <strong>Размещение:</strong> {recommendation.recommendedFloorNote}
                    </span>
                  </p>

                  <div>
                    <h4 className="gx-section-title">Рекомендуемый комплекс медицинских процедур:</h4>
                    <ol className="gx-procs">
                      {recommendation.procedures.map((proc, i) => (
                        <li key={i} className="gx-proc">
                          <span className="gx-proc-num" aria-hidden="true">{i + 1}</span>
                          <span>
                            <span className="gx-proc-name">{proc.name}</span>
                            <span className="gx-proc-benefit">{proc.benefit}</span>
                          </span>
                        </li>
                      ))}
                    </ol>
                  </div>

                  <p className="gx-rec-line gx-rec-advice">
                    <Icon name="stethoscope" size={16} />
                    <span>
                      <strong>Рекомендация врача:</strong> {recommendation.goal.lifestyleAdvice}
                    </span>
                  </p>

                  {pkg ? (
                    <div className="gx-package">
                      <div className="gx-package-info">
                        <div className="u-inline-gap u-flex-wrap">
                          <Badge variant="info" icon="tag">{pkg.badge || 'Пакетное предложение'}</Badge>
                          <strong className="gx-package-name">{pkg.name}</strong>
                        </div>
                        <p className="u-muted-sm u-m0">
                          Включает проживание ({pkg.durationNights} ночей), диетическое питание и лечебные процедуры
                        </p>
                      </div>
                      <div className="gx-package-buy">
                        <div className="u-right">
                          <div className="gx-price-old">{money(pkg.basePrice)}</div>
                          <div className="gx-price-new">{money(pkg.packagePrice)}</div>
                        </div>
                        <Button variant="primary" onClick={handleApplyPackage}>
                          Забронировать пакет
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="row-end">
                      <Button variant="primary" onClick={handleApply} icon={<Icon name="arrowRight" size={18} />}>
                        Перейти к бронированию курса
                      </Button>
                    </div>
                  )}
                </div>
              )
            )}
          </div>
        </div>
      )}
    </section>
  );
}
