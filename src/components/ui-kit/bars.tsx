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
 * takes one hue and needs no legend, and every bar is directly labelled. Square
 * ends, because a rounded cap adds length the figure does not have.
 */
export function MagnitudeBar({ value, max, label, amount, share, muted }: MagnitudeBarProps) {
  const width = max > 0 ? Math.max((value / max) * 100, value > 0 ? 0.6 : 0) : 0;

  return (
    <div className="grid grid-cols-[minmax(6rem,11rem)_1fr_5.5rem_3.5rem] items-center gap-4 border-b py-2 last:border-0">
      <span className="truncate text-sm" title={label}>
        {label}
      </span>
      <span className="h-1.5 w-full rounded-[1px] bg-rule" aria-hidden>
        <span
          className={cn('block h-full rounded-[1px]', muted ? 'bg-foreground/25' : 'bg-foreground')}
          style={{ width: `${width}%` }}
        />
      </span>
      <span className="num text-right text-sm">{amount}</span>
      <span className="num text-right text-xs text-muted-foreground">{share ?? ''}</span>
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
    return <span className="block h-1.5 w-full rounded-[1px] bg-rule" aria-hidden />;
  }

  const clamped = Math.max(-1, Math.min(1, margin));
  const width = Math.abs(clamped) * 50;
  const positive = clamped >= 0;

  return (
    <span className="relative block h-1.5 w-full rounded-[1px] bg-rule" aria-hidden>
      <span className="absolute inset-y-[-3px] left-1/2 w-px -translate-x-1/2 bg-rule-strong" />
      <span
        className={cn(
          'absolute top-0 h-full rounded-[1px]',
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
