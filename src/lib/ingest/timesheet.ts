import { periodId } from '@/lib/domain/period';
import { cleanString, parseMonth, parseNumber, type Grid } from './cells';
import { issue, type IngestIssue } from './errors';
import { locateHeader, type ColumnSpec } from './header';
import {
  employeeKeyFromName,
  type ParseOptions,
  type ParseResult,
  type ParsedTimesheetRow,
} from './types';

type Field =
  | 'month'
  | 'employeeNo'
  | 'employeeName'
  | 'expenseType'
  | 'department'
  | 'designation'
  | 'category'
  | 'refCode'
  | 'taskName'
  | 'company'
  | 'description'
  | 'hours';

const COLUMNS: ColumnSpec<Field>[] = [
  { field: 'month', aliases: ['month', 'period'], required: true },
  { field: 'employeeNo', aliases: ['employee no', 'employee number', 'emp no', 'staff no'] },
  {
    field: 'employeeName',
    aliases: ['employee name', 'employee', 'staff name', 'name'],
    required: true,
  },
  { field: 'expenseType', aliases: ['type of expense', 'expense type', 'dl idl', 'type'] },
  { field: 'department', aliases: ['department', 'dept'] },
  { field: 'designation', aliases: ['designation', 'role', 'title'] },
  { field: 'category', aliases: ['category'], required: true },
  { field: 'refCode', aliases: ['ref code', 'reference code', 'refcode', 'ref'] },
  { field: 'taskName', aliases: ['project', 'project name', 'task name', 'project task name'] },
  { field: 'company', aliases: ['company', 'company name', 'client'] },
  { field: 'description', aliases: ['description', 'notes', 'remarks'] },
  { field: 'hours', aliases: ['hours', 'hrs', 'total hours'], required: true },
];

const UNCATEGORISED = 'Uncategorised';

export function parseTimesheet(
  grid: Grid,
  sheetName: string,
  options: ParseOptions = {},
): ParseResult<ParsedTimesheetRow> {
  const header = locateHeader(grid, COLUMNS, { sheetName });
  const at = (row: (string | number | boolean | Date | null | undefined)[], field: Field) => {
    const column = header.columns.get(field);
    return column === undefined ? null : (row[column] ?? null);
  };

  const issues: IngestIssue[] = [];
  const body = grid.slice(header.rowIndex + 1);

  // Two passes: the first learns which year this file is about, so rows that
  // say only "January" can be placed without guessing per row.
  const months = body.map((row) => parseMonth(at(row, 'month')));
  const assumedYear = resolveYear(months, options.fallbackYear);

  const rows: ParsedTimesheetRow[] = [];
  const periods = new Set<number>();
  let zeroHourRows = 0;
  let skippedRows = 0;

  body.forEach((raw, index) => {
    const sheetRow = header.rowIndex + index + 2;
    const name = cleanString(at(raw, 'employeeName'));
    const parsedMonth = months[index];

    if (isBlankRow(raw)) return;

    if (!name) {
      skippedRows++;
      issues.push(issue('warning', 'Row has no employee name and was skipped.', sheetRow, 'Employee Name'));
      return;
    }

    if (!parsedMonth) {
      skippedRows++;
      issues.push(
        issue('error', `Could not read the month "${formatCell(at(raw, 'month'))}".`, sheetRow, 'Month'),
      );
      return;
    }

    const year = parsedMonth.year ?? assumedYear;
    if (year === null) {
      skippedRows++;
      issues.push(
        issue('error', 'The month cell carries no year and none could be inferred.', sheetRow, 'Month'),
      );
      return;
    }

    const rawHours = at(raw, 'hours');
    const hours = parseNumber(rawHours);
    if (hours === null && cleanString(rawHours) !== null) {
      skippedRows++;
      issues.push(
        issue('error', `Hours "${formatCell(rawHours)}" is not a number.`, sheetRow, 'Hours'),
      );
      return;
    }
    if (hours !== null && hours < 0) {
      skippedRows++;
      issues.push(issue('error', `Hours cannot be negative (${hours}).`, sheetRow, 'Hours'));
      return;
    }
    if (hours === null || hours === 0) {
      zeroHourRows++;
      return;
    }

    let category = cleanString(at(raw, 'category'));
    if (!category) {
      category = UNCATEGORISED;
      issues.push(
        issue('warning', `No category; counted as "${UNCATEGORISED}".`, sheetRow, 'Category'),
      );
    }

    const employeeNo = cleanString(at(raw, 'employeeNo')) ?? employeeKeyFromName(name);

    rows.push({
      year,
      month: parsedMonth.month,
      employeeNo,
      employeeName: name,
      expenseType: cleanString(at(raw, 'expenseType')),
      department: cleanString(at(raw, 'department')),
      designation: cleanString(at(raw, 'designation')),
      category,
      refCode: cleanString(at(raw, 'refCode')),
      taskName: cleanString(at(raw, 'taskName')),
      company: cleanString(at(raw, 'company')),
      description: cleanString(at(raw, 'description')),
      hours,
    });
    periods.add(periodId(year, parsedMonth.month));
  });

  if (zeroHourRows > 0) {
    issues.push(
      issue('warning', `${zeroHourRows} row(s) logged no hours and were left out of the totals.`),
    );
  }
  if (header.unmatched.length > 0) {
    issues.push(
      issue('warning', `Optional column(s) not found: ${header.unmatched.join(', ')}.`),
    );
  }
  if (rows.length === 0) {
    issues.push(issue('error', 'No usable timesheet rows were found in this file.'));
  }

  return {
    kind: 'timesheet',
    sheetName,
    headerRow: header.rowIndex + 1,
    rows,
    issues,
    periods: [...periods].sort().map((id) => ({ year: Math.floor(id / 100), month: id % 100 })),
    assumedYear,
    skippedRows,
  };
}

/** The file's own most common year wins; the filename is only a last resort. */
function resolveYear(
  months: ReturnType<typeof parseMonth>[],
  fallbackYear: number | undefined,
): number | null {
  const counts = new Map<number, number>();
  for (const month of months) {
    if (month?.year == null) continue;
    counts.set(month.year, (counts.get(month.year) ?? 0) + 1);
  }
  if (counts.size > 0) {
    return [...counts.entries()].sort((a, b) => b[1] - a[1] || b[0] - a[0])[0][0];
  }
  return fallbackYear ?? null;
}

function isBlankRow(row: (string | number | boolean | Date | null | undefined)[]): boolean {
  return row.every((cell) => cleanString(cell) === null);
}

function formatCell(value: string | number | boolean | Date | null | undefined): string {
  return cleanString(value) ?? '(blank)';
}
