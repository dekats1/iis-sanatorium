import { useMemo } from 'react';
import { Button, ErrorBox, formatDateTime, Modal } from '../ui';
import { DataTable, type Column } from '../DataTable';
import { Icon } from '../icons';
import type { WaitlistEntry } from '../../types';
import { period } from './bookingUtils';

/** Лист ожидания для администратора бронирования. */
export default function WaitlistModal({
  isOpen,
  onClose,
  queue,
  clientName,
  categoryName,
  onRemove,
  busyId,
  error,
}: {
  isOpen: boolean;
  onClose: () => void;
  queue: WaitlistEntry[];
  clientName: (id: number) => string;
  categoryName: (id: number | null | undefined) => string;
  onRemove: (entry: WaitlistEntry) => void;
  busyId: number | null;
  error: unknown;
}) {
  const columns = useMemo<Column<WaitlistEntry>[]>(
    () => [
      { key: 'id', header: 'ID', render: (e) => `#${e.id}`, sortValue: (e) => e.id },
      { key: 'guest', header: 'Гость', render: (e) => <strong>{clientName(e.clientId)}</strong>, sortValue: (e) => clientName(e.clientId) },
      { key: 'category', header: 'Желаемая категория', render: (e) => categoryName(e.categoryId), sortValue: (e) => categoryName(e.categoryId) },
      { key: 'period', header: 'Период', render: (e) => period(e.dateFrom, e.dateTo), sortValue: (e) => e.dateFrom },
      { key: 'places', header: 'Мест', align: 'right', render: (e) => e.places, sortValue: (e) => e.places },
      { key: 'created', header: 'Дата заявки', render: (e) => formatDateTime(e.createdAt), sortValue: (e) => e.createdAt },
      {
        key: 'actions',
        header: 'Действия',
        hideHeader: true,
        className: 'actions',
        render: (e) => (
          <Button variant="danger" size="sm" icon={<Icon name="trash" size={16} />} loading={busyId === e.id} onClick={() => onRemove(e)}>
            Исключить
          </Button>
        ),
      },
    ],
    [clientName, categoryName, onRemove, busyId],
  );

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Лист ожидания (Waitlist)"
      size="lg"
      footer={
        <Button variant="secondary" onClick={onClose}>
          Закрыть
        </Button>
      }
    >
      <p className="note u-mb-16">Гости, ожидающие освобождения мест в выбранных категориях на желаемые даты.</p>
      <ErrorBox error={error} />
      <DataTable
        rows={queue}
        columns={columns}
        rowKey={(e) => e.id}
        label="Лист ожидания"
        searchText={(e) => `${e.id} ${clientName(e.clientId)} ${categoryName(e.categoryId)}`}
        searchPlaceholder="Поиск по гостю или категории"
        pageSize={10}
        dense
        initialSort={{ key: 'created', dir: 'asc' }}
        emptyTitle="Лист ожидания пуст"
        emptyDescription="Нет гостей, ожидающих появления свободных мест."
      />
    </Modal>
  );
}
