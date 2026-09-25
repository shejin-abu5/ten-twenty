import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface StatCardProps {
  label: string;
  value: string;
  hint?: string;
  tone?: string;
  /** The subject of the figure, drawn hairline-light in the corner. One glyph
   *  per concept across the app, so hours always read as hours. */
  icon?: LucideIcon;
  /** False when the headline is a name rather than a figure, so it stays in the
   *  body face instead of the numeric one. */
  numeric?: boolean;
  footer?: ReactNode;
  /** Sweeps a light band across the figure, for the one headline worth it. */
  shimmer?: boolean;
}

export function StatCard({
  label,
  value,
  hint,
  tone,
  icon: Icon,
  numeric = true,
  footer,
  shimmer = false,
}: StatCardProps) {
  return (
    <div className="group flex flex-col px-5 py-4 transition-colors duration-200 hover:bg-muted/60">
      <div className="flex items-start justify-between gap-3">
        <p className="ledger-label">{label}</p>
        {Icon ? (
          /* Kept quiet at rest and only brought up under the pointer: the glyph
             is a marker for the figure, never a rival to it. A toned figure
             lends the icon its colour so profit and loss read at a glance. */
          <Icon
            aria-hidden
            strokeWidth={1.5}
            className={cn(
              '-mt-0.5 size-5 shrink-0 opacity-60 transition-opacity duration-200 group-hover:opacity-100',
              tone ?? 'text-muted-foreground',
            )}
          />
        ) : null}
      </div>
      <p
        className={cn(
          'mt-3 font-medium',
          numeric ? 'num text-[1.5rem] leading-none' : 'text-lg leading-snug tracking-tight',
          shimmer && 'num-shimmer',
          tone,
        )}
      >
        {value}
      </p>
      {hint ? (
        <p className="mt-2.5 text-xs leading-snug text-muted-foreground">{hint}</p>
      ) : null}
      {footer}
    </div>
  );
}

/**
 * One band of figures divided by hairlines rather than five separate cards.
 * The gap in the grid is the rule, so the gridlines are exact at any width.
 */
export function StatGrid({ children }: { children: ReactNode }) {
  return (
    <div className="hairline-grid animate-in fade-in slide-in-from-bottom-1 grid overflow-hidden rounded-lg border duration-500 sm:grid-cols-2 xl:grid-cols-5">
      {children}
    </div>
  );
}
