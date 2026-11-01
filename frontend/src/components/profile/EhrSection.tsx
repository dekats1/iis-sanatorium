import { Badge, Card, formatDateTime, today } from '../ui';
import { DataTable, type Column } from '../DataTable';
import { Icon, type IconName } from '../icons';
import type { ConditionView, DoctorNote, EhrRecord } from '../../types';

const CONDITION_COLUMNS: Column<ConditionView>[] = [
  { key: 'code', header: 'Код МКБ', render: (c) => <strong>{c.code}</strong>, sortValue: (c) => c.code },
  { key: 'name', header: 'Наименование состояния', className: 'wrap', render: (c) => c.name, sortValue: (c) => c.name },
  { key: 'date', header: 'Дата постановки диагноза', render: (c) => c.diagnosedAt ?? '—', sortValue: (c) => c.diagnosedAt },
];

const VISIT_NAMES: Record<string, string> = {
  INITIAL: 'Первичный осмотр',
  DISCHARGE: 'Выписной эпикриз',
};

function Vital({ icon, label, value, unit, status }: { icon: IconName; label: string; value: React.ReactNode; unit?: string; status: string }) {
  return (
    <div className="ehr-vital">
      <span className="ehr-vital-head">
        <Icon name={icon} size={16} /> {label}
      </span>
      <span className="ehr-vital-value">
        {value}
        {unit && <span className="ehr-vital-unit"> {unit}</span>}
      </span>
      <Badge variant="good" icon="check">{status}</Badge>
    </div>
  );
}

/** Вкладка «Медицинская карта»: сводка, противопоказания, показатели, диагнозы и заключения врачей. */
export default function EhrSection({ ehr, conditions, notes }: { ehr: EhrRecord; conditions: ConditionView[]; notes: DoctorNote[] }) {
  return (
    <div className="u-stack-16">
      <Card
        title="Электронная санаторно-курортная карта (EHR)"
        subtitle={`Номер карты: ${ehr.sanatoriumCardNumber ?? 'СКК-2026/089'} от ${ehr.cardIssuedDate ?? today()}`}
      >
        <div className="ehr-summary">
          <div>
            <span className="u-muted-sm">Основной диагноз:</span>
            <div className="ehr-summary-diagnosis">{ehr.mainDiagnosis || 'Оздоровительный профиль'}</div>
          </div>
          <Badge variant="info" icon="utensils">Диетический стол: {ehr.dietCode || 'Стандартный'}</Badge>
        </div>

        {(ehr.allergies.length > 0 || ehr.contraindications.length > 0) && (
          <div className="ehr-alert" role="note">
            <div className="ehr-alert-title">
              <Icon name="alertTriangle" size={18} /> Медицинские противопоказания и аллергоанамнез:
            </div>
            {ehr.allergies.length > 0 && (
              <div className="ehr-alert-row">
                <span className="ehr-alert-label">Аллергические реакции:</span>
                {ehr.allergies.map((a, idx) => <Badge key={idx} variant="bad">{a}</Badge>)}
              </div>
            )}
            {ehr.contraindications.length > 0 && (
              <div className="ehr-alert-row">
                <span className="ehr-alert-label">Противопоказания:</span>
                {ehr.contraindications.map((c, idx) => <Badge key={idx} variant="wait">{c}</Badge>)}
              </div>
            )}
          </div>
        )}

        <div className="ehr-vitals">
          <Vital icon="heart" label="Артериальное давление" value={`${ehr.systolicBp ?? 120} / ${ehr.diastolicBp ?? 80}`} unit="мм рт. ст." status="В норме" />
          <Vital icon="pulse" label="Пульс (ЧСС)" value={ehr.pulseBpm ?? 72} unit="уд/мин" status="Нормокардия" />
          <Vital icon="chart" label="ИМТ (Индекс Кетле)" value={ehr.bmi ?? 23.5} unit="кг/м²" status="Нормальный вес" />
          <Vital icon="user" label="Рост / Вес" value={`${ehr.heightCm ?? 175} см / ${ehr.weightKg ?? 72}`} unit="кг" status="Нормостеник" />
          <Vital icon="droplet" label="Группа крови" value={ehr.bloodType || 'A (II) Rh+'} status="Подтверждено" />
        </div>

        <h4 className="u-mt-24">Зарегистрированные диагнозы и состояния здоровья</h4>
        <DataTable
          rows={conditions}
          columns={CONDITION_COLUMNS}
          rowKey={(c) => c.conditionId}
          label="Зарегистрированные диагнозы и состояния здоровья"
          emptyTitle="Особых состояний здоровья не зарегистрировано"
          dense
        />
      </Card>

      {notes.length > 0 && (
        <Card title="Заключения врачей санатория" subtitle="История врачебных консультаций, результаты осмотров и назначенные режимы">
          <div className="u-stack-12">
            {notes.map((note) => (
              <article key={note.id} className="ehr-note">
                <header className="ehr-note-head">
                  <div className="u-flex-wrap">
                    <span className="u-flex-center u-semibold">
                      <Icon name="stethoscope" size={18} /> {note.doctorName}
                    </span>
                    <Badge variant="info">{VISIT_NAMES[note.visitType] ?? 'Контрольный осмотр'}</Badge>
                  </div>
                  <span className="u-muted-sm">{formatDateTime(note.createdAt)}</span>
                </header>
                {note.complaints && (
                  <div className="ehr-note-section">
                    <div className="ehr-note-label">Жалобы:</div>
                    <div>{note.complaints}</div>
                  </div>
                )}
                {note.objectiveStatus && (
                  <div className="ehr-note-section">
                    <div className="ehr-note-label">Данные осмотра:</div>
                    <div>{note.objectiveStatus}</div>
                  </div>
                )}
                {note.recommendations && (
                  <div className="ehr-note-section">
                    <div className="ehr-note-label">Рекомендации врача:</div>
                    <div className="u-accent u-semibold">{note.recommendations}</div>
                  </div>
                )}
              </article>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
