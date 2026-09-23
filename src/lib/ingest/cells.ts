import { MONTH_NAMES } from '@/lib/domain/period';

export type RawCell = string | number | boolean | Date | null | undefined;
export type Grid = RawCell[][];

/** Everything the three sheets use to mean "nothing here". */
const BLANK_TOKENS = new Set(['', '-', '--', '–', '—', 'n/a', 'na', 'nil', 'null', '#n/a', '#value!']);

const MONTH_LOOKUP = MONTH_NAMES.map((name) => name.toLowerCase());

/** Excel's day zero. Day 1 is 1900-01-01, and the sheet's phantom 1900-02-29 sits at 60. */
const EXCEL_EPOCH_MS = Date.UTC(1899, 11, 30);
const MS_PER_DAY = 86_400_000;

export function cleanString(value: RawCell): string | null {
  if (value == null) return null;
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'number') return Number.isFinite(value) ? String(value) : null;
  if (typeof value === 'boolean') return String(value);

  const text = value.replace(/\s+/g, ' ').trim();
  return BLANK_TOKENS.has(text.toLowerCase()) ? null : text;
}

/**
 * Numbers arrive as numbers, as "1,250.00", as "AED 1,250", as "(500)" for a
 * negative, or as one of the blank tokens. Anything else is rejected rather
 * than coerced to zero, so a bad cell becomes a visible issue.
 */
export function parseNumber(value: RawCell): number | null {
  if (value == null || value === '') return null;
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value === 'boolean') return null;
  if (value instanceof Date) return null;

  const text = cleanString(value);
  if (text === null) return null;

  const negated = /^\(.*\)$/.test(text);
  const digits = text
    .replace(/^\(|\)$/g, '')
    .replace(/[^\d.,\-+]/g, '')
    .replace(/,/g, '');

  if (digits === '' || !/\d/.test(digits)) return null;

  const parsed = Number(digits);
  if (!Number.isFinite(parsed)) return null;
  return negated ? -Math.abs(parsed) : parsed;
}

export interface ParsedMonth {
  /** Null when the cell named a month but no year, e.g. a bare "January". */
  year: number | null;
  month: number;
}

/**
 * Reads the month formats the agency actually uses: "May '25", "January 2026",
 * a bare "January", a real date cell, "2025-05", "05/2025" and "Jan-25".
 */
export function parseMonth(value: RawCell): ParsedMonth | null {
  if (value == null) return null;

  if (value instanceof Date) {
    return { year: value.getUTCFullYear(), month: value.getUTCMonth() + 1 };
  }

  if (typeof value === 'number') {
    if (!Number.isFinite(value)) return null;
    if (Number.isInteger(value) && value >= 1 && value <= 12) return { year: null, month: value };
    if (value > 60) return fromExcelSerial(value);
    return null;
  }

  const text = cleanString(value);
  if (text === null) return null;

  const tokens = text
    .toLowerCase()
    .replace(/([a-z])(\d)/g, '$1 $2')
    .replace(/(\d)([a-z])/g, '$1 $2')
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
  if (tokens.length === 0) return null;

  let month: number | null = null;
  let year: number | null = null;
  const numbers: number[] = [];
  // A word that is not a month name means this is something else — "Q1" must
  // not become January, and "Total 12" must not become December.
  let hasUnknownWord = false;

  for (const token of tokens) {
    if (/^\d+$/.test(token)) {
      numbers.push(Number(token));
      continue;
    }
    const matched = matchMonthName(token);
    if (matched === null) hasUnknownWord = true;
    else if (month === null) month = matched;
  }

  for (const n of numbers) {
    if (n >= 1900 && n <= 2100) year = n;
  }

  if (month !== null) {
    if (year === null) {
      const short = numbers.find((n) => n >= 0 && n <= 99);
      if (short !== undefined) year = expandTwoDigitYear(short);
    }
    return { year, month };
  }

  // No month name: fall back to the all-numeric forms, "2025-05" and "05/2025".
  if (hasUnknownWord) return null;

  if (year !== null) {
    const candidate = numbers.find((n) => n !== year && n >= 1 && n <= 12);
    return candidate === undefined ? null : { year, month: candidate };
  }
  if (numbers.length === 1 && numbers[0] >= 1 && numbers[0] <= 12) {
    return { year: null, month: numbers[0] };
  }

  return null;
}

/** "sept" and "jan" resolve; "j" and "ju" are too ambiguous to guess. */
function matchMonthName(token: string): number | null {
  if (token.length < 3) return null;
  const index = MONTH_LOOKUP.findIndex((name) => name.startsWith(token) || token.startsWith(name));
  return index === -1 ? null : index + 1;
}

/** A two-digit year in this dataset means 20xx; nothing here predates 2000. */
function expandTwoDigitYear(value: number): number {
  return 2000 + value;
}

function fromExcelSerial(serial: number): ParsedMonth {
  const date = new Date(EXCEL_EPOCH_MS + Math.floor(serial) * MS_PER_DAY);
  return { year: date.getUTCFullYear(), month: date.getUTCMonth() + 1 };
}

/** Normalised form used to compare header captions against known aliases. */
export function normaliseHeader(value: RawCell): string {
  const text = cleanString(value);
  return text === null ? '' : text.toLowerCase().replace(/[^a-z0-9]+/g, '');
}
