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
}

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
}: DataTableProps<Row>) {
  const matrix: CsvValue[][] = [
    columns.map((column) => column.header),
    ...rows.map((row) => columns.map((column) => column.value(row))),
  ];

  const table = (
    <div className={cn('overflow-x-auto', maxHeight && 'overflow-y-auto')} style={{ maxHeight }}>
      <Table>
        <TableHeader className="sticky top-0 z-10 bg-background">
          <TableRow className="hover:bg-transparent">
            {columns.map((column) => (
              <TableHead
                key={column.key}
                className={cn(
                  'whitespace-nowrap text-xs font-medium uppercase tracking-wide text-muted-foreground',
                  column.align === 'right' && 'text-right',
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
            <TableRow key={rowKey(row)}>
              {columns.map((column) => (
                <TableCell
                  key={column.key}
                  className={cn(
                    'py-2.5 text-sm',
                    column.align === 'right' && 'num text-right tabular-nums',
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
            <TableRow className="hover:bg-transparent">
              {columns.map((column) => (
                <TableCell
                  key={column.key}
                  className={cn(
                    'py-2.5 text-sm font-medium',
                    column.align === 'right' && 'num text-right tabular-nums',
                  )}
                >
                  {footer[column.key] ?? null}
                </TableCell>
              ))}
            </TableRow>
          </TableFooter>
        ) : null}
      </Table>
    </div>
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
