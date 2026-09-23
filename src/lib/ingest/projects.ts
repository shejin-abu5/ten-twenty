import { cleanString, parseMonth, parseNumber, type Grid, type RawCell } from './cells';
import { issue, type IngestIssue } from './errors';
import { locateHeader, type ColumnSpec } from './header';
import type { ParseOptions, ParseResult, ParsedProjectRow } from './types';

type Field = 'refCode' | 'name' | 'price' | 'salesMonth' | 'category' | 'status';

const COLUMNS: ColumnSpec<Field>[] = [
  { field: 'refCode', aliases: ['ref code', 'reference code', 'refcode', 'ref'], required: true },
  { field: 'name', aliases: ['project name', 'project', 'name'] },
  {
    field: 'price',
    aliases: ['project price', 'price', 'sale value', 'value', 'amount'],
    required: true,
  },
  { field: 'salesMonth', aliases: ['sales month', 'sale month', 'month sold', 'month'] },
  { field: 'category', aliases: ['category'] },
  { field: 'status', aliases: ['status'] },
];

export function parseProjects(
  grid: Grid,
  sheetName: string,
  options: ParseOptions = {},
): ParseResult<ParsedProjectRow> {
  const header = locateHeader(grid, COLUMNS, { sheetName });
  const at = (row: RawCell[], field: Field) => {
    const column = header.columns.get(field);
    return column === undefined ? null : (row[column] ?? null);
  };

  const issues: IngestIssue[] = [];
  const rows: ParsedProjectRow[] = [];
  const seen = new Map<string, number>();
  let skippedRows = 0;

  grid.slice(header.rowIndex + 1).forEach((raw, index) => {
    const sheetRow = header.rowIndex + index + 2;
    if (raw.every((cell) => cleanString(cell) === null)) return;

    const refCode = cleanString(at(raw, 'refCode'));
    if (!refCode) {
      skippedRows++;
      issues.push(issue('warning', 'Row has no ref code and was skipped.', sheetRow, 'Ref Code'));
      return;
    }

    const previous = seen.get(refCode);
    if (previous !== undefined) {
      issues.push(
        issue(
          'warning',
          `Ref code ${refCode} also appears on row ${previous}; the later row wins.`,
          sheetRow,
          'Ref Code',
        ),
      );
    }
    seen.set(refCode, sheetRow);

    const rawPrice = at(raw, 'price');
    const price = parseNumber(rawPrice);
    if (price === null && cleanString(rawPrice) !== null) {
      issues.push(
        issue(
          'error',
          `Price "${cleanString(rawPrice)}" is not a number; the project is loaded without one.`,
          sheetRow,
          'Project Price',
        ),
      );
    } else if (price === null) {
      issues.push(
        issue('warning', `${refCode} has no price; its margin cannot be calculated.`, sheetRow, 'Project Price'),
      );
    }

    const sales = parseMonth(at(raw, 'salesMonth'));

    rows.push({
      refCode,
      name: cleanString(at(raw, 'name')),
      price,
      salesYear: sales?.year ?? options.fallbackYear ?? null,
      salesMonth: sales?.month ?? null,
      category: cleanString(at(raw, 'category')),
      status: cleanString(at(raw, 'status')),
    });
  });

  if (header.unmatched.length > 0) {
    issues.push(issue('warning', `Optional column(s) not found: ${header.unmatched.join(', ')}.`));
  }
  if (rows.length === 0) {
    issues.push(issue('error', 'No usable project rows were found in this file.'));
  }

  // Later duplicates win, matching the message written above.
  const deduped = [...new Map(rows.map((row) => [row.refCode, row])).values()];

  return {
    kind: 'projects',
    sheetName,
    headerRow: header.rowIndex + 1,
    rows: deduped,
    issues,
    periods: [],
    assumedYear: options.fallbackYear ?? null,
    skippedRows,
  };
}
