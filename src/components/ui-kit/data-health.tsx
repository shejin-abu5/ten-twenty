import { AlertTriangle, CheckCircle2 } from 'lucide-react';
import type { DataGap, Reconciliation } from '@/lib/domain/types';
import { formatMoneyExact } from '@/lib/format';
import { cn } from '@/lib/utils';

/**
 * The brief's self-check, on screen rather than buried in a test. If the model
 * ever stops balancing, whoever opens the dashboard sees it before they quote
 * a margin in a meeting.
 */
export function ReconciliationNote({ check }: { check: Reconciliation }) {
  const stranded = check.unabsorbedCost > 0;
  const Icon = check.balanced && !stranded ? CheckCircle2 : AlertTriangle;

  return (
    <div
      className={cn(
        'flex flex-wrap items-start gap-2.5 rounded-lg border px-4 py-3 text-sm',
        !check.balanced && 'border-negative/40 bg-negative/5',
        check.balanced && stranded && 'border-amber-500/40 bg-amber-500/5',
        check.balanced && !stranded && 'bg-background',
      )}
    >
      <Icon
        className={cn(
          'mt-0.5 size-4 shrink-0',
          !check.balanced && 'text-negative',
          check.balanced && stranded && 'text-amber-600',
          check.balanced && !stranded && 'text-positive',
        )}
        aria-hidden
      />
      <div className="min-w-0">
        <p className="font-medium">
          {!check.balanced
            ? `Costs are out by ${formatMoneyExact(check.difference)}`
            : stranded
              ? `${formatMoneyExact(check.unabsorbedCost)} of payroll reached no project`
              : 'Costs reconcile to payroll'}
        </p>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Across all loaded data: {formatMoneyExact(check.totalSalaries)} of salaries
          {check.totalOverhead > 0
            ? ` plus ${formatMoneyExact(check.totalOverhead)} of overhead`
            : ''}
          , {formatMoneyExact(check.allocatedCost)} of it charged to billable work
          {stranded
            ? `, and ${formatMoneyExact(check.unabsorbedCost)} in months that had cost but no billable hours`
            : ''}
          .
        </p>
      </div>
    </div>
  );
}

const KIND_LABELS: Record<DataGap['kind'], string> = {
  'missing-salary': 'Missing salary',
  'missing-price': 'Missing price',
  'unknown-ref-code': 'Unknown ref code',
  'billable-without-ref': 'Unattributed hours',
  'price-without-hours': 'No hours logged',
  'unabsorbed-pool': 'Unabsorbed cost',
};

export function GapsPanel({ gaps }: { gaps: DataGap[] }) {
  if (gaps.length === 0) {
    return (
      <div className="flex items-center gap-2.5 rounded-lg border bg-background px-4 py-3 text-sm">
        <CheckCircle2 className="size-4 shrink-0 text-positive" aria-hidden />
        <p>No gaps found. Every logged hour has a salary behind it and a priced project in front.</p>
      </div>
    );
  }

  return (
    <details className="group rounded-lg border border-amber-500/40 bg-amber-500/5 open:pb-1">
      <summary className="flex cursor-pointer list-none items-center gap-2.5 px-4 py-3 text-sm">
        <AlertTriangle className="size-4 shrink-0 text-amber-600" aria-hidden />
        <span className="font-medium">
          {gaps.length} data gap{gaps.length === 1 ? '' : 's'} affect these numbers
        </span>
        <span className="ml-auto text-xs text-muted-foreground group-open:hidden">Show</span>
        <span className="ml-auto hidden text-xs text-muted-foreground group-open:inline">Hide</span>
      </summary>
      <ul className="space-y-1.5 px-4 pb-3 pt-1">
        {gaps.map((gap) => (
          <li key={`${gap.kind}-${gap.label}`} className="flex flex-wrap gap-x-2 text-sm">
            <span className="shrink-0 rounded bg-background px-1.5 py-0.5 text-[11px] font-medium text-muted-foreground">
              {KIND_LABELS[gap.kind]}
            </span>
            <span className="font-medium">{gap.label}</span>
            <span className="text-muted-foreground">{gap.detail}</span>
          </li>
        ))}
      </ul>
    </details>
  );
}
