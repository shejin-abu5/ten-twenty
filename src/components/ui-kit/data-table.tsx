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
import { PanelHeading } from './panel';

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
  /** Renders without the surrounding panel, for tables nested in another one. */
  bare?: boolean;
  maxHeight?: string;
  /**
   * Freezes the first column so it stays put while the rest scrolls sideways.
   * Nothing moves until the table is actually wider than its container.
   */
  pinFirstColumn?: boolean;
}

/**
 * Sticky cells take their colour from the row so hover and totals stay in step.
 * The divider is a pseudo-element: with collapsed borders a real `border-r`
 * belongs to the table grid and scrolls away from the pinned cell.
 */
const PINNED_CELL =
  'sticky left-0 bg-inherit after:pointer-events-none after:absolute after:inset-y-0 after:right-0 after:w-px after:bg-border';

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
        <TableRow className="bg-paper hover:bg-paper">
          {columns.map((column, index) => (
            <TableHead
              key={column.key}
              className={cn(
                'ledger-label h-auto whitespace-nowrap px-3 py-3 first:pl-5 last:pr-5',
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
          <TableRow
            key={rowKey(row)}
            className="bg-paper transition-colors duration-100 hover:bg-row-hover"
          >
            {columns.map((column, index) => (
              <TableCell
                key={column.key}
                className={cn(
                  'px-3 py-3 text-sm first:pl-5 last:pr-5',
                  column.align === 'right' && 'num text-right',
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
        <TableFooter className="border-t-0 bg-transparent">
          <TableRow className="bg-paper hover:bg-paper">
            {columns.map((column, index) => (
              <TableCell
                key={column.key}
                className={cn(
                  'rule-total px-3 py-3 text-sm font-medium first:pl-5 last:pr-5',
                  column.align === 'right' && 'num text-right',
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

  // Clipped, or the cells' own background paints over the rounded corners and
  // squares off the bottom of the panel.
  return (
    <section className="min-w-0 overflow-hidden rounded-lg border">
      <PanelHeading title={title} description={description}>
        {action || exportFilename ? (
          <>
            {action}
            {exportFilename ? <ExportCsvButton filename={exportFilename} matrix={matrix} /> : null}
          </>
        ) : null}
      </PanelHeading>
      {body}
    </section>
  );
}

function TableEmpty() {
  return (
    <p className="px-5 py-12 text-center text-sm text-muted-foreground">
      Nothing to show for this period.
    </p>
  );
}
