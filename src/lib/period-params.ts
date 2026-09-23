import type { PeriodFilter } from './domain/period';

/** Next 16 hands route search params in as a promise. */
export type SearchParams = Record<string, string | string[] | undefined>;

const ALL = 'all';

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

/**
 * Resolves the period a page should show.
 *
 * With no parameters the dashboard opens on the most recent year that has data,
 * because an empty screen asking to be configured is not an answer to "did we
 * make money".
 */
export function resolvePeriod(params: SearchParams, years: number[]): PeriodFilter {
  const yearParam = first(params.year);
  const monthParam = first(params.month);

  let year: number | null;
  if (yearParam === ALL) year = null;
  else if (yearParam !== undefined && Number.isFinite(Number(yearParam))) year = Number(yearParam);
  else year = (years[0] ?? null);

  let month: number | null = null;
  if (monthParam !== undefined && monthParam !== ALL) {
    const parsed = Number(monthParam);
    if (Number.isInteger(parsed) && parsed >= 1 && parsed <= 12) month = parsed;
  }

  return { year, month };
}

/** Rebuilds the query string for a link that should keep the current period. */
export function periodQuery(filter: PeriodFilter, extra?: Record<string, string>): string {
  const params = new URLSearchParams(extra);
  if (filter.year !== null) params.set('year', String(filter.year));
  else params.set('year', ALL);
  if (filter.month !== null) params.set('month', String(filter.month));

  const query = params.toString();
  return query ? `?${query}` : '';
}
