import { periodId } from '@/lib/domain/period';
import { cleanString, parseMonth, parseNumber, type Grid, type RawCell } from './cells';
import { issue, IngestError, type IngestIssue } from './errors';
import { locateHeader, type ColumnSpec } from './header';
import {
  employeeKeyFromName,
  type ParseOptions,
  type ParseResult,
  type ParsedSalaryRow,
} from './types';

type Field = 'employeeNo' | 'employeeName';

const COLUMNS: ColumnSpec<Field>[] = [
  { field: 'employeeNo', aliases: ['employee no', 'employee number', 'emp no', 'staff no'] },
  {
    field: 'employeeName',
    aliases: ['employee name', 'employee', 'staff name', 'name'],
    required: true,
  },
];

interface MonthColumn {
  column: number;
  month: number;
  year: number | null;
  caption: string;
}

/**
 * The salary sheet is a matrix: one row per person, one column per month. The
 * header row is found by looking for the row that carries the month captions,
 * which is also what tells us this is a salary sheet at all.
 */
export function parseSalaries(
  grid: Grid,
  sheetName: string,
  options: ParseOptions = {},
): ParseResult<ParsedSalaryRow> {
  const header = locateHeader(grid, COLUMNS, {
    sheetName,
    extraScore: (row) => countMonthCaptions(row) * 40,
  });

  const headerRow = grid[header.rowIndex] ?? [];
  const nameColumn = header.columns.get('employeeName')!;
  const noColumn = header.columns.get('employeeNo');

  const monthColumns = readMonthColumns(headerRow, new Set([nameColumn, noColumn ?? -1]));
  if (monthColumns.length === 0) {
    throw new IngestError(
      'No month columns were found in the salary sheet.',
      'Expected a column per month, captioned January through December.',
    );
  }

  const issues: IngestIssue[] = [];
  const titleYear = findYearAbove(grid, header.rowIndex);
  const defaultYear =
    monthColumns.find((c) => c.year !== null)?.year ?? titleYear ?? options.fallbackYear ?? null;

  if (defaultYear === null) {
    throw new IngestError(
      'The salary sheet does not say which year it covers.',
      'Add the year to the sheet title or to the month headings, or name the file e.g. salaries-2025.xlsx.',
    );
  }

  const rows: ParsedSalaryRow[] = [];
  const periods = new Set<number>();
  let skippedRows = 0;
  let blankCells = 0;

  grid.slice(header.rowIndex + 1).forEach((raw, index) => {
    const sheetRow = header.rowIndex + index + 2;
    if (raw.every((cell) => cleanString(cell) === null)) return;

    const name = cleanString(raw[nameColumn]);
    if (!name) {
      skippedRows++;
      issues.push(issue('warning', 'Row has no employee name and was skipped.', sheetRow, 'Employee Name'));
      return;
    }

    const employeeNo =
      (noColumn === undefined ? null : cleanString(raw[noColumn])) ?? employeeKeyFromName(name);

    let monthsForRow = 0;
    for (const monthColumn of monthColumns) {
      const cell = raw[monthColumn.column] ?? null;
      const amount = parseNumber(cell);

      if (amount === null) {
        // A blank or "-" salary cell means "not provided", not "paid zero".
        // Leaving it out keeps a re-upload from wiping a month that was fine.
        if (cleanString(cell) !== null) {
          issues.push(
            issue(
              'error',
              `Salary "${cleanString(cell)}" is not a number.`,
              sheetRow,
              monthColumn.caption,
            ),
          );
        } else {
          blankCells++;
        }
        continue;
      }

      if (amount < 0) {
        issues.push(
          issue('error', `Salary cannot be negative (${amount}).`, sheetRow, monthColumn.caption),
        );
        continue;
      }

      const year = monthColumn.year ?? defaultYear;
      rows.push({ employeeNo, employeeName: name, year, month: monthColumn.month, amount });
      periods.add(periodId(year, monthColumn.month));
      monthsForRow++;
    }

    if (monthsForRow === 0) {
      issues.push(issue('warning', `${name} has no salary figures in this file.`, sheetRow));
    }
  });

  if (blankCells > 0) {
    issues.push(
      issue(
        'warning',
        `${blankCells} blank salary cell(s) were treated as "not provided" and left unchanged.`,
      ),
    );
  }
  if (rows.length === 0) {
    issues.push(issue('error', 'No usable salary figures were found in this file.'));
  }

  return {
    kind: 'salaries',
    sheetName,
    headerRow: header.rowIndex + 1,
    rows,
    issues,
    periods: [...periods].sort().map((id) => ({ year: Math.floor(id / 100), month: id % 100 })),
    assumedYear: defaultYear,
    skippedRows,
  };
}

function readMonthColumns(headerRow: RawCell[], reserved: Set<number>): MonthColumn[] {
  const columns: MonthColumn[] = [];
  const seen = new Set<number>();

  headerRow.forEach((cell, column) => {
    if (reserved.has(column)) return;
    const caption = cleanString(cell);
    if (!caption) return;
    const parsed = parseMonth(cell);
    if (!parsed || seen.has(parsed.month)) return;
    seen.add(parsed.month);
    columns.push({ column, month: parsed.month, year: parsed.year, caption });
  });

  return columns;
}

function countMonthCaptions(row: RawCell[]): number {
  const seen = new Set<number>();
  for (const cell of row) {
    if (typeof cell !== 'string') continue;
    const parsed = parseMonth(cell);
    if (parsed) seen.add(parsed.month);
  }
  return seen.size;
}

/** Picks a year out of a title row such as "Salary Overview 2025 (AED)". */
function findYearAbove(grid: Grid, headerRowIndex: number): number | null {
  for (let row = headerRowIndex - 1; row >= 0; row--) {
    for (const cell of grid[row] ?? []) {
      const text = cleanString(cell);
      if (!text) continue;
      const match = text.match(/\b(19|20)\d{2}\b/);
      if (match) return Number(match[0]);
    }
  }
  return null;
}
