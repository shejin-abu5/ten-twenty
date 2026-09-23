import { normaliseHeader, parseMonth, type Grid, type RawCell } from './cells';
import { IngestError } from './errors';
import { parseProjects } from './projects';
import { parseSalaries } from './salaries';
import { parseTimesheet } from './timesheet';
import {
  DATASET_LABELS,
  yearFromFilename,
  type DatasetKind,
  type ParseResult,
  type ParsedProjectRow,
  type ParsedSalaryRow,
  type ParsedTimesheetRow,
} from './types';
import { readSheetGrid } from './workbook';

export * from './errors';
export * from './types';
export { readSheetGrid } from './workbook';

export type AnyParseResult =
  | ({ kind: 'timesheet' } & ParseResult<ParsedTimesheetRow>)
  | ({ kind: 'salaries' } & ParseResult<ParsedSalaryRow>)
  | ({ kind: 'projects' } & ParseResult<ParsedProjectRow>);

/**
 * Parses an uploaded workbook as the kind the user said it was.
 *
 * If it will not parse, the grid is sniffed for the other two shapes so the
 * error can say what the file actually looks like instead of "parse failed".
 */
export async function parseDataset(
  kind: DatasetKind,
  buffer: ArrayBuffer | Buffer,
  filename: string,
): Promise<AnyParseResult> {
  const { sheetName, grid } = await readSheetGrid(buffer);
  const options = { fallbackYear: yearFromFilename(filename) };

  const detected = detectKind(grid);
  if (detected && detected !== kind) {
    throw new IngestError(
      `"${filename}" does not look like the ${DATASET_LABELS[kind].toLowerCase()}.`,
      `Its columns match the ${DATASET_LABELS[detected].toLowerCase()} instead. Upload it in that slot, or check the file.`,
    );
  }

  switch (kind) {
    case 'timesheet':
      return { ...parseTimesheet(grid, sheetName, options), kind: 'timesheet' };
    case 'salaries':
      return { ...parseSalaries(grid, sheetName, options), kind: 'salaries' };
    case 'projects':
      return { ...parseProjects(grid, sheetName, options), kind: 'projects' };
  }
}

const SIGNATURES: Record<DatasetKind, string[][]> = {
  // Each inner array is a set of captions the sheet must carry to qualify.
  timesheet: [['hours', 'category'], ['hours', 'refcode'], ['hours', 'employeename']],
  projects: [['refcode', 'projectprice'], ['refcode', 'price'], ['refcode', 'salesmonth']],
  salaries: [],
};

/** Best guess at what a grid is, used only to write a better error message. */
export function detectKind(grid: Grid): DatasetKind | null {
  const depth = Math.min(grid.length, 20);
  let best: { kind: DatasetKind; score: number } | null = null;

  for (let rowIndex = 0; rowIndex < depth; rowIndex++) {
    const row = grid[rowIndex] ?? [];
    const captions = new Set(row.map(normaliseHeader).filter(Boolean));

    const monthCount = countMonths(row);
    if (monthCount >= 6 && hasAny(captions, ['employeename', 'employee', 'name'])) {
      return 'salaries';
    }

    for (const kind of ['timesheet', 'projects'] as const) {
      for (const signature of SIGNATURES[kind]) {
        const hits = signature.filter((caption) => hasCaption(captions, caption)).length;
        if (hits < signature.length) continue;
        if (!best || hits > best.score) best = { kind, score: hits };
      }
    }
  }

  return best?.kind ?? null;
}

function countMonths(row: RawCell[]): number {
  const seen = new Set<number>();
  for (const cell of row) {
    if (typeof cell !== 'string') continue;
    const parsed = parseMonth(cell);
    if (parsed) seen.add(parsed.month);
  }
  return seen.size;
}

function hasCaption(captions: Set<string>, needle: string): boolean {
  for (const caption of captions) if (caption.includes(needle)) return true;
  return false;
}

function hasAny(captions: Set<string>, needles: string[]): boolean {
  return needles.some((needle) => hasCaption(captions, needle));
}
