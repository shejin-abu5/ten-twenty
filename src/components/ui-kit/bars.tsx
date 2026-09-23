import { cn } from '@/lib/utils';

interface MagnitudeBarProps {
  value: number;
  max: number;
  label: string;
  /** Written at the end of the bar, so the figure is never read off the axis. */
  amount: string;
  share?: string;
  /** Recedes the bar for rows that are internal rather than billable time. */
  muted?: boolean;
}

/**
 * One row of a horizontal bar chart. A single measure on a single scale, so it
 * takes one hue and needs no legend, and every bar is directly labelled.
 */
export function MagnitudeBar({ value, max, label, amount, share, muted }: MagnitudeBarProps) {
  const width = max > 0 ? Math.max((value / max) * 100, value > 0 ? 0.6 : 0) : 0;

  return (
    <div className="grid grid-cols-[minmax(6rem,10rem)_1fr_5.5rem_3.5rem] items-center gap-3 py-[3px]">
      <span className="truncate text-sm" title={label}>
        {label}
      </span>
      <span className="h-2 w-full rounded-full bg-muted" aria-hidden>
        <span
          className={cn('block h-full rounded-full', muted ? 'bg-foreground/25' : 'bg-foreground/80')}
          style={{ width: `${width}%` }}
        />
      </span>
      <span className="num text-right text-sm tabular-nums">{amount}</span>
      <span className="num text-right text-xs tabular-nums text-muted-foreground">{share ?? ''}</span>
    </div>
  );
}

interface MarginBarProps {
  /** A 0–1 ratio. Null renders as an empty track rather than a zero-width bar. */
  margin: number | null;
}

/**
 * Margin as a diverging bar around a zero midpoint: profit grows right, a loss
 * grows left. Clamped to ±100% so one catastrophic project cannot flatten the
 * rest of the column.
 */
export function MarginBar({ margin }: MarginBarProps) {
  if (margin === null) {
    return <span className="block h-2 w-full rounded-full bg-muted" aria-hidden />;
  }

  const clamped = Math.max(-1, Math.min(1, margin));
  const width = Math.abs(clamped) * 50;
  const positive = clamped >= 0;

  return (
    <span className="relative block h-2 w-full rounded-full bg-muted" aria-hidden>
      <span className="absolute inset-y-[-2px] left-1/2 w-px -translate-x-1/2 bg-border" />
      <span
        className={cn(
          'absolute top-0 h-full rounded-full',
          positive ? 'bg-positive' : 'bg-negative',
        )}
        style={
          positive
            ? { left: '50%', width: `${width}%`, marginLeft: '1px' }
            : { right: '50%', width: `${width}%`, marginRight: '1px' }
        }
      />
    </span>
  );
}
