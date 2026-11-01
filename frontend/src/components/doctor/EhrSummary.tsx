import { Badge, formatDateTime, today } from '../ui';
import { Icon, type IconName } from '../icons';
import type { DoctorNote, EhrRecord, VisitType } from '../../types';

type VitalTone = 'ok' | 'warn' | 'bad';

function Vital({
  icon,
  label,
  value,
  unit,
  status,
  tone = 'ok',
}: {
  icon: IconName;
  label: string;
  value: string | number;
  unit?: string;
  status?: string;
  tone?: VitalTone;
}) {
  return (
    <div className="dc-vital">
      <span className="dc-vital-label">
        <Icon name={icon} size={16} />
        {label}
      </span>
      <span className="dc-vital-value">
        {value}
        {unit && <span className="dc-vital-unit">{unit}</span>}
      </span>
      {status && (
        <span className={`dc-vital-status is-${tone}`}>
          <Icon name={tone === 'ok' ? 'checkCircle' : 'alertTriangle'} size={14} />
          {status}
        </span>
      )}
    </div>
  );
}

/** Сводка медкарты: санаторно-курортная карта, аллергоанамнез и основные показатели. */
export function EhrSummary({ record, detailed = true }: { record: EhrRecord; detailed?: boolean }) {
  const systolic = record.systolicBp ?? 120;
  const diastolic = record.diastolicBp ?? 80;
  const bmi = record.bmi ?? 23.5;
  const hypertension = systolic > 139;
  const overweight = bmi >= 25;
  const hasAlerts = record.allergies.length > 0 || record.contraindications.length > 0;

  return (
    <div className="dc-ehr">
      <div className="dc-ehr-head">
        <div>
          <span className="dc-eyebrow">Санаторно-курортная карта</span>
          <span className="dc-ehr-card-no">
            {record.sanatoriumCardNumber ?? 'СКК-2026/001'}
            <span className="u-muted-sm"> от {record.cardIssuedDate ?? today()}</span>
          </span>
        </div>
        <div>
          <span className="dc-eyebrow">Основной диагноз</span>
          <span className="u-semibold">{record.mainDiagnosis || 'Не указан'}</span>
        </div>
        <Badge variant="info" icon="utensils">
          Диета: {record.dietCode || 'Стандартная'}
        </Badge>
      </div>

      {hasAlerts && (
        <div className="dc-alert" role="note">
          <div className="dc-alert-title">
            <Icon name="alertTriangle" size={18} />
            Аллергоанамнез и противопоказания пациента
          </div>
          {record.allergies.length > 0 && (
            <div className="dc-tag-row">
              <span className="dc-tag-label">Аллергии:</span>
              {record.allergies.map((a, i) => (
                <span key={`${a}-${i}`} className="dc-tag is-danger">
                  {a}
                </span>
              ))}
            </div>
          )}
          {record.contraindications.length > 0 && (
            <div className="dc-tag-row">
              <span className="dc-tag-label">Противопоказания:</span>
              {record.contraindications.map((c, i) => (
                <span key={`${c}-${i}`} className="dc-tag is-warning">
                  {c}
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="dc-vitals">
        <Vital
          icon="heart"
          label="Артериальное давление"
          value={`${systolic} / ${diastolic}`}
          unit="мм рт. ст."
          status={detailed ? (hypertension ? 'Гипертензия' : 'В пределах нормы') : undefined}
          tone={hypertension ? 'bad' : 'ok'}
        />
        <Vital
          icon="pulse"
          label="Пульс (ЧСС)"
          value={record.pulseBpm ?? 72}
          unit="уд/мин"
          status={detailed ? 'Ритм синусовый' : undefined}
        />
        <Vital
          icon="chart"
          label="Индекс массы тела"
          value={bmi}
          unit="кг/м²"
          status={detailed ? (overweight ? 'Избыточная масса' : 'Нормальный вес') : undefined}
          tone={overweight ? 'warn' : 'ok'}
        />
        <Vital
          icon="user"
          label="Рост / вес"
          value={`${record.heightCm ?? 175} см / ${record.weightKg ?? 72}`}
          unit="кг"
        />
        <Vital
          icon="droplet"
          label="Группа крови"
          value={record.bloodType || 'A (II) Rh+'}
          status={detailed ? 'Подтверждено лабораторией' : undefined}
        />
      </div>
    </div>
  );
}

const VISIT_META: Record<VisitType, { label: string; tone: 'info' | 'good' | 'neutral' }> = {
  INITIAL: { label: 'Первичный осмотр', tone: 'info' },
  CONTROL: { label: 'Контрольный осмотр', tone: 'neutral' },
  DISCHARGE: { label: 'Выписной эпикриз', tone: 'good' },
};

/** Запись клинического дневника (осмотр врача). */
export function DoctorNoteCard({ note }: { note: DoctorNote }) {
  const meta = VISIT_META[note.visitType] ?? VISIT_META.CONTROL;
  return (
    <article className="dc-note">
      <header className="dc-note-head">
        <div className="dc-note-who">
          <span className="dc-note-avatar" aria-hidden="true">
            <Icon name="stethoscope" size={18} />
          </span>
          <span className="u-semibold">{note.doctorName}</span>
          <Badge variant={meta.tone}>{meta.label}</Badge>
        </div>
        <time className="u-muted-sm" dateTime={note.createdAt}>
          {formatDateTime(note.createdAt)}
        </time>
      </header>
      <dl className="dc-note-body">
        {note.complaints && (
          <div>
            <dt>Жалобы пациента</dt>
            <dd>{note.complaints}</dd>
          </div>
        )}
        {note.objectiveStatus && (
          <div>
            <dt>Объективный статус / данные осмотра</dt>
            <dd>{note.objectiveStatus}</dd>
          </div>
        )}
        {note.recommendations && (
          <div>
            <dt>Лечебные рекомендации и режим</dt>
            <dd className="dc-note-reco">{note.recommendations}</dd>
          </div>
        )}
      </dl>
    </article>
  );
}
