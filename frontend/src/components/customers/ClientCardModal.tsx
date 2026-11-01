import { useEffect, useId, useState, type FormEvent } from 'react';
import { clients, ehr, loyalty } from '../../api/endpoints';
import { DataTable, type Column } from '../DataTable';
import { Button, ErrorBox, Field, Modal, SkeletonRows, Tabs, useConfirm, useToast } from '../ui';
import { Icon } from '../icons';
import { EhrSummary } from '../doctor/EhrSummary';
import { LoyaltyPanel } from './LoyaltyPanel';
import { ClientFormFields, clientToForm, EMPTY_CLIENT, toRequest, type ClientFormState } from './ClientFormFields';
import type { BonusTransaction, ClientView, Coded, ConditionView, EhrRecord, LoyaltyAccount } from '../../types';

type ClientTab = 'profile' | 'ehr' | 'loyalty';

/** Карточка гостя: профиль, медкарта с диагнозами и программа лояльности. */
export function ClientCardModal({
  client,
  allConditions,
  onClose,
  onSaved,
}: {
  client: ClientView | null;
  allConditions: Coded[];
  onClose: () => void;
  onSaved: () => Promise<void> | void;
}) {
  const toast = useToast();
  const [ask, confirmDialog] = useConfirm();
  const profileFormId = useId();
  const bonusFormId = useId();

  const [current, setCurrent] = useState<ClientView | null>(client);
  const [tab, setTab] = useState<ClientTab>('profile');
  const [editForm, setEditForm] = useState<ClientFormState>(EMPTY_CLIENT);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);

  const [conditions, setConditions] = useState<ConditionView[]>([]);
  const [newConditionId, setNewConditionId] = useState('');
  const [clientEhr, setClientEhr] = useState<EhrRecord | null>(null);
  const [clientLoyalty, setClientLoyalty] = useState<LoyaltyAccount | null>(null);
  const [clientTransactions, setClientTransactions] = useState<BonusTransaction[]>([]);

  const [bonusOpen, setBonusOpen] = useState(false);
  const [bonusAmount, setBonusAmount] = useState('100');
  const [bonusDescription, setBonusDescription] = useState('Поощрительное начисление баллов');
  const [bonusError, setBonusError] = useState<unknown>(null);

  useEffect(() => {
    if (!client) return;
    let alive = true;
    setCurrent(client);
    setEditForm(clientToForm(client));
    setError(null);
    setLoading(true);
    setClientEhr(null);
    setClientLoyalty(null);
    void (async () => {
      try {
        const [full, conds, ehrData, lAcc, lTx] = await Promise.all([
          clients.one(client.id),
          clients.conditions(client.id),
          ehr.get(client.id),
          loyalty.account(client.id),
          loyalty.transactions(client.id),
        ]);
        if (!alive) return;
        setCurrent(full);
        setConditions(conds);
        setClientEhr(ehrData);
        setClientLoyalty(lAcc);
        setClientTransactions(lTx);
      } catch (err) {
        if (alive) setError(err);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [client]);

  async function saveProfile(e: FormEvent) {
    e.preventDefault();
    if (!current) return;
    setError(null);
    setBusy(true);
    try {
      setCurrent(await clients.update(current.id, toRequest(editForm)));
      toast.success('Данные клиента сохранены.');
      await onSaved();
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  }

  async function addCondition() {
    if (!current || !newConditionId) return;
    setError(null);
    try {
      await clients.addCondition(current.id, Number(newConditionId));
      setNewConditionId('');
      setConditions(await clients.conditions(current.id));
      toast.success('Медицинское состояние добавлено в карту гостя.');
    } catch (err) {
      setError(err);
    }
  }

  async function removeCondition(c: ConditionView) {
    if (!current) return;
    if (!(await ask({ title: 'Удаление состояния', message: `Удалить «${c.name}» из карты гостя?`, confirmLabel: 'Удалить', danger: true }))) return;
    setError(null);
    try {
      await clients.removeCondition(current.id, c.conditionId);
      setConditions(await clients.conditions(current.id));
      toast.success('Медицинское состояние удалено.');
    } catch (err) {
      setError(err);
    }
  }

  async function addBonus(e: FormEvent) {
    e.preventDefault();
    if (!current) return;
    setBonusError(null);
    setBusy(true);
    try {
      const amount = Number(bonusAmount);
      await loyalty.addBonus(current.id, amount, bonusDescription);
      const [lAcc, lTx] = await Promise.all([loyalty.account(current.id), loyalty.transactions(current.id)]);
      setClientLoyalty(lAcc);
      setClientTransactions(lTx);
      setBonusOpen(false);
      toast.success(`Гостю начислено ${amount} бонусных баллов.`);
    } catch (err) {
      setBonusError(err);
    } finally {
      setBusy(false);
    }
  }

  const conditionColumns: Column<ConditionView>[] = [
    { key: 'code', header: 'Код МКБ', render: (c) => <span className="u-semibold">{c.code}</span>, sortValue: (c) => c.code },
    { key: 'name', header: 'Состояние', className: 'wrap', render: (c) => c.name, sortValue: (c) => c.name },
    { key: 'date', header: 'Дата', render: (c) => c.diagnosedAt ?? '—', sortValue: (c) => c.diagnosedAt },
    {
      key: 'actions',
      header: 'Действия',
      hideHeader: true,
      align: 'right',
      className: 'actions',
      render: (c) => (
        <Button variant="ghost" size="sm" icon={<Icon name="trash" size={16} />} onClick={() => void removeCondition(c)} aria-label={`Удалить состояние ${c.name}`}>
          Удалить
        </Button>
      ),
    },
  ];

  const available = allConditions.filter((c) => !conditions.some((x) => x.conditionId === c.id));
  const isProfile = tab === 'profile';

  return (
    <>
      {confirmDialog}
      <Modal
        isOpen={client !== null}
        onClose={onClose}
        title={current ? `Карточка гостя: ${current.lastName} ${current.firstName} (№ ${current.id})` : ''}
        size="lg"
        footer={
          <>
            <Button variant="secondary" onClick={onClose}>
              Закрыть
            </Button>
            {isProfile && (
              <Button type="submit" form={profileFormId} variant="primary" loading={busy}>
                Сохранить изменения
              </Button>
            )}
          </>
        }
      >
        <Tabs<ClientTab>
          label="Разделы карточки гостя"
          value={tab}
          onChange={setTab}
          tabs={[
            { id: 'profile', label: 'Профиль', icon: 'user' },
            { id: 'ehr', label: 'Медкарта и диагнозы', icon: 'stethoscope', count: loading ? undefined : conditions.length },
            { id: 'loyalty', label: clientLoyalty ? `Лояльность · ${clientLoyalty.balance} б.` : 'Лояльность', icon: 'star' },
          ]}
        />
        <ErrorBox error={error} />

        {isProfile && (
          <form id={profileFormId} onSubmit={saveProfile}>
            <ClientFormFields value={editForm} onChange={setEditForm} />
          </form>
        )}

        {tab === 'ehr' &&
          (loading || !clientEhr ? (
            <SkeletonRows rows={4} />
          ) : (
            <div className="u-stack-16">
              <EhrSummary record={clientEhr} detailed={false} />
              <DataTable
                rows={conditions}
                columns={conditionColumns}
                rowKey={(c) => c.conditionId}
                caption="Зарегистрированные состояния здоровья"
                dense
                emptyTitle="Состояния здоровья не зарегистрированы"
                emptyDescription="Добавьте состояние из классификатора ниже."
              />
              <div className="inline dc-add-condition">
                <Field label="Добавить состояние в карту">
                  <select value={newConditionId} onChange={(e) => setNewConditionId(e.target.value)}>
                    <option value="">— Выберите из классификатора —</option>
                    {available.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.code} — {c.name}
                      </option>
                    ))}
                  </select>
                </Field>
                <Button variant="primary" icon={<Icon name="plus" size={18} />} disabled={!newConditionId} onClick={() => void addCondition()}>
                  Добавить
                </Button>
              </div>
            </div>
          ))}

        {tab === 'loyalty' &&
          (loading || !clientLoyalty ? (
            <SkeletonRows rows={4} />
          ) : (
            <LoyaltyPanel
              account={clientLoyalty}
              transactions={clientTransactions}
              onAddBonus={() => {
                setBonusError(null);
                setBonusOpen(true);
              }}
            />
          ))}
      </Modal>

      <Modal
        isOpen={bonusOpen}
        onClose={() => setBonusOpen(false)}
        title={`Начисление бонусов гостю № ${current?.id ?? ''}`}
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setBonusOpen(false)}>
              Отмена
            </Button>
            <Button type="submit" form={bonusFormId} variant="primary" loading={busy}>
              Начислить
            </Button>
          </>
        }
      >
        <form id={bonusFormId} onSubmit={addBonus}>
          <Field label="Количество бонусных баллов" required hint="1 балл = 1 BYN">
            <input type="number" min={1} value={bonusAmount} required onChange={(e) => setBonusAmount(e.target.value)} />
          </Field>
          <Field label="Основание начисления" required>
            <input value={bonusDescription} required onChange={(e) => setBonusDescription(e.target.value)} />
          </Field>
          <ErrorBox error={bonusError} />
        </form>
      </Modal>
    </>
  );
}
