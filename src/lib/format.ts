const LOCALE = 'en-AE';

const money = new Intl.NumberFormat(LOCALE, {
  style: 'currency',
  currency: 'AED',
  maximumFractionDigits: 0,
});

const moneyExact = new Intl.NumberFormat(LOCALE, {
  style: 'currency',
  currency: 'AED',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

// Hours always carry one decimal so a column of them stays aligned on the point.
const decimal = new Intl.NumberFormat(LOCALE, {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});
const rate = new Intl.NumberFormat(LOCALE, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const integer = new Intl.NumberFormat(LOCALE, { maximumFractionDigits: 0 });

export function formatMoney(value: number | null | undefined): string {
  return value == null || !Number.isFinite(value) ? '—' : money.format(value);
}

/** Used where the brief asks the numbers to tie out to the dirham. */
export function formatMoneyExact(value: number | null | undefined): string {
  return value == null || !Number.isFinite(value) ? '—' : moneyExact.format(value);
}

export function formatRate(value: number | null | undefined): string {
  return value == null || !Number.isFinite(value) ? '—' : `${rate.format(value)}/h`;
}

export function formatHours(value: number | null | undefined): string {
  return value == null || !Number.isFinite(value) ? '—' : `${decimal.format(value)} h`;
}

export function formatHoursPlain(value: number | null | undefined): string {
  return value == null || !Number.isFinite(value) ? '—' : decimal.format(value);
}

export function formatCount(value: number | null | undefined): string {
  return value == null || !Number.isFinite(value) ? '—' : integer.format(value);
}

/** Takes a 0–1 ratio. Null renders as an em dash rather than a misleading 0%. */
export function formatPercent(value: number | null | undefined, digits = 1): string {
  if (value == null || !Number.isFinite(value)) return '—';
  return `${(value * 100).toFixed(digits)}%`;
}

export function formatSignedMoney(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return '—';
  return value > 0 ? `+${money.format(value)}` : money.format(value);
}

export function formatDateTime(iso: string): string {
  const date = new Date(iso);
  return Number.isNaN(date.getTime())
    ? iso
    : new Intl.DateTimeFormat(LOCALE, { dateStyle: 'medium', timeStyle: 'short' }).format(date);
}

/**
 * Only losses are coloured. Painting every healthy number green turns a table
 * into a traffic light and hides the two rows that actually need attention.
 */
export function toneOf(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return 'text-muted-foreground';
  return value < 0 ? 'text-negative' : 'text-foreground';
}

/** For headline figures, where both directions are worth signalling. */
export function emphaticToneOf(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return 'text-muted-foreground';
  if (value < 0) return 'text-negative';
  return 'text-positive';
}

/** Rounds a value for CSV export, where a raw float would read as noise. */
export function round(value: number, digits = 2): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

/** A 0–1 ratio as a rounded percentage for CSV export, or null. */
export function percentValue(ratio: number | null, digits = 1): number | null {
  return ratio === null ? null : round(ratio * 100, digits);
}
