import Link from 'next/link';
import type { ReactNode } from 'react';
import { Button } from '@/components/ui/button';

interface EmptyStateProps {
  title: string;
  description: string;
  action?: { href: string; label: string };
  children?: ReactNode;
}

export function EmptyState({ title, description, action, children }: EmptyStateProps) {
  return (
    <div className="rounded-lg border border-dashed px-6 py-20 text-center">
      <h2 className="text-base font-semibold tracking-tight">{title}</h2>
      <p className="mx-auto mt-3 max-w-sm text-sm leading-relaxed text-muted-foreground">
        {description}
      </p>
      {action ? (
        <Button asChild size="sm" className="mt-6">
          <Link href={action.href}>{action.label}</Link>
        </Button>
      ) : null}
      {children}
    </div>
  );
}

/** Shown on every page when the database is empty, so no page is a dead end. */
export function NoDataState() {
  return (
    <EmptyState
      title="Nothing loaded yet"
      description="Upload the timesheet, the salary overview and the project prices, or load the sample year with one click."
      action={{ href: '/upload', label: 'Go to data' }}
    />
  );
}

/** The same shape for a period that simply has no rows in it. */
export function PeriodEmpty({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-lg border border-dashed px-6 py-20 text-center text-sm text-muted-foreground">
      {children}
    </div>
  );
}
