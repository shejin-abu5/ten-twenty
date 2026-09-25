import type { DataGap, Reconciliation } from '@/lib/domain/types';
import { formatMoneyExact } from '@/lib/format';
import { cn } from '@/lib/utils';

type Status = 'ok' | 'caution' | 'alert';

/** A status is a mark in the margin, not a coloured box. */
function StatusMark({ status }: { status: Status }) {
  return (
    <span
      aria-hidden
      className={cn(
        'mt-[7px] size-1.5 shrink-0 rounded-full',
        status === 'ok' && 'bg-positive',
        status === 'caution' && 'bg-caution',
        status === 'alert' && 'bg-negative',
      )}
    />
  );
}

/**
 * The brief's self-check, on screen rather than buried in a test. If the model
 * ever stops balancing, whoever opens the dashboard sees it before they quote
 * a margin in a meeting.
 */
export function ReconciliationNote({ check }: { check: Reconciliation }) {
  const stranded = check.unabsorbedCost > 0;
  const status: Status = !check.balanced ? 'alert' : stranded ? 'caution' : 'ok';

  return (
    <div className="flex min-w-0 items-start gap-3 rounded-lg border px-5 py-4 text-sm">
      <StatusMark status={status} />
      <div className="min-w-0">
        <p className="font-medium">
          {!check.balanced
            ? `Costs are out by ${formatMoneyExact(check.difference)}`
            : stranded
              ? `${formatMoneyExact(check.unabsorbedCost)} of payroll reached no project`
              : 'Costs reconcile to payroll'}
        </p>
        <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
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
      <div className="flex min-w-0 items-start gap-3 rounded-lg border px-5 py-4 text-sm">
        <StatusMark status="ok" />
        <p>Every logged hour has a salary behind it and a priced project in front.</p>
      </div>
    );
  }

  return (
    <details className="group min-w-0 rounded-lg border open:pb-2">
      <summary className="flex cursor-pointer list-none items-start gap-3 px-5 py-4 text-sm">
        <StatusMark status="caution" />
        <span className="font-medium">
          {gaps.length} data gap{gaps.length === 1 ? '' : 's'} affect these numbers
        </span>
        <span className="ledger-label ml-auto pt-1 group-open:hidden">Show</span>
        <span className="ledger-label ml-auto hidden pt-1 group-open:inline">Hide</span>
      </summary>
      <ul className="border-t">
        {gaps.map((gap) => (
          <li
            key={`${gap.kind}-${gap.label}`}
            className="flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-1 border-b px-5 py-2.5 text-sm last:border-0"
          >
            <span className="ledger-label w-32 shrink-0">{KIND_LABELS[gap.kind]}</span>
            <span className="min-w-0 break-words font-medium">{gap.label}</span>
            <span className="text-xs text-muted-foreground">{gap.detail}</span>
          </li>
        ))}
      </ul>
    </details>
  );
}
