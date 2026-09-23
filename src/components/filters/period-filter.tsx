'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useTransition } from 'react';
import { Loader2 } from 'lucide-react';
import { monthName } from '@/lib/domain/period';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

const ALL = 'all';

interface PeriodFilterProps {
  year: number | null;
  month: number | null;
  years: number[];
  months: number[];
  /** Search params to keep when the period changes, e.g. a department name. */
  preserve?: Record<string, string>;
}

/**
 * Period lives in the URL rather than in component state, so a filtered view is
 * a link: it survives a refresh, and it can be pasted into an email.
 */
export function PeriodFilter({ year, month, years, months, preserve }: PeriodFilterProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [pending, startTransition] = useTransition();

  const navigate = (next: { year?: string; month?: string }) => {
    const params = new URLSearchParams(preserve);
    const nextYear = next.year ?? (year === null ? ALL : String(year));
    // Changing year clears a month that the new year may not have.
    const nextMonth = next.month ?? (next.year ? ALL : month === null ? ALL : String(month));

    if (nextYear !== ALL) params.set('year', nextYear);
    if (nextMonth !== ALL) params.set('month', nextMonth);

    const query = params.toString();
    startTransition(() => router.push(query ? `${pathname}?${query}` : pathname));
  };

  return (
    <div className="flex items-center gap-2">
      {pending ? (
        <Loader2 className="size-3.5 animate-spin text-muted-foreground" aria-label="Loading" />
      ) : null}

      <Select value={year === null ? ALL : String(year)} onValueChange={(v) => navigate({ year: v })}>
        <SelectTrigger className="w-[130px]" aria-label="Year">
          <SelectValue placeholder="Year" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>All years</SelectItem>
          {years.map((option) => (
            <SelectItem key={option} value={String(option)}>
              {option}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        value={month === null ? ALL : String(month)}
        onValueChange={(v) => navigate({ month: v })}
        disabled={months.length === 0}
      >
        <SelectTrigger className="w-[150px]" aria-label="Month">
          <SelectValue placeholder="Month" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>Full year</SelectItem>
          {months.map((option) => (
            <SelectItem key={option} value={String(option)}>
              {monthName(option)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
