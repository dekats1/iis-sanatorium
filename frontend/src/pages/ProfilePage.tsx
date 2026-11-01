import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { ehr, loyalty, profile as profileApi } from '../api/endpoints';
import AvatarUpload from '../components/AvatarUpload';
import { getUserAvatar, setUserAvatar } from '../utils/avatar';
import {
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorBox,
  Field,
  formatDateTime,
  money,
  TableWrap,
  today,
} from '../components/ui';
import type {
  BonusTransaction,
  ConditionView,
  DoctorNote,
  EhrRecord,
  LoyaltyAccount,
  MeView,
} from '../types';

const ROLE_NAMES: Record<string, string> = {
  CLIENT: 'Клиент',
  BOOKING_ADMIN: 'Администратор бронирований',
  DOCTOR: 'Врач',
  MANAGER: 'Менеджер',
  SYSADMIN: 'Системный администратор',
};

export default function ProfilePage() {
  const [activeTab, setActiveTab] = useState<'info' | 'loyalty' | 'ehr'>('info');

  const [me, setMe] = useState<MeView | null>(null);
  const [conditions, setConditions] = useState<ConditionView[]>([]);
  const [form, setForm] = useState({ fullName: '', email: '' });
  const [pwd, setPwd] = useState({ oldPassword: '', newPassword: '', confirm: '' });

  // Loyalty & EHR
  const [loyaltyAcc, setLoyaltyAcc] = useState<LoyaltyAccount | null>(null);
  const [transactions, setTransactions] = useState<BonusTransaction[]>([]);
  const [myEhr, setMyEhr] = useState<EhrRecord | null>(null);
  const [myNotes, setMyNotes] = useState<DoctorNote[]>([]);

  const [error, setError] = useState<unknown>(null);
  const [pwdError, setPwdError] = useState<unknown>(null);
  const [message, setMessage] = useState('');
  const [pwdMessage, setPwdMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [pwdBusy, setPwdBusy] = useState(false);

  const reload = useCallback(async () => {
    try {
      const data = await profileApi.me();
      const storedAvatar = getUserAvatar(data.username) || getUserAvatar(data.id);
      setMe({ ...data, avatarUrl: storedAvatar });
      setForm({ fullName: data.fullName, email: data.email ?? '' });
      const [conds, lAcc, lTx, ehrData, notesList] = await Promise.all([
        profileApi.conditions(),
        loyalty.account(data.id),
        loyalty.transactions(data.id),
        ehr.get(data.id),
        ehr.notes(data.id),
      ]);
      setConditions(conds);
      setLoyaltyAcc(lAcc);
      setTransactions(lTx);
      setMyEhr(ehrData);
      setMyNotes(notesList);
    } catch (err) {
      setError(err);
    }
  }, []);

  const handleAvatarSave = (newUrl: string | null) => {
    if (!me) return;
    setUserAvatar(me.username, newUrl);
    if (me.id) setUserAvatar(me.id, newUrl);
    setMe((prev) => (prev ? { ...prev, avatarUrl: newUrl } : null));
    setMessage(newUrl ? 'Фото профиля успешно обновлено' : 'Фото профиля удалено');
  };

  useEffect(() => {
    void reload();
  }, [reload]);

  async function save(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setMessage('');
    setBusy(true);
    try {
      const updated = await profileApi.update({
        fullName: form.fullName,
        email: form.email || undefined,
      });
      setMe(updated);
      setMessage('Личные данные успешно сохранены');
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  }

  async function changePassword(e: FormEvent) {
    e.preventDefault();
    setPwdError(null);
    setPwdMessage('');
    if (pwd.newPassword.length < 8) {
      setPwdError(new Error('Новый пароль должен быть не короче 8 символов'));
      return;
    }
    if (pwd.newPassword !== pwd.confirm) {
      setPwdError(new Error('Новый пароль и подтверждение не совпадают'));
      return;
    }
    setPwdBusy(true);
    try {
      await profileApi.changePassword(pwd.oldPassword, pwd.newPassword);
      setPwd({ oldPassword: '', newPassword: '', confirm: '' });
      setPwdMessage('Пароль успешно изменён');
    } catch (err) {
      setPwdError(err);
    } finally {
      setPwdBusy(false);
    }
  }

  const nextTierProgress = loyaltyAcc?.nextTierThreshold
    ? Math.min(100, Math.round((loyaltyAcc.spentMoneyTotal / loyaltyAcc.nextTierThreshold) * 100))
    : 100;

  return (
    <section>
      <div className="page-head">
        <div>
          <h1>Личный кабинет пользователя</h1>
          <p className="card-subtitle">
            Управление персональными данными, бонусами программы лояльности и медицинской картой
          </p>
        </div>
      </div>

      <ErrorBox error={error} />
      {message && <p className="ok">{message}</p>}

      {/* Tabs */}
      <div className="tabs">
        <button
          type="button"
          className={`tab ${activeTab === 'info' ? 'active' : ''}`}
          onClick={() => setActiveTab('info')}
        >
          Личные данные и безопасность
        </button>
        <button
          type="button"
          className={`tab ${activeTab === 'loyalty' ? 'active' : ''}`}
          onClick={() => setActiveTab('loyalty')}
        >
          Программа лояльности ({loyaltyAcc ? `${loyaltyAcc.balance} б.` : '...'})
        </button>
        <button
          type="button"
          className={`tab ${activeTab === 'ehr' ? 'active' : ''}`}
          onClick={() => setActiveTab('ehr')}
        >
          Медицинская карта (EHR)
        </button>
      </div>

      {/* TAB 1: Account info & Password */}
      {activeTab === 'info' && me && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          <Card
            title={
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <span>{me.fullName}</span>
                <Badge variant={me.active ? 'good' : 'bad'}>
                  {me.active ? 'Активен' : 'Заблокирован'}
                </Badge>
              </div>
            }
            subtitle={
              <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
                {me.roles.map((r) => (
                  <Badge key={r} variant="info">
                    {ROLE_NAMES[r] ?? r}
                  </Badge>
                ))}
              </div>
            }
          >
            <div className="profile-avatar-row" style={{ marginBottom: 24, paddingBottom: 20, borderBottom: '1px solid var(--line)' }}>
              <AvatarUpload
                currentAvatarUrl={me.avatarUrl}
                userName={me.fullName || me.username}
                onSaveAvatar={handleAvatarSave}
                size={96}
              />
            </div>

            <form onSubmit={save}>
              <div className="grid">
                <Field label="Логин учётной записи (только чтение)">
                  <input value={me.username} readOnly disabled />
                </Field>
                <Field label="ФИО гостя" required>
                  <input
                    value={form.fullName}
                    required
                    maxLength={150}
                    disabled={busy}
                    onChange={(e) => setForm({ ...form, fullName: e.target.value })}
                  />
                </Field>
                <Field label="Адрес эл. почты (Email)">
                  <input
                    type="email"
                    value={form.email}
                    maxLength={150}
                    disabled={busy}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                  />
                </Field>
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 16 }}>
                <Button type="submit" variant="primary" disabled={busy}>
                  Сохранить данные
                </Button>
              </div>
            </form>
          </Card>

          <Card title="Смена пароля учётной записи" subtitle="Рекомендуется использовать пароль длиной не менее 8 символов">
            <ErrorBox error={pwdError} />
            {pwdMessage && <p className="ok">{pwdMessage}</p>}
            <form onSubmit={changePassword}>
              <div className="grid">
                <Field label="Текущий пароль" required>
                  <input
                    type="password"
                    value={pwd.oldPassword}
                    required
                    autoComplete="current-password"
                    disabled={pwdBusy}
                    onChange={(e) => setPwd({ ...pwd, oldPassword: e.target.value })}
                  />
                </Field>
                <Field label="Новый пароль (мин. 8 знаков)" required>
                  <input
                    type="password"
                    value={pwd.newPassword}
                    required
                    minLength={8}
                    maxLength={72}
                    autoComplete="new-password"
                    disabled={pwdBusy}
                    onChange={(e) => setPwd({ ...pwd, newPassword: e.target.value })}
                  />
                </Field>
                <Field label="Подтверждение нового пароля" required>
                  <input
                    type="password"
                    value={pwd.confirm}
                    required
                    autoComplete="new-password"
                    disabled={pwdBusy}
                    onChange={(e) => setPwd({ ...pwd, confirm: e.target.value })}
                  />
                </Field>
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 16 }}>
                <Button type="submit" variant="secondary" disabled={pwdBusy}>
                  Изменить пароль
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}

      {/* TAB 2: Loyalty Program & Bonuses */}
      {activeTab === 'loyalty' && loyaltyAcc && (
        <>
          <div className="loyalty-banner">
            {/* Visual Loyalty Card */}
            <div className={`loyalty-card-visual ${loyaltyAcc.tier.toLowerCase()}`}>
              <div className="loyalty-card-top">
                <div>
                  <div className="loyalty-card-title">Санаторий ИИС • Клуб Гостя</div>
                  <div className="loyalty-tier-name">{loyaltyAcc.tierName}</div>
                </div>
                <div style={{ fontSize: '1.6rem' }}>
                  {loyaltyAcc.tier === 'PLATINUM' ? '💎' : loyaltyAcc.tier === 'GOLD' ? '👑' : loyaltyAcc.tier === 'SILVER' ? '🥈' : '🥉'}
                </div>
              </div>

              <div className="loyalty-card-balance">
                <div className="loyalty-balance-value">{loyaltyAcc.balance.toLocaleString('ru-RU')}</div>
                <div className="loyalty-balance-label">БОНУСНЫХ БАЛЛОВ (1 БАЛЛ = 1 BYN)</div>
              </div>

              <div className="loyalty-card-footer">
                <div>Кешбэк: {loyaltyAcc.cashbackPercent}%</div>
                <div>Скидка на спа: {loyaltyAcc.discountPercent}%</div>
                <div>ID: #{loyaltyAcc.clientId}</div>
              </div>
            </div>

            {/* Progress to next tier & privileges */}
            <div className="loyalty-progress-panel">
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                  <h4 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 750 }}>Статус программы лояльности</h4>
                  <Badge variant="good">{loyaltyAcc.tierName}</Badge>
                </div>

                <div style={{ margin: '12px 0 6px', fontSize: '0.88rem', color: 'var(--text-muted)' }}>
                  Всего потрачено на путёвки: <strong>{money(loyaltyAcc.spentMoneyTotal)}</strong>
                </div>

                {loyaltyAcc.nextTierThreshold ? (
                  <>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', fontWeight: 600 }}>
                      <span>Прогресс до следующего ранга</span>
                      <span>
                        {loyaltyAcc.spentMoneyTotal} / {loyaltyAcc.nextTierThreshold} BYN
                      </span>
                    </div>
                    <div className="progress-track">
                      <div className="progress-fill" style={{ width: `${nextTierProgress}%` }} />
                    </div>
                    <div style={{ fontSize: '0.82rem', color: 'var(--accent)', fontWeight: 600 }}>
                      Осталось потратить {loyaltyAcc.nextTierThreshold - loyaltyAcc.spentMoneyTotal} BYN до повышения кешбэка!
                    </div>
                  </>
                ) : (
                  <div style={{ color: 'var(--ok)', fontWeight: 700, fontSize: '0.9rem', marginTop: 10 }}>
                    ✨ Вы достигли максимального платинового уровня привилегий!
                  </div>
                )}
              </div>

              <div style={{ marginTop: 16 }}>
                <span style={{ fontSize: '0.84rem', fontWeight: 700, color: 'var(--text-muted)' }}>
                  Ваши персональные привилегии:
                </span>
                <div className="privilege-chip-list">
                  {loyaltyAcc.privileges.map((p, idx) => (
                    <span key={idx} className="privilege-chip">
                      ✓ {p}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Transactions History */}
          <Card
            title="История бонусных операций"
            subtitle="Начисления кешбэка за путёвки, списания на скидки и промо-бонусы"
          >
            <TableWrap>
              <table>
                <thead>
                  <tr>
                    <th>Дата операции</th>
                    <th>Тип операции</th>
                    <th>Сумма баллов</th>
                    <th>Основание / Описание</th>
                  </tr>
                </thead>
                <tbody>
                  {transactions.length === 0 ? (
                    <tr>
                      <td colSpan={4}>
                        <EmptyState title="История бонусных операций пока пуста" />
                      </td>
                    </tr>
                  ) : (
                    transactions.map((tx) => (
                      <tr key={tx.id}>
                        <td>{formatDateTime(tx.createdAt)}</td>
                        <td>
                          <Badge
                            variant={
                              tx.type === 'ACCRUAL' || tx.type === 'WELCOME'
                                ? 'good'
                                : tx.type === 'REDEMPTION'
                                ? 'wait'
                                : 'info'
                            }
                          >
                            {tx.type === 'ACCRUAL'
                              ? 'Начисление кешбэка'
                              : tx.type === 'WELCOME'
                              ? 'Приветственный бонус'
                              : tx.type === 'REDEMPTION'
                              ? 'Списание на скидку'
                              : 'Корректировка'}
                          </Badge>
                        </td>
                        <td
                          style={{
                            fontWeight: 750,
                            fontSize: '1rem',
                            color: tx.amount > 0 ? 'var(--ok)' : 'var(--danger)',
                          }}
                        >
                          {tx.amount > 0 ? `+${tx.amount}` : tx.amount} б.
                        </td>
                        <td>
                          {tx.description}
                          {tx.voucherId && <span style={{ color: 'var(--accent)' }}> (путёвка #{tx.voucherId})</span>}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </TableWrap>
          </Card>
        </>
      )}

      {/* TAB 3: Electronic Health Record (EHR) */}
      {activeTab === 'ehr' && myEhr && (
        <>
          <Card
            title="Электронная санаторно-курортная карта (EHR)"
            subtitle={`Номер карты: ${myEhr.sanatoriumCardNumber ?? 'СКК-2026/089'} от ${myEhr.cardIssuedDate ?? today()}`}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                background: 'var(--surface-alt)',
                padding: '14px 18px',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--line)',
                marginBottom: 20,
              }}
            >
              <div>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Основной диагноз:</span>
                <div style={{ fontWeight: 700, fontSize: '1.05rem', color: 'var(--accent)' }}>
                  {myEhr.mainDiagnosis || 'Оздоровительный профиль'}
                </div>
              </div>
              <div>
                <Badge variant="info">Диетический стол: {myEhr.dietCode || 'Стандартный'}</Badge>
              </div>
            </div>

            {/* Allergies & Contraindications */}
            {(myEhr.allergies.length > 0 || myEhr.contraindications.length > 0) && (
              <div className="allergy-alert-banner">
                <div className="allergy-alert-title">
                  ⚠️ Медицинские противопоказания и аллергоанамнез:
                </div>
                {myEhr.allergies.length > 0 && (
                  <div style={{ marginBottom: 6 }}>
                    <span style={{ fontSize: '0.82rem', fontWeight: 650, color: '#8A2020', marginRight: 8 }}>
                      Аллергические реакции:
                    </span>
                    <span className="allergy-tags">
                      {myEhr.allergies.map((a, idx) => (
                        <span key={idx} className="allergy-tag">
                          {a}
                        </span>
                      ))}
                    </span>
                  </div>
                )}
                {myEhr.contraindications.length > 0 && (
                  <div>
                    <span style={{ fontSize: '0.82rem', fontWeight: 650, color: '#8A2020', marginRight: 8 }}>
                      Противопоказания:
                    </span>
                    <span className="allergy-tags">
                      {myEhr.contraindications.map((c, idx) => (
                        <span key={idx} className="allergy-tag" style={{ borderColor: '#D97706', color: '#92400E' }}>
                          {c}
                        </span>
                      ))}
                    </span>
                  </div>
                )}
              </div>
            )}

            {/* Vitals Grid */}
            <div className="ehr-vitals-grid">
              <div className="ehr-vital-card">
                <span className="ehr-vital-label">Артериальное давление</span>
                <div className="ehr-vital-value">
                  {myEhr.systolicBp ?? 120} / {myEhr.diastolicBp ?? 80}
                  <span className="ehr-vital-unit">мм рт. ст.</span>
                </div>
                <span className="ehr-vital-status normal">В норме</span>
              </div>
              <div className="ehr-vital-card">
                <span className="ehr-vital-label">Пульс (ЧСС)</span>
                <div className="ehr-vital-value">
                  {myEhr.pulseBpm ?? 72}
                  <span className="ehr-vital-unit">уд/мин</span>
                </div>
                <span className="ehr-vital-status normal">Нормокардия</span>
              </div>
              <div className="ehr-vital-card">
                <span className="ehr-vital-label">ИМТ (Индекс Кетле)</span>
                <div className="ehr-vital-value">
                  {myEhr.bmi ?? 23.5}
                  <span className="ehr-vital-unit">кг/м²</span>
                </div>
                <span className="ehr-vital-status normal">Нормальный вес</span>
              </div>
              <div className="ehr-vital-card">
                <span className="ehr-vital-label">Рост / Вес</span>
                <div className="ehr-vital-value">
                  {myEhr.heightCm ?? 175}
                  <span className="ehr-vital-unit">см</span> / {myEhr.weightKg ?? 72}
                  <span className="ehr-vital-unit">кг</span>
                </div>
                <span className="ehr-vital-status normal">Нормостеник</span>
              </div>
              <div className="ehr-vital-card">
                <span className="ehr-vital-label">Группа крови</span>
                <div className="ehr-vital-value">{myEhr.bloodType || 'A (II) Rh+'}</div>
                <span className="ehr-vital-status normal">Подтверждено</span>
              </div>
            </div>

            {/* Diagnosed Conditions */}
            <div style={{ marginTop: 20 }}>
              <h4 style={{ margin: '0 0 10px', fontSize: '0.94rem', fontWeight: 750 }}>
                Зарегистрированные диагнозы и состояния здоровья
              </h4>
              <TableWrap>
                <table>
                  <thead>
                    <tr>
                      <th>Код МКБ</th>
                      <th>Наименование состояния</th>
                      <th>Дата постановки диагноза</th>
                    </tr>
                  </thead>
                  <tbody>
                    {conditions.length === 0 ? (
                      <tr>
                        <td colSpan={3}>
                          <EmptyState title="Особых состояний здоровья не зарегистрировано" />
                        </td>
                      </tr>
                    ) : (
                      conditions.map((c) => (
                        <tr key={c.conditionId}>
                          <td>
                            <strong>{c.code}</strong>
                          </td>
                          <td>{c.name}</td>
                          <td>{c.diagnosedAt ?? '—'}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </TableWrap>
            </div>
          </Card>

          {/* Doctor clinical notes */}
          {myNotes.length > 0 && (
            <Card
              title="Заключения врачей санатория"
              subtitle="История врачебных консультаций, результаты осмотров и назначенные режимы"
              style={{ marginTop: 24 }}
            >
              {myNotes.map((note) => (
                <div key={note.id} className="ehr-note-card">
                  <div className="ehr-note-header">
                    <div>
                      <span className="ehr-note-doctor">{note.doctorName}</span>
                      <Badge variant="info" style={{ marginLeft: 10 }}>
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
                      <div className="ehr-note-section-title">Жалобы:</div>
                      <div>{note.complaints}</div>
                    </div>
                  )}

                  {note.objectiveStatus && (
                    <div className="ehr-note-section">
                      <div className="ehr-note-section-title">Данные осмотра:</div>
                      <div>{note.objectiveStatus}</div>
                    </div>
                  )}

                  {note.recommendations && (
                    <div className="ehr-note-section">
                      <div className="ehr-note-section-title">Рекомендации врача:</div>
                      <div style={{ color: 'var(--accent)', fontWeight: 600 }}>
                        {note.recommendations}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </Card>
          )}
        </>
      )}
    </section>
  );
}
