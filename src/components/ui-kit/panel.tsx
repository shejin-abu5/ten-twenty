import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface PanelHeadingProps {
  title?: string;
  description?: string;
  children?: ReactNode;
}

/** The caption block every panel and table shares, so none of them drift. */
export function PanelHeading({ title, description, children }: PanelHeadingProps) {
  if (!title && !description && !children) return null;

  return (
    <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-x-4 border-b px-5 py-4">
      <div className="min-w-0">
        {title ? <h2 className="text-[0.9375rem] font-medium tracking-tight">{title}</h2> : null}
        {description ? (
          <p className="mt-1.5 max-w-[52rem] text-xs leading-relaxed text-muted-foreground">
            {description}
          </p>
        ) : null}
      </div>
      {children ? <div className="flex shrink-0 items-center gap-2">{children}</div> : null}
    </div>
  );
}

interface PanelProps extends PanelHeadingProps {
  action?: ReactNode;
  className?: string;
  bodyClassName?: string;
}

/**
 * A hairline enclosure on the same paper as the page. Nothing is raised or
 * filled; the rule is the only thing marking where the section starts.
 */
export function Panel({
  title,
  description,
  action,
  className,
  bodyClassName,
  children,
}: PanelProps) {
  return (
    <section className={cn('min-w-0 rounded-lg border', className)}>
      <PanelHeading title={title} description={description}>
        {action}
      </PanelHeading>
      <div className={cn('px-5 py-4', bodyClassName)}>{children}</div>
    </section>
  );
}
