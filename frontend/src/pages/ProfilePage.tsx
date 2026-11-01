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
  Skeleton,
  SkeletonRows,
  Tabs,
  useToast,
} from '../components/ui';
import LoyaltySection from '../components/profile/LoyaltySection';
import EhrSection from '../components/profile/EhrSection';
import type {
  BonusTransaction,
  ConditionView,
  DoctorNote,
  EhrRecord,
  LoyaltyAccount,
  MeView,
} from '../types';
import { Icon } from '../components/icons';

const ROLE_NAMES: Record<string, string> = {
  CLIENT: 'Клиент',
  BOOKING_ADMIN: 'Администратор бронирований',
  DOCTOR: 'Врач',
  MANAGER: 'Менеджер',
  SYSADMIN: 'Системный администратор',
};

type TabId = 'info' | 'loyalty' | 'ehr';

export default function ProfilePage() {
  const toast = useToast();
  const [activeTab, setActiveTab] = useState<TabId>('info');

  const [me, setMe] = useState<MeView | null>(null);
  const [conditions, setConditions] = useState<ConditionView[]>([]);
  const [form, setForm] = useState({ fullName: '', email: '' });
  const [pwd, setPwd] = useState({ oldPassword: '', newPassword: '', confirm: '' });

  // Loyalty & EHR
  const [loyaltyAcc, setLoyaltyAcc] = useState<LoyaltyAccount | null>(null);
  const [transactions, setTransactions] = useState<BonusTransaction[]>([]);
  const [myEhr, setMyEhr] = useState<EhrRecord | null>(null);
  const [myNotes, setMyNotes] = useState<DoctorNote[]>([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<unknown>(null);
  const [pwdError, setPwdError] = useState<unknown>(null);
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
    } finally {
      setLoading(false);
    }
  }, []);

  const handleAvatarSave = (newUrl: string | null) => {
    if (!me) return;
    setUserAvatar(me.username, newUrl);
    if (me.id) setUserAvatar(me.id, newUrl);
    setMe((prev) => (prev ? { ...prev, avatarUrl: newUrl } : null));
    toast.success(newUrl ? 'Фото профиля успешно обновлено' : 'Фото профиля удалено');
  };

  useEffect(() => {
    void reload();
  }, [reload]);

  async function save(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const updated = await profileApi.update({
        fullName: form.fullName,
        email: form.email || undefined,
      });
      setMe((prev) => ({ ...updated, avatarUrl: updated.avatarUrl ?? prev?.avatarUrl ?? null }));
      toast.success('Личные данные успешно сохранены');
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  }

  async function changePassword(e: FormEvent) {
    e.preventDefault();
    setPwdError(null);
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
      toast.success('Пароль успешно изменён');
    } catch (err) {
      setPwdError(err);
    } finally {
      setPwdBusy(false);
    }
  }

  const confirmMismatch = pwd.confirm !== '' && pwd.confirm !== pwd.newPassword;

  return (
    <section>
      <div className="page-head">
        <div>
          <h1>Личный кабинет пользователя</h1>
          <p className="page-subtitle">
            Управление персональными данными, бонусами программы лояльности и медицинской картой
          </p>
        </div>
      </div>

      <ErrorBox error={error} />

      {/* Шапка профиля */}
      {loading && !me ? (
        <div className="card profile-hero" aria-busy="true">
          <Skeleton width={96} height={96} className="profile-hero-skel" />
          <div className="u-stack-12 profile-hero-body">
            <Skeleton width="60%" height={24} />
            <Skeleton width="40%" />
            <Skeleton width="80%" />
          </div>
        </div>
      ) : me ? (
        <div className="card profile-hero">
          <div className="profile-hero-avatar">
            <AvatarUpload
              currentAvatarUrl={me.avatarUrl}
              userName={me.fullName || me.username}
              onSaveAvatar={handleAvatarSave}
              size={96}
            />
          </div>
          <div className="profile-hero-body">
            <div className="u-flex-wrap profile-hero-name">
              <h2 className="u-m0">{me.fullName}</h2>
              <Badge variant={me.active ? 'good' : 'bad'} icon={me.active ? 'checkCircle' : 'lock'}>
                {me.active ? 'Активен' : 'Заблокирован'}
              </Badge>
            </div>
            <ul className="meta-list profile-hero-meta">
              <li><Icon name="user" size={16} /> {me.username}</li>
              {me.email && <li><Icon name="mail" size={16} /> {me.email}</li>}
            </ul>
            <div className="u-flex-wrap">
              {me.roles.map((r) => (
                <Badge key={r} variant="info" icon="shield">
                  {ROLE_NAMES[r] ?? r}
                </Badge>
              ))}
            </div>
          </div>
          {loyaltyAcc && (
            <button type="button" className="profile-hero-stat" onClick={() => setActiveTab('loyalty')}>
              <span className="u-muted-sm">Бонусный баланс</span>
              <span className="price-big">{loyaltyAcc.balance.toLocaleString('ru-RU')} б.</span>
              <span className="u-muted-sm">{loyaltyAcc.tierName}</span>
            </button>
          )}
        </div>
      ) : null}

      <Tabs<TabId>
        label="Разделы личного кабинета"
        value={activeTab}
        onChange={setActiveTab}
        tabs={[
          { id: 'info', label: 'Личные данные и безопасность', icon: 'user' },
          { id: 'loyalty', label: `Программа лояльности (${loyaltyAcc ? `${loyaltyAcc.balance} б.` : '...'})`, icon: 'star' },
          { id: 'ehr', label: 'Медицинская карта (EHR)', icon: 'stethoscope' },
        ]}
      />

      {loading && <SkeletonRows rows={6} />}

      {/* TAB 1: Account info & Password */}
      {activeTab === 'info' && me && (
        <div className="profile-cards">
          <Card title="Личные данные" subtitle="Эти данные видят администраторы и врачи санатория">
            <form onSubmit={save}>
              <div className="form-grid">
                <Field label="Логин учётной записи (только чтение)" hint="Логин изменить нельзя">
                  <input value={me.username} readOnly disabled />
                </Field>
                <Field label="ФИО гостя" required>
                  <input
                    value={form.fullName}
                    required
                    maxLength={150}
                    disabled={busy}
                    autoComplete="name"
                    onChange={(e) => setForm({ ...form, fullName: e.target.value })}
                  />
                </Field>
                <Field label="Адрес эл. почты (Email)" hint="Для уведомлений о путёвках и оплате">
                  <input
                    type="email"
                    value={form.email}
                    maxLength={150}
                    disabled={busy}
                    autoComplete="email"
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                  />
                </Field>
              </div>
              <div className="row row-end">
                <Button type="submit" variant="primary" loading={busy} icon={<Icon name="check" size={18} />}>
                  Сохранить данные
                </Button>
              </div>
            </form>
          </Card>

          <Card title="Смена пароля учётной записи" subtitle="Рекомендуется использовать пароль длиной не менее 8 символов">
            <ErrorBox error={pwdError} />
            <form onSubmit={changePassword}>
              <div className="form-grid">
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
                <Field label="Новый пароль (мин. 8 знаков)" hint="Буквы, цифры и символы — так надёжнее" required>
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
                <Field
                  label="Подтверждение нового пароля"
                  required
                  error={confirmMismatch ? 'Пароли не совпадают' : undefined}
                >
                  <input
                    type="password"
                    value={pwd.confirm}
                    required
                    autoComplete="new-password"
                    disabled={pwdBusy}
                    aria-invalid={confirmMismatch || undefined}
                    onChange={(e) => setPwd({ ...pwd, confirm: e.target.value })}
                  />
                </Field>
              </div>
              <div className="row row-end">
                <Button type="submit" variant="secondary" loading={pwdBusy} icon={<Icon name="key" size={18} />}>
                  Изменить пароль
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}

      {/* TAB 2: Loyalty Program & Bonuses */}
      {activeTab === 'loyalty' && !loading && (
        loyaltyAcc ? (
          <LoyaltySection account={loyaltyAcc} transactions={transactions} />
        ) : (
          <EmptyState title="Карта гостя ещё не выпущена" description="Бонусный счёт появится после первой оплаченной путёвки." icon={<Icon name="creditCard" size={40} />} />
        )
      )}

      {/* TAB 3: Electronic Health Record (EHR) */}
      {activeTab === 'ehr' && !loading && (
        myEhr ? (
          <EhrSection ehr={myEhr} conditions={conditions} notes={myNotes} />
        ) : (
          <EmptyState title="Медицинская карта пока не заведена" description="Карту оформит врач санатория при первичном осмотре." icon={<Icon name="clipboard" size={40} />} />
        )
      )}
    </section>
  );
}
