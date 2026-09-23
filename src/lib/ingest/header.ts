import { normaliseHeader, type Grid, type RawCell } from './cells';
import { IngestError } from './errors';

export interface ColumnSpec<Field extends string> {
  field: Field;
  /** Captions this column is known by, most canonical first. Compared normalised. */
  aliases: string[];
  required?: boolean;
}

export interface HeaderMatch<Field extends string> {
  /** 0-based index into the grid. */
  rowIndex: number;
  columns: Map<Field, number>;
  unmatched: Field[];
}

const SEARCH_DEPTH = 20;
const EXACT = 100;
const PREFIX = 60;
const CONTAINS = 35;

/**
 * Finds the header row and maps each known field to a column index.
 *
 * Sheets in the wild put a title in row 1, a blank row under it, or extra
 * columns nobody documented. Rather than trusting a fixed row, every row in the
 * first {@link SEARCH_DEPTH} is scored on how well its cells match the expected
 * captions, and the best-scoring row wins.
 */
export function locateHeader<Field extends string>(
  grid: Grid,
  specs: ColumnSpec<Field>[],
  options: { sheetName?: string; extraScore?: (row: RawCell[]) => number } = {},
): HeaderMatch<Field> {
  let best: (HeaderMatch<Field> & { score: number }) | null = null;

  const depth = Math.min(grid.length, SEARCH_DEPTH);
  for (let rowIndex = 0; rowIndex < depth; rowIndex++) {
    const row = grid[rowIndex] ?? [];
    const assignment = assignColumns(row, specs);
    const score = assignment.score + (options.extraScore?.(row) ?? 0);
    if (best === null || score > best.score) {
      best = {
        score,
        rowIndex,
        columns: assignment.columns,
        unmatched: specs.filter((s) => !assignment.columns.has(s.field)).map((s) => s.field),
      };
    }
  }

  const required = specs.filter((s) => s.required).map((s) => s.field);
  const missing = required.filter((field) => !best?.columns.has(field));

  if (best === null || missing.length > 0) {
    const where = options.sheetName ? ` in sheet "${options.sheetName}"` : '';
    throw new IngestError(
      `Could not find the expected header row${where}.`,
      `Missing column${missing.length === 1 ? '' : 's'}: ${missing.join(', ')}. Checked the first ${depth} row(s). Is this the right file?`,
    );
  }

  return { rowIndex: best.rowIndex, columns: best.columns, unmatched: best.unmatched };
}

/**
 * Greedy best-match assignment: every (column, field) pair is scored, then the
 * strongest pairs are taken first so an exact "Employee Name" beats a loose
 * "contains name" hit on a different column.
 */
function assignColumns<Field extends string>(
  row: RawCell[],
  specs: ColumnSpec<Field>[],
): { columns: Map<Field, number>; score: number } {
  const candidates: { field: Field; column: number; score: number }[] = [];

  row.forEach((cell, column) => {
    const caption = normaliseHeader(cell);
    if (caption === '') return;
    for (const spec of specs) {
      const score = scoreCaption(caption, spec.aliases);
      if (score > 0) candidates.push({ field: spec.field, column, score });
    }
  });

  candidates.sort((a, b) => b.score - a.score || a.column - b.column);

  const columns = new Map<Field, number>();
  const takenColumns = new Set<number>();
  let total = 0;

  for (const candidate of candidates) {
    if (columns.has(candidate.field) || takenColumns.has(candidate.column)) continue;
    columns.set(candidate.field, candidate.column);
    takenColumns.add(candidate.column);
    total += candidate.score;
  }

  return { columns, score: total };
}

function scoreCaption(caption: string, aliases: string[]): number {
  let best = 0;
  aliases.forEach((alias, position) => {
    const normalised = normaliseHeader(alias);
    if (normalised === '') return;
    // Earlier aliases are the canonical spelling, so they break ties.
    const preference = Math.max(0, aliases.length - position);
    let score = 0;
    if (caption === normalised) score = EXACT;
    else if (caption.startsWith(normalised)) score = PREFIX;
    else if (caption.includes(normalised)) score = CONTAINS;
    if (score > 0) best = Math.max(best, score + preference);
  });
  return best;
}
