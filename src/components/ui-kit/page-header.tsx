import type { ReactNode } from 'react';

interface PageHeaderProps {
  title: string;
  description?: string;
  /** The period this page is reporting on. Set as a figure, because it is one. */
  eyebrow?: string;
  actions?: ReactNode;
}

export function PageHeader({ title, description, eyebrow, actions }: PageHeaderProps) {
  return (
    <header className="mb-9 border-b pb-7">
      <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          {eyebrow ? (
            <p className="num mb-2.5 truncate text-xs text-muted-foreground">{eyebrow}</p>
          ) : null}
          <h1 className="truncate text-[1.75rem] font-semibold leading-[1.15] tracking-[-0.025em]">
            {title}
          </h1>
        </div>
        {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
      </div>
      {description ? (
        <p className="mt-4 max-w-[46rem] text-sm leading-relaxed text-muted-foreground">
          {description}
        </p>
      ) : null}
    </header>
  );
}
