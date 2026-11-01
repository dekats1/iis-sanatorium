import { useEffect, useState, type FormEvent } from 'react';
import { ApiError } from '../api/client';
import { clients, directory, ehr, medical } from '../api/endpoints';
import {
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorBox,
  Field,
  formatDateTime,
  Modal,
  TableWrap,
  today,
} from '../components/ui';
import type {
  AssignmentItem,
  AssignmentView,
  ClientView,
  ContraindicationWarning,
  DoctorNote,
  EhrRecord,
  Procedure,
  ScheduleEntry,
  VisitType,
} from '../types';

export default function DoctorPage() {
  const [activeTab, setActiveTab] = useState<'assignments' | 'daily' | 'ehr'>('assignments');
  const [procedures, setProcedures] = useState<Procedure[]>([]);
  const [voucherId, setVoucherId] = useState('');
  const [assignments, setAssignments] = useState<AssignmentView[]>([]);
  const [items, setItems] = useState<AssignmentItem[]>([{ procedureId: 0, sessions: 5 }]);
  const [warnings, setWarnings] = useState<ContraindicationWarning[]>([]);
  const [schedule, setSchedule] = useState<ScheduleEntry[]>([]);
  const [date, setDate] = useState(today());
  const [day, setDay] = useState<ScheduleEntry[]>([]);
  const [error, setError] = useState<unknown>(null);
  const [message, setMessage] = useState('');
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);

  // --- EHR state ---
  const [allClients, setAllClients] = useState<ClientView[]>([]);
  const [selectedClientId, setSelectedClientId] = useState<number>(1);
  const [patientEhr, setPatientEhr] = useState<EhrRecord | null>(null);
  const [doctorNotes, setDoctorNotes] = useState<DoctorNote[]>([]);
  const [isNoteModalOpen, setIsNoteModalOpen] = useState(false);
  const [isVitalsModalOpen, setIsVitalsModalOpen] = useState(false);

  // New Note form
  const [newNote, setNewNote] = useState({
    visitType: 'INITIAL' as VisitType,
    doctorName: 'Др. Смирнова Е. В.',
    complaints: '',
    objectiveStatus: '',
    recommendations: '',
  });

  // Vitals form
  const [vitalsForm, setVitalsForm] = useState({
    heightCm: 175,
    weightKg: 75,
    systolicBp: 120,
    diastolicBp: 80,
    pulseBpm: 72,
    bloodType: 'A (II) Rh+',
    mainDiagnosis: '',
    allergies: '',
    contraindications: '',
  });

  useEffect(() => {
    directory
      .procedures()
      .then((p) => {
        setProcedures(p);
        if (p[0]) setItems([{ procedureId: p[0].id, sessions: 5 }]);
      })
      .catch(setError);

    clients
      .search('')
      .then((cls) => {
        setAllClients(cls);
        if (cls[0]) setSelectedClientId(cls[0].id);
      })
      .catch(() => undefined);
  }, []);

  // Load EHR for selected client
  useEffect(() => {
    if (selectedClientId) {
      void (async () => {
        try {
          const [rec, notesList] = await Promise.all([
            ehr.get(selectedClientId),
            ehr.notes(selectedClientId),
          ]);
          setPatientEhr(rec);
          setDoctorNotes(notesList);
          setVitalsForm({
            heightCm: rec.heightCm ?? 170,
            weightKg: rec.weightKg ?? 70,
            systolicBp: rec.systolicBp ?? 120,
            diastolicBp: rec.diastolicBp ?? 80,
            pulseBpm: rec.pulseBpm ?? 72,
            bloodType: rec.bloodType ?? 'A (II) Rh+',
            mainDiagnosis: rec.mainDiagnosis ?? '',
            allergies: rec.allergies.join(', '),
            contraindications: rec.contraindications.join(', '),
          });
        } catch (err) {
          setError(err);
        }
      })();
    }
  }, [selectedClientId]);

  async function loadAssignments(id: number) {
    setError(null);
    try {
      const list = await medical.byVoucher(id);
      setAssignments(list);
      if (list.length === 0) {
        setMessage(`Для путёвки #${id} назначения пока не созданы.`);
      }
    } catch (err) {
      setError(err);
    }
  }

  async function find(e: FormEvent) {
    e.preventDefault();
    if (!voucherId) return;
    await loadAssignments(Number(voucherId));
  }

  async function assign(confirm: boolean) {
    setError(null);
    setMessage('');
    if (items.some((it) => !it.procedureId)) {
      setError(new Error('Выберите процедуру'));
      return;
    }
    try {
      const created = await medical.create({
        voucherId: Number(voucherId),
        items,
        confirmContraindications: confirm,
      });
      setWarnings([]);
      setMessage(`Назначение № ${created.id} успешно сформировано!`);
      setIsAssignModalOpen(false);
      await loadAssignments(Number(voucherId));
    } catch (err) {
      if (err instanceof ApiError && err.status === 409 && err.warnings.length > 0) {
        setWarnings(err.warnings);
      } else {
        setError(err);
      }
    }
  }

  async function plan(a: AssignmentView) {
    setError(null);
    try {
      const res = await medical.plan(a.id);
      setSchedule(res);
      setMessage(`Расписание для назначения № ${a.id} составлено (${res.length} сеансов)`);
    } catch (err) {
      setError(err);
    }
  }

  async function loadDay() {
    setError(null);
    try {
      setDay(await medical.day(date));
    } catch (err) {
      setError(err);
    }
  }

  async function markDone(slotId: number) {
    setError(null);
    try {
      await medical.done(slotId);
      await loadDay();
      setMessage('Сеанс процедуры отмечен как выполненный.');
    } catch (err) {
      setError(err);
    }
  }

  // EHR actions
  async function handleSaveVitals(e: FormEvent) {
    e.preventDefault();
    if (!patientEhr) return;
    setError(null);
    try {
      const updated = await ehr.update(selectedClientId, {
        heightCm: Number(vitalsForm.heightCm),
        weightKg: Number(vitalsForm.weightKg),
        systolicBp: Number(vitalsForm.systolicBp),
        diastolicBp: Number(vitalsForm.diastolicBp),
        pulseBpm: Number(vitalsForm.pulseBpm),
        bloodType: vitalsForm.bloodType,
        mainDiagnosis: vitalsForm.mainDiagnosis,
        allergies: vitalsForm.allergies
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean),
        contraindications: vitalsForm.contraindications
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean),
      });
      setPatientEhr(updated);
      setIsVitalsModalOpen(false);
      setMessage('Медицинские показатели гостя успешно обновлены в карте.');
    } catch (err) {
      setError(err);
    }
  }

  async function handleAddNote(e: FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await ehr.addNote({
        clientId: selectedClientId,
        doctorId: 1,
        doctorName: newNote.doctorName,
        visitType: newNote.visitType,
        complaints: newNote.complaints,
        objectiveStatus: newNote.objectiveStatus,
        recommendations: newNote.recommendations,
      });
      const fresh = await ehr.notes(selectedClientId);
      setDoctorNotes(fresh);
      setIsNoteModalOpen(false);
      setNewNote({
        visitType: 'INITIAL',
        doctorName: 'Др. Смирнова Е. В.',
        complaints: '',
        objectiveStatus: '',
        recommendations: '',
      });
      setMessage('Запись осмотра врача добавлена в электронную медкарту.');
    } catch (err) {
      setError(err);
    }
  }

  const setItem = (i: number, patch: Partial<AssignmentItem>) =>
    setItems((list) => list.map((it, idx) => (idx === i ? { ...it, ...patch } : it)));

  const selectedClient = allClients.find((c) => c.id === selectedClientId);

  return (
    <section>
      {/* Page Header */}
      <div className="page-head">
        <div>
          <h1>Рабочее место врача (Медицинский блок & EHR)</h1>
          <p className="card-subtitle">
            Электронные медицинские карты, назначение процедур, контроль противопоказаний и расписание сеансов
          </p>
        </div>
      </div>

      <ErrorBox error={error} />
      {message && <p className="ok">{message}</p>}

      {/* Tabs */}
      <div className="tabs">
        <button
          type="button"
          className={`tab ${activeTab === 'assignments' ? 'active' : ''}`}
          onClick={() => setActiveTab('assignments')}
        >
          Назначения по путёвкам
        </button>
        <button
          type="button"
          className={`tab ${activeTab === 'daily' ? 'active' : ''}`}
          onClick={() => {
            setActiveTab('daily');
            void loadDay();
          }}
        >
          Расписание на день
        </button>
        <button
          type="button"
          className={`tab ${activeTab === 'ehr' ? 'active' : ''}`}
          onClick={() => setActiveTab('ehr')}
        >
          Электронная медкарта (EHR)
        </button>
      </div>

      {/* TAB 1: Assignments by voucher */}
      {activeTab === 'assignments' && (
        <>
          <Card>
            <form className="inline" onSubmit={find}>
              <Field label="Номер путёвки" style={{ margin: 0, minWidth: 200 }}>
                <input
                  type="number"
                  min={1}
                  value={voucherId}
                  onChange={(e) => setVoucherId(e.target.value)}
                  placeholder="ID путёвки (напр. 1)"
                  required
                />
              </Field>
              <Button type="submit" variant="primary">
                Показать назначения
              </Button>
              {voucherId && (
                <Button type="button" variant="secondary" onClick={() => setIsAssignModalOpen(true)}>
                  + Новое назначение
                </Button>
              )}
            </form>
          </Card>

          {assignments.length > 0 && (
            <div className="grid" style={{ marginTop: 20 }}>
              {assignments.map((a) => (
                <Card
                  key={a.id}
                  title={`Назначение #${a.id}`}
                  subtitle={`Дата создания: ${formatDateTime(a.createdAt)}`}
                  actions={
                    <Button variant="primary" size="sm" onClick={() => void plan(a)}>
                      Распределить по кабинетам
                    </Button>
                  }
                >
                  <div style={{ marginTop: 12 }}>
                    <h5 style={{ margin: '0 0 8px', fontSize: '0.86rem', color: 'var(--text-muted)' }}>
                      ПРОЦЕДУРЫ И СЕАНСЫ:
                    </h5>
                    <ul style={{ margin: 0, paddingLeft: 20, lineHeight: 1.8 }}>
                      {a.items.map((it) => (
                        <li key={it.procedureId}>
                          <strong>{it.procedure}</strong>: {it.sessionsPlanned} сеансов
                        </li>
                      ))}
                    </ul>
                  </div>
                </Card>
              ))}
            </div>
          )}

          {schedule.length > 0 && (
            <Card
              title="Составленный график процедур"
              subtitle="Сформированные временные слоты и распределение по кабинетам"
              style={{ marginTop: 24 }}
            >
              <TableWrap>
                <table>
                  <thead>
                    <tr>
                      <th>Время сеанса</th>
                      <th>Процедура</th>
                      <th>Кабинет проведения</th>
                      <th>Статус выполнения</th>
                    </tr>
                  </thead>
                  <tbody>
                    {schedule.map((s) => (
                      <tr key={s.id}>
                        <td>
                          <strong>{formatDateTime(s.slot)}</strong>
                        </td>
                        <td>{s.procedure}</td>
                        <td>{s.cabinet}</td>
                        <td>
                          <Badge variant={s.done ? 'good' : 'wait'}>
                            {s.done ? 'Выполнено' : 'Запланировано'}
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </TableWrap>
            </Card>
          )}

          {/* Modal: New Assignment */}
          <Modal
            isOpen={isAssignModalOpen}
            onClose={() => setIsAssignModalOpen(false)}
            title={`Назначение процедур по путёвке #${voucherId}`}
            size="md"
          >
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void assign(false);
              }}
            >
              <p style={{ fontSize: '0.88rem', color: 'var(--text-muted)', marginBottom: 16 }}>
                Выберите необходимые лечебно-оздоровительные процедуры и количество сеансов.
              </p>

              {items.map((it, i) => (
                <div
                  key={i}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    marginBottom: 12,
                    background: 'var(--surface-alt)',
                    padding: 10,
                    borderRadius: 'var(--radius-md)',
                  }}
                >
                  <div style={{ flex: 1 }}>
                    <select
                      value={it.procedureId}
                      onChange={(e) => setItem(i, { procedureId: Number(e.target.value) })}
                    >
                      {procedures.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name} ({p.durationMin} мин)
                        </option>
                      ))}
                    </select>
                  </div>
                  <div style={{ width: 90 }}>
                    <input
                      type="number"
                      min={1}
                      max={30}
                      value={it.sessions}
                      onChange={(e) => setItem(i, { sessions: Number(e.target.value) })}
                      title="Количество сеансов"
                    />
                  </div>
                  {items.length > 1 && (
                    <Button
                      variant="danger"
                      size="sm"
                      type="button"
                      onClick={() => setItems((l) => l.filter((_, idx) => idx !== i))}
                    >
                      ×
                    </Button>
                  )}
                </div>
              ))}

              <div style={{ display: 'flex', gap: 10, margin: '14px 0' }}>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() =>
                    setItems((l) => [...l, { procedureId: procedures[0]?.id ?? 0, sessions: 5 }])
                  }
                >
                  + Добавить ещё процедуру
                </Button>
              </div>

              {warnings.length > 0 && (
                <div className="allergy-alert-banner" style={{ margin: '16px 0' }}>
                  <div className="allergy-alert-title">
                    ⚠️ Внимание! Выявлены медицинские противопоказания:
                  </div>
                  <ul style={{ margin: '6px 0 12px', paddingLeft: 20 }}>
                    {warnings.map((w) => (
                      <li key={`${w.procedureId}-${w.conditionId}`}>
                        <strong>{w.procedure}</strong> противопоказана при диагнозе: <em>{w.condition}</em>
                      </li>
                    ))}
                  </ul>
                  <Button variant="danger" size="sm" type="button" onClick={() => void assign(true)}>
                    Подтвердить и назначить вопреки противопоказаниям
                  </Button>
                </div>
              )}

              <div
                style={{
                  display: 'flex',
                  justifyContent: 'flex-end',
                  gap: 10,
                  marginTop: 20,
                  paddingTop: 16,
                  borderTop: '1px solid var(--line)',
                }}
              >
                <Button type="button" variant="secondary" onClick={() => setIsAssignModalOpen(false)}>
                  Отмена
                </Button>
                <Button type="submit" variant="primary">
                  Сохранить назначение
                </Button>
              </div>
            </form>
          </Modal>
        </>
      )}

      {/* TAB 2: Daily Schedule */}
      {activeTab === 'daily' && (
        <Card title="Расписание процедурных кабинетов на день" subtitle="Отметка посещений и выполнения назначений">
          <div className="filter-toolbar">
            <Field label="Дата расписания" style={{ margin: 0, minWidth: 200 }}>
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </Field>
            <Button variant="primary" onClick={() => void loadDay()}>
              Обновить расписание
            </Button>
          </div>

          <TableWrap>
            <table>
              <thead>
                <tr>
                  <th>Время слота</th>
                  <th>Пациент (Гость)</th>
                  <th>№ Путёвки</th>
                  <th>Процедура</th>
                  <th>Кабинет</th>
                  <th>Статус сеанса</th>
                  <th style={{ textAlign: 'right' }}>Действия</th>
                </tr>
              </thead>
              <tbody>
                {day.length === 0 ? (
                  <tr>
                    <td colSpan={7}>
                      <EmptyState title="На выбранную дату сеансов процедур не запланировано" />
                    </td>
                  </tr>
                ) : (
                  day.map((s) => (
                    <tr key={s.id}>
                      <td>
                        <strong>{formatDateTime(s.slot)}</strong>
                      </td>
                      <td>{s.clientName}</td>
                      <td>#{s.voucherId}</td>
                      <td>{s.procedure}</td>
                      <td>{s.cabinet}</td>
                      <td>
                        <Badge variant={s.done ? 'good' : 'wait'}>
                          {s.done ? 'Выполнено' : 'Ожидает проведения'}
                        </Badge>
                      </td>
                      <td style={{ textAlign: 'right' }} className="actions">
                        {s.done ? (
                          <span style={{ fontSize: '0.82rem', color: 'var(--ok)', fontWeight: 600 }}>
                            Завершено
                          </span>
                        ) : (
                          <Button variant="primary" size="sm" onClick={() => void markDone(s.id)}>
                            ✓ Отметить выполнение
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </TableWrap>
        </Card>
      )}

      {/* TAB 3: Electronic Health Record (EHR) */}
      {activeTab === 'ehr' && (
        <>
          <Card>
            <div className="filter-toolbar">
              <Field label="Пациент (Гость санатория)" style={{ margin: 0, minWidth: 320 }}>
                <select
                  value={selectedClientId}
                  onChange={(e) => setSelectedClientId(Number(e.target.value))}
                >
                  {allClients.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.lastName} {c.firstName} {c.middleName ?? ''} (род. {c.birthDate}, #{c.id})
                    </option>
                  ))}
                </select>
              </Field>

              <div style={{ display: 'flex', gap: 10 }}>
                <Button variant="primary" onClick={() => setIsNoteModalOpen(true)}>
                  + Добавить запись осмотра
                </Button>
                <Button variant="outline" onClick={() => setIsVitalsModalOpen(true)}>
                  ✏️ Редактировать медкарту
                </Button>
              </div>
            </div>

            {patientEhr && (
              <div style={{ marginTop: 14 }}>
                {/* Sanatorium Card Banner */}
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    background: 'var(--surface-alt)',
                    padding: '12px 18px',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--line)',
                    marginBottom: 18,
                  }}
                >
                  <div>
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                      Санаторно-курортная карта:
                    </span>
                    <div style={{ fontSize: '1.1rem', fontWeight: 750, color: 'var(--accent)' }}>
                      {patientEhr.sanatoriumCardNumber ?? 'СКК-2026/001'} (от {patientEhr.cardIssuedDate ?? today()})
                    </div>
                  </div>
                  <div>
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Основной диагноз:</span>
                    <div style={{ fontWeight: 650 }}>{patientEhr.mainDiagnosis || 'Не указан'}</div>
                  </div>
                  <div>
                    <Badge variant="info">Диета: {patientEhr.dietCode || 'Стандартная'}</Badge>
                  </div>
                </div>

                {/* Allergies & Contraindications Alert */}
                {(patientEhr.allergies.length > 0 || patientEhr.contraindications.length > 0) && (
                  <div className="allergy-alert-banner">
                    <div className="allergy-alert-title">
                      ⚠️ Аллергоанамнез и противопоказания пациента:
                    </div>
                    {patientEhr.allergies.length > 0 && (
                      <div style={{ marginBottom: 6 }}>
                        <span style={{ fontSize: '0.82rem', fontWeight: 650, color: '#8A2020', marginRight: 8 }}>
                          Аллергии:
                        </span>
                        <span className="allergy-tags">
                          {patientEhr.allergies.map((a, idx) => (
                            <span key={idx} className="allergy-tag">
                              {a}
                            </span>
                          ))}
                        </span>
                      </div>
                    )}
                    {patientEhr.contraindications.length > 0 && (
                      <div>
                        <span style={{ fontSize: '0.82rem', fontWeight: 650, color: '#8A2020', marginRight: 8 }}>
                          Противопоказания:
                        </span>
                        <span className="allergy-tags">
                          {patientEhr.contraindications.map((c, idx) => (
                            <span key={idx} className="allergy-tag" style={{ borderColor: '#D97706', color: '#92400E' }}>
                              {c}
                            </span>
                          ))}
                        </span>
                      </div>
                    )}
                  </div>
                )}

                {/* Vitals & Biometrics Grid */}
                <div className="ehr-vitals-grid">
                  <div className="ehr-vital-card">
                    <span className="ehr-vital-label">Артериальное давление (АД)</span>
                    <div className="ehr-vital-value">
                      {patientEhr.systolicBp ?? 120} / {patientEhr.diastolicBp ?? 80}
                      <span className="ehr-vital-unit">мм рт. ст.</span>
                    </div>
                    <span
                      className={`ehr-vital-status ${
                        (patientEhr.systolicBp ?? 120) > 139 ? 'alert' : 'normal'
                      }`}
                    >
                      {(patientEhr.systolicBp ?? 120) > 139 ? 'Гипертензия' : 'В пределах нормы'}
                    </span>
                  </div>

                  <div className="ehr-vital-card">
                    <span className="ehr-vital-label">Пульс (ЧСС)</span>
                    <div className="ehr-vital-value">
                      {patientEhr.pulseBpm ?? 72}
                      <span className="ehr-vital-unit">уд/мин</span>
                    </div>
                    <span className="ehr-vital-status normal">Ритм синусовый</span>
                  </div>

                  <div className="ehr-vital-card">
                    <span className="ehr-vital-label">Индекс массы тела (ИМТ)</span>
                    <div className="ehr-vital-value">
                      {patientEhr.bmi ?? 23.5}
                      <span className="ehr-vital-unit">кг/м²</span>
                    </div>
                    <span
                      className={`ehr-vital-status ${
                        (patientEhr.bmi ?? 23.5) >= 25 ? 'warning' : 'normal'
                      }`}
                    >
                      {(patientEhr.bmi ?? 23.5) >= 25 ? 'Избыточная масса' : 'Нормальный вес'}
                    </span>
                  </div>

                  <div className="ehr-vital-card">
                    <span className="ehr-vital-label">Рост / Вес</span>
                    <div className="ehr-vital-value">
                      {patientEhr.heightCm ?? 175}
                      <span className="ehr-vital-unit">см</span> / {patientEhr.weightKg ?? 72}
                      <span className="ehr-vital-unit">кг</span>
                    </div>
                    <span className="ehr-vital-status normal">Телосложение нормостеническое</span>
                  </div>

                  <div className="ehr-vital-card">
                    <span className="ehr-vital-label">Группа крови</span>
                    <div className="ehr-vital-value">{patientEhr.bloodType || 'A (II) Rh+'}</div>
                    <span className="ehr-vital-status normal">Подтверждено лабораторией</span>
                  </div>
                </div>
              </div>
            )}
          </Card>

          {/* Clinical notes / Examination diary */}
          <Card
            title="Клинический дневник и записи врачебных осмотров"
            subtitle="История приёмов, динамика состояния и выписные эпикризы"
            style={{ marginTop: 24 }}
          >
            {doctorNotes.length === 0 ? (
              <EmptyState
                title="В медкарте пока нет записей врачебных осмотров"
                description="Нажмите «Добавить запись осмотра», чтобы зафиксировать первичный приём или динамику лечения."
                action={
                  <Button variant="primary" size="sm" onClick={() => setIsNoteModalOpen(true)}>
                    + Добавить первую запись
                  </Button>
                }
              />
            ) : (
              doctorNotes.map((note) => (
                <div key={note.id} className="ehr-note-card">
                  <div className="ehr-note-header">
                    <div>
                      <span className="ehr-note-doctor">{note.doctorName}</span>
                      <Badge
                        variant={
                          note.visitType === 'INITIAL'
                            ? 'info'
                            : note.visitType === 'DISCHARGE'
                            ? 'good'
                            : 'neutral'
                        }
                        style={{ marginLeft: 10 }}
                      >
                        {note.visitType === 'INITIAL'
                          ? 'Первичный осмотр'
                          : note.visitType === 'DISCHARGE'
                          ? 'Выписной эпикриз'
                          : 'Контрольный осмотр'}
                      </Badge>
                    </div>
                    <span className="ehr-note-date">{formatDateTime(note.createdAt)}</span>
                  </div>

                  {note.complaints && (
                    <div className="ehr-note-section">
                      <div className="ehr-note-section-title">Жалобы пациента:</div>
                      <div>{note.complaints}</div>
                    </div>
                  )}

                  {note.objectiveStatus && (
                    <div className="ehr-note-section">
                      <div className="ehr-note-section-title">Объективный статус / Данные осмотра:</div>
                      <div>{note.objectiveStatus}</div>
                    </div>
                  )}

                  {note.recommendations && (
                    <div className="ehr-note-section">
                      <div className="ehr-note-section-title">Лечебные рекомендации и режим:</div>
                      <div style={{ color: 'var(--accent)', fontWeight: 550 }}>
                        {note.recommendations}
                      </div>
                    </div>
                  )}
                </div>
              ))
            )}
          </Card>

          {/* Modal: Add Doctor Note */}
          <Modal
            isOpen={isNoteModalOpen}
            onClose={() => setIsNoteModalOpen(false)}
            title={`Протокол врачебного осмотра: ${selectedClient ? `${selectedClient.lastName} ${selectedClient.firstName}` : ''}`}
            size="md"
          >
            <form onSubmit={handleAddNote}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                <Field label="Тип осмотра" required>
                  <select
                    value={newNote.visitType}
                    onChange={(e) =>
                      setNewNote({ ...newNote, visitType: e.target.value as VisitType })
                    }
                  >
                    <option value="INITIAL">Первичный приём врача</option>
                    <option value="CONTROL">Промежуточный / контрольный осмотр</option>
                    <option value="DISCHARGE">Заключительный осмотр (Выписной эпикриз)</option>
                  </select>
                </Field>

                <Field label="Лечащий врач" required>
                  <input
                    value={newNote.doctorName}
                    required
                    onChange={(e) => setNewNote({ ...newNote, doctorName: e.target.value })}
                  />
                </Field>
              </div>

              <Field label="Жалобы пациента">
                <textarea
                  rows={2}
                  placeholder="Опишите текущие жалобы гостя..."
                  value={newNote.complaints}
                  onChange={(e) => setNewNote({ ...newNote, complaints: e.target.value })}
                />
              </Field>

              <Field label="Объективный статус при осмотре" required>
                <textarea
                  rows={3}
                  required
                  placeholder="Состояние кожных покровов, органов дыхания, ЧСС, тоны сердца, подвижность суставов..."
                  value={newNote.objectiveStatus}
                  onChange={(e) => setNewNote({ ...newNote, objectiveStatus: e.target.value })}
                />
              </Field>

              <Field label="Назначения и рекомендации" required>
                <textarea
                  rows={2}
                  required
                  placeholder="Рекомендуемый двигательный режим, процедуры, диета..."
                  value={newNote.recommendations}
                  onChange={(e) => setNewNote({ ...newNote, recommendations: e.target.value })}
                />
              </Field>

              <div
                style={{
                  display: 'flex',
                  justifyContent: 'flex-end',
                  gap: 10,
                  marginTop: 20,
                  paddingTop: 16,
                  borderTop: '1px solid var(--line)',
                }}
              >
                <Button type="button" variant="secondary" onClick={() => setIsNoteModalOpen(false)}>
                  Отмена
                </Button>
                <Button type="submit" variant="primary">
                  Сохранить запись в EHR
                </Button>
              </div>
            </form>
          </Modal>

          {/* Modal: Edit Vitals & Card Parameters */}
          <Modal
            isOpen={isVitalsModalOpen}
            onClose={() => setIsVitalsModalOpen(false)}
            title="Редактирование параметров медкарты пациента"
            size="md"
          >
            <form onSubmit={handleSaveVitals}>
              <Field label="Основной диагноз / Профиль заболевания" required>
                <input
                  value={vitalsForm.mainDiagnosis}
                  required
                  placeholder="ИБС, Остеохондроз и т.д."
                  onChange={(e) => setVitalsForm({ ...vitalsForm, mainDiagnosis: e.target.value })}
                />
              </Field>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
                <Field label="Рост, см" required>
                  <input
                    type="number"
                    min={100}
                    max={250}
                    value={vitalsForm.heightCm}
                    required
                    onChange={(e) =>
                      setVitalsForm({ ...vitalsForm, heightCm: Number(e.target.value) })
                    }
                  />
                </Field>
                <Field label="Вес, кг" required>
                  <input
                    type="number"
                    min={30}
                    max={300}
                    value={vitalsForm.weightKg}
                    required
                    onChange={(e) =>
                      setVitalsForm({ ...vitalsForm, weightKg: Number(e.target.value) })
                    }
                  />
                </Field>
                <Field label="Группа крови">
                  <select
                    value={vitalsForm.bloodType}
                    onChange={(e) => setVitalsForm({ ...vitalsForm, bloodType: e.target.value })}
                  >
                    <option value="O (I) Rh+">O (I) Rh+</option>
                    <option value="O (I) Rh-">O (I) Rh-</option>
                    <option value="A (II) Rh+">A (II) Rh+</option>
                    <option value="A (II) Rh-">A (II) Rh-</option>
                    <option value="B (III) Rh+">B (III) Rh+</option>
                    <option value="B (III) Rh-">B (III) Rh-</option>
                    <option value="AB (IV) Rh+">AB (IV) Rh+</option>
                    <option value="AB (IV) Rh-">AB (IV) Rh-</option>
                  </select>
                </Field>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
                <Field label="АД верхнее (сист.)" required>
                  <input
                    type="number"
                    min={70}
                    max={240}
                    value={vitalsForm.systolicBp}
                    required
                    onChange={(e) =>
                      setVitalsForm({ ...vitalsForm, systolicBp: Number(e.target.value) })
                    }
                  />
                </Field>
                <Field label="АД нижнее (диаст.)" required>
                  <input
                    type="number"
                    min={40}
                    max={140}
                    value={vitalsForm.diastolicBp}
                    required
                    onChange={(e) =>
                      setVitalsForm({ ...vitalsForm, diastolicBp: Number(e.target.value) })
                    }
                  />
                </Field>
                <Field label="Пульс (ЧСС)" required>
                  <input
                    type="number"
                    min={40}
                    max={200}
                    value={vitalsForm.pulseBpm}
                    required
                    onChange={(e) =>
                      setVitalsForm({ ...vitalsForm, pulseBpm: Number(e.target.value) })
                    }
                  />
                </Field>
              </div>

              <Field label="Аллергии (через запятую)">
                <input
                  placeholder="Пенициллин, Цитрусовые, Мед..."
                  value={vitalsForm.allergies}
                  onChange={(e) => setVitalsForm({ ...vitalsForm, allergies: e.target.value })}
                />
              </Field>

              <Field label="Противопоказания к процедурам (через запятую)">
                <input
                  placeholder="Высокая температура, онкология, кардиостимулятор..."
                  value={vitalsForm.contraindications}
                  onChange={(e) =>
                    setVitalsForm({ ...vitalsForm, contraindications: e.target.value })
                  }
                />
              </Field>

              <div
                style={{
                  display: 'flex',
                  justifyContent: 'flex-end',
                  gap: 10,
                  marginTop: 20,
                  paddingTop: 16,
                  borderTop: '1px solid var(--line)',
                }}
              >
                <Button type="button" variant="secondary" onClick={() => setIsVitalsModalOpen(false)}>
                  Отмена
                </Button>
                <Button type="submit" variant="primary">
                  Сохранить параметры
                </Button>
              </div>
            </form>
          </Modal>
        </>
      )}
    </section>
  );
}
