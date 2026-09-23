'use client';

import { useActionState } from 'react';
import { CheckCircle2, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
    <form action={action} className="space-y-6">
      <section className="rounded-lg border bg-background">
        <div className="border-b px-4 py-3">
          <h2 className="text-sm font-semibold tracking-tight">Billable categories</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Ticked categories are charged to a project. Everything else is absorbed into the monthly
            indirect pool. The totals stay the same either way — only where the cost lands changes.
          </p>
        </div>
        <div className="grid gap-x-6 gap-y-1 px-4 py-3 sm:grid-cols-2 lg:grid-cols-3">
          {categories.map((category) => (
            <Label
              key={category.name}
              className="flex cursor-pointer items-center gap-2.5 rounded-md px-2 py-2 hover:bg-accent/50"
            >
              <Checkbox name="billable" value={category.name} defaultChecked={category.selected} />
              <span className="min-w-0 flex-1 truncate text-sm font-normal">{category.name}</span>
              <span className="num shrink-0 text-xs tabular-nums text-muted-foreground">
                {formatHoursPlain(category.hours)} h
              </span>
            </Label>
          ))}
        </div>
      </section>

      <section className="rounded-lg border bg-background">
        <div className="border-b px-4 py-3">
          <h2 className="text-sm font-semibold tracking-tight">Monthly overhead</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Rent, software, everything payroll does not cover. Added to the indirect pool of each of
            the {monthCount} loaded month{monthCount === 1 ? '' : 's'}, so it reaches projects
            through the indirect rate.
          </p>
        </div>
        <div className="flex flex-wrap items-end gap-4 px-4 py-4">
          <div className="w-56">
            <Label htmlFor="overhead" className="text-xs text-muted-foreground">
              AED per month
            </Label>
            <Input
              id="overhead"
              name="overhead"
              type="number"
              min={0}
              step={100}
              inputMode="decimal"
              defaultValue={monthlyOverhead}
              className="num mt-1.5 tabular-nums"
            />
          </div>
          <p className="pb-2 text-xs text-muted-foreground">
            Set this to zero to run the reconciliation check in the brief: total cost should then
            equal total salaries exactly.
          </p>
        </div>
      </section>

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
