import type { ReactNode } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import type { CsvValue } from '@/lib/csv';
import { cn } from '@/lib/utils';
import { ExportCsvButton } from './export-csv-button';

export interface Column<Row> {
  key: string;
  header: string;
  align?: 'left' | 'right';
  /**
   * The value as a number or plain string. Drives the CSV export, so what gets
   * exported can never drift from what is on screen.
   */
  value: (row: Row) => CsvValue;
  /** Optional richer cell. Falls back to the value. */
  render?: (row: Row) => ReactNode;
  className?: string;
  headerClassName?: string;
}

interface DataTableProps<Row> {
  title?: string;
  description?: string;
  columns: Column<Row>[];
  rows: Row[];
  rowKey: (row: Row) => string;
  /** Footer cells keyed by column key, for totals. */
  footer?: Record<string, ReactNode>;
  empty?: ReactNode;
  exportFilename?: string;
  action?: ReactNode;
  /** Renders without the surrounding card, for tables nested in another panel. */
  bare?: boolean;
  maxHeight?: string;
  /**
   * Freezes the first column so it stays put while the rest scrolls sideways.
   * Nothing moves until the table is actually wider than its container.
   */
  pinFirstColumn?: boolean;
}

/** Sticky cells take their colour from the row so hover and totals stay in step. */
const PINNED_CELL = 'sticky left-0 bg-inherit border-r';

export function DataTable<Row>({
  title,
  description,
  columns,
  rows,
  rowKey,
  footer,
  empty,
  exportFilename,
  action,
  bare = false,
  maxHeight,
  pinFirstColumn = true,
}: DataTableProps<Row>) {
  const pinned = (index: number) => pinFirstColumn && index === 0;

  const matrix: CsvValue[][] = [
    columns.map((column) => column.header),
    ...rows.map((row) => columns.map((column) => column.value(row))),
  ];

  const table = (
    <Table
      containerClassName={cn(maxHeight && 'overflow-y-auto')}
      containerStyle={maxHeight ? { maxHeight } : undefined}
    >
      <TableHeader className="sticky top-0 z-20">
        <TableRow className="bg-background hover:bg-background">
          {columns.map((column, index) => (
            <TableHead
              key={column.key}
              className={cn(
                'whitespace-nowrap text-xs font-medium uppercase tracking-wide text-muted-foreground',
                column.align === 'right' && 'text-right',
                pinned(index) && `${PINNED_CELL} z-10`,
                column.headerClassName,
              )}
            >
              {column.header}
            </TableHead>
          ))}
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row) => (
          <TableRow key={rowKey(row)} className="bg-background hover:bg-muted">
            {columns.map((column, index) => (
              <TableCell
                key={column.key}
                className={cn(
                  'py-2.5 text-sm',
                  column.align === 'right' && 'num text-right tabular-nums',
                  pinned(index) && `${PINNED_CELL} z-10`,
                  column.className,
                )}
              >
                {column.render ? column.render(row) : (column.value(row) ?? '—')}
              </TableCell>
            ))}
          </TableRow>
        ))}
      </TableBody>
      {footer ? (
        <TableFooter>
          <TableRow className="bg-muted hover:bg-muted">
            {columns.map((column, index) => (
              <TableCell
                key={column.key}
                className={cn(
                  'py-2.5 text-sm font-medium',
                  column.align === 'right' && 'num text-right tabular-nums',
                  pinned(index) && `${PINNED_CELL} z-10`,
                )}
              >
                {footer[column.key] ?? null}
              </TableCell>
            ))}
          </TableRow>
        </TableFooter>
      ) : null}
    </Table>
  );

  const body = rows.length === 0 ? (empty ?? <TableEmpty />) : table;

  if (bare) return body;

  return (
    <section className="rounded-lg border bg-background">
      {title || action || exportFilename ? (
        <div className="flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3">
          <div className="min-w-0">
            {title ? <h2 className="text-sm font-semibold tracking-tight">{title}</h2> : null}
            {description ? (
              <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>
            ) : null}
          </div>
          <div className="flex items-center gap-2">
            {action}
            {exportFilename ? (
              <ExportCsvButton filename={exportFilename} matrix={matrix} />
            ) : null}
          </div>
        </div>
      ) : null}
      {body}
    </section>
  );
}

function TableEmpty() {
  return (
    <p className="px-4 py-10 text-center text-sm text-muted-foreground">
      Nothing to show for this period.
    </p>
  );
}
