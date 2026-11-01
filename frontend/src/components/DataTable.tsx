import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { EmptyState, Pagination, SearchBar, SkeletonRows } from './ui';
import { Icon } from './icons';

export interface Column<T> {
  /** Уникальный ключ колонки. */
  key: string;
  header: ReactNode;
  /** Содержимое ячейки. */
  render: (row: T) => ReactNode;
  /** Значение для сортировки; если не задано — колонка не сортируется. */
  sortValue?: (row: T) => string | number | null | undefined;
  align?: 'left' | 'right' | 'center';
  /** Дополнительный класс ячейки (например, 'wrap', 'actions', 'num'). */
  className?: string;
  /** Скрыть заголовок визуально (для колонок действий). */
  hideHeader?: boolean;
}

type SortDir = 'asc' | 'desc';

/** Хук: поиск + сортировка + пагинация. Пригоден и для своей разметки. */
export function useTableState<T>(rows: T[], opts: {
  searchText?: (row: T) => string;
  columns?: Column<T>[];
  pageSize?: number;
  initialSort?: { key: string; dir: SortDir };
}) {
  const { searchText, columns = [], pageSize = 20, initialSort } = opts;
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<{ key: string; dir: SortDir } | null>(initialSort ?? null);
  const [page, setPage] = useState(1);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q || !searchText) return rows;
    return rows.filter((r) => searchText(r).toLowerCase().includes(q));
  }, [rows, query, searchText]);

  const sorted = useMemo(() => {
    if (!sort) return filtered;
    const col = columns.find((c) => c.key === sort.key);
    if (!col?.sortValue) return filtered;
    const get = col.sortValue;
    const mul = sort.dir === 'asc' ? 1 : -1;
    return [...filtered].sort((a, b) => {
      const va = get(a);
      const vb = get(b);
      if (va === vb) return 0;
      if (va === null || va === undefined || va === '') return 1;
      if (vb === null || vb === undefined || vb === '') return -1;
      if (typeof va === 'number' && typeof vb === 'number') return (va - vb) * mul;
      return String(va).localeCompare(String(vb), 'ru', { numeric: true }) * mul;
    });
  }, [filtered, sort, columns]);

  const pageCount = Math.max(1, Math.ceil(sorted.length / pageSize));
  useEffect(() => { setPage(1); }, [query, sort]);
  useEffect(() => { if (page > pageCount) setPage(pageCount); }, [page, pageCount]);
  const pageRows = sorted.slice((page - 1) * pageSize, page * pageSize);

  const toggleSort = (key: string) =>
    setSort((s) => (s?.key === key ? (s.dir === 'asc' ? { key, dir: 'desc' } : null) : { key, dir: 'asc' }));

  return { query, setQuery, sort, toggleSort, page, setPage, pageCount, pageRows, total: sorted.length, all: rows.length };
}

export function DataTable<T>({
  rows,
  columns,
  rowKey,
  caption,
  label,
  searchText,
  searchPlaceholder = 'Поиск в таблице',
  pageSize = 20,
  loading = false,
  emptyTitle = 'Записей нет',
  emptyDescription,
  emptyAction,
  onRowClick,
  rowClassName,
  toolbar,
  initialSort,
  dense = false,
}: {
  rows: T[];
  columns: Column<T>[];
  rowKey: (row: T) => string | number;
  /** Видимая подпись таблицы (caption) — задаёт доступное имя таблицы. */
  caption?: string;
  /** Доступное имя без видимой подписи. */
  label?: string;
  searchText?: (row: T) => string;
  searchPlaceholder?: string;
  pageSize?: number;
  loading?: boolean;
  emptyTitle?: string;
  emptyDescription?: string;
  emptyAction?: ReactNode;
  onRowClick?: (row: T) => void;
  rowClassName?: (row: T) => string | undefined;
  toolbar?: ReactNode;
  initialSort?: { key: string; dir: SortDir };
  dense?: boolean;
}) {
  const t = useTableState(rows, { searchText, columns, pageSize, initialSort });
  const showToolbar = Boolean(searchText || toolbar);

  return (
    <div className="data-table">
      {showToolbar && (
        <div className="table-toolbar">
          {searchText && <SearchBar value={t.query} onChange={t.setQuery} placeholder={searchPlaceholder} label={searchPlaceholder} />}
          {toolbar && <div className="table-toolbar-extra">{toolbar}</div>}
          <span className="table-count">
            {t.total === t.all ? `Всего: ${t.all}` : `Найдено: ${t.total} из ${t.all}`}
          </span>
        </div>
      )}
      {loading && rows.length === 0 ? (
        <SkeletonRows rows={6} />
      ) : (
        <div className="table-wrap">
          <table className={dense ? 'table-dense' : undefined} aria-label={caption ? undefined : label}>
            {caption && <caption>{caption}</caption>}
            <thead>
              <tr>
                {columns.map((c) => {
                  const active = t.sort?.key === c.key;
                  const cls = [c.align === 'right' ? 'num' : '', c.align === 'center' ? 'center' : ''].filter(Boolean).join(' ') || undefined;
                  return (
                    <th
                      key={c.key}
                      className={cls}
                      scope="col"
                      aria-sort={active ? (t.sort!.dir === 'asc' ? 'ascending' : 'descending') : c.sortValue ? 'none' : undefined}
                    >
                      {c.hideHeader ? (
                        <span className="sr-only">{c.header}</span>
                      ) : c.sortValue ? (
                        <button type="button" className="th-sort" onClick={() => t.toggleSort(c.key)}>
                          {c.header}
                          <Icon name={active ? (t.sort!.dir === 'asc' ? 'chevronUp' : 'chevronDown') : 'chevronDown'} size={14} className={active ? 'sort-ico is-active' : 'sort-ico'} />
                        </button>
                      ) : (
                        c.header
                      )}
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {t.pageRows.length === 0 ? (
                <tr>
                  <td colSpan={columns.length} className="empty-cell">
                    <EmptyState title={t.all === 0 ? emptyTitle : 'Ничего не найдено'} description={t.all === 0 ? emptyDescription : 'Измените условия поиска.'} action={t.all === 0 ? emptyAction : undefined} />
                  </td>
                </tr>
              ) : (
                t.pageRows.map((r) => (
                  <tr
                    key={rowKey(r)}
                    className={[onRowClick ? 'is-clickable' : '', rowClassName?.(r) ?? ''].filter(Boolean).join(' ') || undefined}
                    onClick={onRowClick ? () => onRowClick(r) : undefined}
                  >
                    {columns.map((c) => (
                      <td key={c.key} className={[c.className ?? '', c.align === 'right' ? 'num' : '', c.align === 'center' ? 'center' : ''].filter(Boolean).join(' ') || undefined}>
                        {c.render(r)}
                      </td>
                    ))}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
      <Pagination page={t.page} pageCount={t.pageCount} onChange={t.setPage} />
    </div>
  );
}
