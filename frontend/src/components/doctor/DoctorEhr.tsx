import { useEffect, useId, useState, type ChangeEvent, type FormEvent } from 'react';
import { clients, ehr } from '../../api/endpoints';
import { useAuth } from '../../hooks/useAuth';
import { decodeJwt } from '../../utils/jwt';
import { Button, Card, EmptyState, ErrorBox, Field, Modal, Skeleton, SkeletonRows, useToast } from '../ui';
import { Icon } from '../icons';
import { DoctorNoteCard, EhrSummary } from './EhrSummary';
import type { ClientView, DoctorNote, EhrRecord, VisitType } from '../../types';

const EMPTY_NOTE = {
  visitType: 'INITIAL' as VisitType,
  doctorName: 'Др. Смирнова Е. В.',
  complaints: '',
  objectiveStatus: '',
  recommendations: '',
};

const BLOOD_TYPES = ['O (I) Rh+', 'O (I) Rh-', 'A (II) Rh+', 'A (II) Rh-', 'B (III) Rh+', 'B (III) Rh-', 'AB (IV) Rh+', 'AB (IV) Rh-'];

const splitList = (s: string) =>
  s
    .split(',')
    .map((x) => x.trim())
    .filter(Boolean);

/** Электронная медкарта пациента на рабочем месте врача: показатели, дневник осмотров, правка карты. */
export function DoctorEhr() {
  const toast = useToast();
  const { session } = useAuth();
  const noteFormId = useId();
  const vitalsFormId = useId();

  const [allClients, setAllClients] = useState<ClientView[]>([]);
  const [clientsLoading, setClientsLoading] = useState(true);
  const [selectedClientId, setSelectedClientId] = useState<number>(1);
  const [patientEhr, setPatientEhr] = useState<EhrRecord | null>(null);
  const [doctorNotes, setDoctorNotes] = useState<DoctorNote[]>([]);
  const [ehrLoading, setEhrLoading] = useState(true);
  const [error, setError] = useState<unknown>(null);
  const [modalError, setModalError] = useState<unknown>(null);
  const [saving, setSaving] = useState(false);
  const [isNoteModalOpen, setIsNoteModalOpen] = useState(false);
  const [isVitalsModalOpen, setIsVitalsModalOpen] = useState(false);
  const [newNote, setNewNote] = useState(EMPTY_NOTE);
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
    clients
      .search('')
      .then((cls) => {
        setAllClients(cls);
        if (cls[0]) setSelectedClientId(cls[0].id);
      })
      .catch(() => undefined)
      .finally(() => setClientsLoading(false));
  }, []);

  useEffect(() => {
    if (!selectedClientId) return;
    let alive = true;
    setEhrLoading(true);
    void (async () => {
      try {
        const [rec, notesList] = await Promise.all([ehr.get(selectedClientId), ehr.notes(selectedClientId)]);
        if (!alive) return;
        setError(null);
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
        if (alive) setError(err);
      } finally {
        if (alive) setEhrLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [selectedClientId]);

  function openNote() {
    setModalError(null);
    setIsNoteModalOpen(true);
  }

  function openVitals() {
    setModalError(null);
    setIsVitalsModalOpen(true);
  }

  async function handleSaveVitals(e: FormEvent) {
    e.preventDefault();
    if (!patientEhr) return;
    setModalError(null);
    setSaving(true);
    try {
      const updated = await ehr.update(selectedClientId, {
        heightCm: Number(vitalsForm.heightCm),
        weightKg: Number(vitalsForm.weightKg),
        systolicBp: Number(vitalsForm.systolicBp),
        diastolicBp: Number(vitalsForm.diastolicBp),
        pulseBpm: Number(vitalsForm.pulseBpm),
        bloodType: vitalsForm.bloodType,
        mainDiagnosis: vitalsForm.mainDiagnosis,
        allergies: splitList(vitalsForm.allergies),
        contraindications: splitList(vitalsForm.contraindications),
      });
      setPatientEhr(updated);
      setIsVitalsModalOpen(false);
      toast.success('Медицинские показатели гостя обновлены в карте.');
    } catch (err) {
      setModalError(err);
    } finally {
      setSaving(false);
    }
  }

  async function handleAddNote(e: FormEvent) {
    e.preventDefault();
    setModalError(null);
    setSaving(true);
    try {
      // Сервер определяет врача по токену; идентификатор из сессии передаётся только для совместимости типа API.
      const doctorId = Number(session ? decodeJwt(session.token)?.sub : 0) || 0;
      await ehr.addNote({
        clientId: selectedClientId,
        doctorId,
        doctorName: newNote.doctorName,
        visitType: newNote.visitType,
        complaints: newNote.complaints,
        objectiveStatus: newNote.objectiveStatus,
        recommendations: newNote.recommendations,
      });
      setDoctorNotes(await ehr.notes(selectedClientId));
      setIsNoteModalOpen(false);
      setNewNote(EMPTY_NOTE);
      toast.success('Запись осмотра добавлена в электронную медкарту.');
    } catch (err) {
      setModalError(err);
    } finally {
      setSaving(false);
    }
  }

  const selectedClient = allClients.find((c) => c.id === selectedClientId);
  const num = (key: 'heightCm' | 'weightKg' | 'systolicBp' | 'diastolicBp' | 'pulseBpm') => ({
    type: 'number' as const,
    required: true,
    value: vitalsForm[key],
    onChange: (e: ChangeEvent<HTMLInputElement>) => setVitalsForm({ ...vitalsForm, [key]: Number(e.target.value) }),
  });

  return (
    <div className="u-stack-16">
      <Card
        title="Медкарта пациента"
        subtitle="Показатели, аллергоанамнез и противопоказания"
        actions={
          <>
            <Button variant="primary" icon={<Icon name="plus" size={18} />} onClick={openNote}>
              Запись осмотра
            </Button>
            <Button variant="outline" icon={<Icon name="edit" size={18} />} onClick={openVitals} disabled={!patientEhr}>
              Редактировать медкарту
            </Button>
          </>
        }
      >
        <Field label="Пациент (гость санатория)" className="dc-patient-select">
          {clientsLoading ? (
            <Skeleton height={44} />
          ) : (
            <select value={selectedClientId} onChange={(e) => setSelectedClientId(Number(e.target.value))}>
              {allClients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.lastName} {c.firstName} {c.middleName ?? ''} (род. {c.birthDate}, № {c.id})
                </option>
              ))}
            </select>
          )}
        </Field>
        <ErrorBox error={error} />
        {ehrLoading && !patientEhr ? <SkeletonRows rows={4} /> : patientEhr && <EhrSummary record={patientEhr} />}
      </Card>

      <Card title="Клинический дневник" subtitle="История приёмов, динамика состояния и выписные эпикризы">
        {ehrLoading && doctorNotes.length === 0 ? (
          <SkeletonRows rows={3} />
        ) : doctorNotes.length === 0 ? (
          <EmptyState
            icon={<Icon name="file" size={40} />}
            title="В медкарте пока нет записей осмотров"
            description="Зафиксируйте первичный приём или динамику лечения."
            action={
              <Button variant="primary" size="sm" icon={<Icon name="plus" size={16} />} onClick={openNote}>
                Добавить первую запись
              </Button>
            }
          />
        ) : (
          <div className="u-stack-12">
            {doctorNotes.map((note) => (
              <DoctorNoteCard key={note.id} note={note} />
            ))}
          </div>
        )}
      </Card>

      <Modal
        isOpen={isNoteModalOpen}
        onClose={() => setIsNoteModalOpen(false)}
        title={`Протокол осмотра${selectedClient ? `: ${selectedClient.lastName} ${selectedClient.firstName}` : ''}`}
        size="md"
        footer={
          <>
            <Button variant="secondary" onClick={() => setIsNoteModalOpen(false)}>
              Отмена
            </Button>
            <Button type="submit" form={noteFormId} variant="primary" loading={saving}>
              Сохранить запись
            </Button>
          </>
        }
      >
        <form id={noteFormId} onSubmit={handleAddNote}>
          <div className="form-grid">
            <Field label="Тип осмотра" required>
              <select value={newNote.visitType} onChange={(e) => setNewNote({ ...newNote, visitType: e.target.value as VisitType })}>
                <option value="INITIAL">Первичный приём врача</option>
                <option value="CONTROL">Промежуточный / контрольный осмотр</option>
                <option value="DISCHARGE">Заключительный осмотр (выписной эпикриз)</option>
              </select>
            </Field>
            <Field label="Лечащий врач" required>
              <input value={newNote.doctorName} required onChange={(e) => setNewNote({ ...newNote, doctorName: e.target.value })} />
            </Field>
          </div>
          <Field label="Жалобы пациента">
            <textarea
              rows={2}
              placeholder="Текущие жалобы гостя"
              value={newNote.complaints}
              onChange={(e) => setNewNote({ ...newNote, complaints: e.target.value })}
            />
          </Field>
          <Field label="Объективный статус при осмотре" required>
            <textarea
              rows={3}
              required
              placeholder="Кожные покровы, дыхание, ЧСС, тоны сердца, подвижность суставов"
              value={newNote.objectiveStatus}
              onChange={(e) => setNewNote({ ...newNote, objectiveStatus: e.target.value })}
            />
          </Field>
          <Field label="Назначения и рекомендации" required>
            <textarea
              rows={2}
              required
              placeholder="Двигательный режим, процедуры, диета"
              value={newNote.recommendations}
              onChange={(e) => setNewNote({ ...newNote, recommendations: e.target.value })}
            />
          </Field>
          <ErrorBox error={modalError} />
        </form>
      </Modal>

      <Modal
        isOpen={isVitalsModalOpen}
        onClose={() => setIsVitalsModalOpen(false)}
        title="Параметры медкарты пациента"
        size="md"
        footer={
          <>
            <Button variant="secondary" onClick={() => setIsVitalsModalOpen(false)}>
              Отмена
            </Button>
            <Button type="submit" form={vitalsFormId} variant="primary" loading={saving}>
              Сохранить параметры
            </Button>
          </>
        }
      >
        <form id={vitalsFormId} onSubmit={handleSaveVitals}>
          <Field label="Основной диагноз / профиль заболевания" required>
            <input
              value={vitalsForm.mainDiagnosis}
              required
              placeholder="ИБС, остеохондроз и т. д."
              onChange={(e) => setVitalsForm({ ...vitalsForm, mainDiagnosis: e.target.value })}
            />
          </Field>
          <div className="form-grid">
            <Field label="Рост, см" required>
              <input min={100} max={250} {...num('heightCm')} />
            </Field>
            <Field label="Вес, кг" required>
              <input min={30} max={300} {...num('weightKg')} />
            </Field>
            <Field label="Группа крови">
              <select value={vitalsForm.bloodType} onChange={(e) => setVitalsForm({ ...vitalsForm, bloodType: e.target.value })}>
                {BLOOD_TYPES.map((b) => (
                  <option key={b} value={b}>
                    {b}
                  </option>
                ))}
              </select>
            </Field>
          </div>
          <div className="form-grid">
            <Field label="АД верхнее (сист.)" required>
              <input min={70} max={240} {...num('systolicBp')} />
            </Field>
            <Field label="АД нижнее (диаст.)" required>
              <input min={40} max={140} {...num('diastolicBp')} />
            </Field>
            <Field label="Пульс (ЧСС)" required>
              <input min={40} max={200} {...num('pulseBpm')} />
            </Field>
          </div>
          <Field label="Аллергии" hint="Через запятую">
            <input
              placeholder="Пенициллин, цитрусовые, мёд"
              value={vitalsForm.allergies}
              onChange={(e) => setVitalsForm({ ...vitalsForm, allergies: e.target.value })}
            />
          </Field>
          <Field label="Противопоказания к процедурам" hint="Через запятую">
            <input
              placeholder="Высокая температура, кардиостимулятор"
              value={vitalsForm.contraindications}
              onChange={(e) => setVitalsForm({ ...vitalsForm, contraindications: e.target.value })}
            />
          </Field>
          <ErrorBox error={modalError} />
        </form>
      </Modal>
    </div>
  );
}
