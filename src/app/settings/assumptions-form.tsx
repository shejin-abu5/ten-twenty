'use client';

import { useActionState } from 'react';
import { CheckCircle2, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Panel } from '@/components/ui-kit/panel';
import { formatHoursPlain } from '@/lib/format';
import { saveAssumptions, type AssumptionsFormState } from './actions';

interface CategoryOption {
  name: string;
  hours: number;
  selected: boolean;
}

interface AssumptionsFormProps {
  categories: CategoryOption[];
  monthlyOverhead: number;
  monthCount: number;
}

const INITIAL: AssumptionsFormState = { status: 'idle', message: '' };

export function AssumptionsForm({ categories, monthlyOverhead, monthCount }: AssumptionsFormProps) {
  const [state, action, pending] = useActionState(saveAssumptions, INITIAL);

  return (
    <form action={action} className="space-y-10">
      <Panel
        title="Billable categories"
        description="Ticked categories are charged to a project. Everything else is absorbed into the monthly indirect pool. The totals stay the same either way — only where the cost lands changes."
        bodyClassName="grid gap-x-8 gap-y-0.5 px-4 py-3 sm:grid-cols-2 lg:grid-cols-3"
      >
        {categories.map((category) => (
          <Label
            key={category.name}
            className="flex min-w-0 cursor-pointer items-center gap-3 rounded-md px-2 py-2 transition-colors duration-150 hover:bg-muted"
          >
            <Checkbox name="billable" value={category.name} defaultChecked={category.selected} />
            <span className="min-w-0 flex-1 truncate text-sm font-normal">{category.name}</span>
            <span className="num shrink-0 text-xs text-muted-foreground">
              {formatHoursPlain(category.hours)} h
            </span>
          </Label>
        ))}
      </Panel>

      <Panel
        title="Monthly overhead"
        description={`Rent, software, everything payroll does not cover. Added to the indirect pool of each of the ${monthCount} loaded month${monthCount === 1 ? '' : 's'}, so it reaches projects through the indirect rate.`}
        bodyClassName="flex flex-wrap items-end gap-5 px-5 py-5"
      >
        <div className="w-56">
          {/* A plain label: the shadcn one carries its own text size, which
              would fight the ledger caption. */}
          <label htmlFor="overhead" className="ledger-label block">
            AED per month
          </label>
          <Input
            id="overhead"
            name="overhead"
            type="number"
            min={0}
            step={100}
            inputMode="decimal"
            defaultValue={monthlyOverhead}
            className="num mt-2"
          />
        </div>
        <p className="max-w-sm pb-2 text-xs leading-relaxed text-muted-foreground">
          Set this to zero to run the reconciliation check in the brief: total cost should then
          equal total salaries exactly.
        </p>
      </Panel>

      <div className="flex items-center gap-3">
        <Button type="submit" disabled={pending} size="sm">
          {pending ? <Loader2 className="size-3.5 animate-spin" aria-hidden /> : null}
          Save assumptions
        </Button>
        {state.status === 'saved' ? (
          <span className="flex items-center gap-1.5 text-sm text-positive">
            <CheckCircle2 className="size-4" aria-hidden />
            {state.message}
          </span>
        ) : null}
        {state.status === 'error' ? (
          <span className="text-sm text-negative">{state.message}</span>
        ) : null}
      </div>
    </form>
  );
}
