export const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
] as const;

export const MONTH_ABBR = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
] as const;

/** Year + 1-indexed month. */
export type Period = { year: number; month: number };

/** Sortable scalar for a period, e.g. 2025-07 -> 202507. Used as a Map key. */
export type PeriodId = number;

export function periodId(year: number, month: number): PeriodId {
  return year * 100 + month;
}

export function fromPeriodId(id: PeriodId): Period {
  return { year: Math.floor(id / 100), month: id % 100 };
}

export function monthName(month: number): string {
  return MONTH_NAMES[month - 1] ?? `Month ${month}`;
}

export function monthAbbr(month: number): string {
  return MONTH_ABBR[month - 1] ?? `M${month}`;
}

export function periodLabel(year: number, month: number): string {
  return `${monthName(month)} ${year}`;
}

export function shortPeriodLabel(year: number, month: number): string {
  return `${monthAbbr(month)} ${String(year).slice(2)}`;
}

/**
 * The period a page is looking at. A null month means "the whole year";
 * a null year means "everything loaded".
 */
export type PeriodFilter = { year: number | null; month: number | null };

export const ALL_PERIODS: PeriodFilter = { year: null, month: null };

export function matchesFilter(filter: PeriodFilter, year: number, month: number): boolean {
  if (filter.year !== null && filter.year !== year) return false;
  if (filter.month !== null && filter.month !== month) return false;
  return true;
}

export function describeFilter(filter: PeriodFilter): string {
  if (filter.year === null) return 'All loaded periods';
  if (filter.month === null) return String(filter.year);
  return periodLabel(filter.year, filter.month);
}
