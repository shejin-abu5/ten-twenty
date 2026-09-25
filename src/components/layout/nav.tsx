'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  BarChart3,
  Building2,
  FolderKanban,
  Gauge,
  LayoutDashboard,
  Settings,
  Upload,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const SECTIONS = [
  {
    label: 'Overview',
    items: [
      { href: '/', label: 'Dashboard', icon: LayoutDashboard },
      { href: '/projects', label: 'Projects', icon: FolderKanban },
    ],
  },
  {
    label: 'People and time',
    items: [
      { href: '/productivity', label: 'Productivity', icon: Gauge },
      { href: '/categories', label: 'Categories', icon: BarChart3 },
      { href: '/departments', label: 'Departments', icon: Building2 },
    ],
  },
  {
    label: 'Working',
    items: [
      { href: '/upload', label: 'Data', icon: Upload },
      { href: '/settings', label: 'Assumptions', icon: Settings },
    ],
  },
];

const ITEMS = SECTIONS.flatMap((section) => section.items);

function useIsActive() {
  const pathname = usePathname();
  return (href: string) => (href === '/' ? pathname === '/' : pathname.startsWith(href));
}

/**
 * The current page is marked the way a ledger marks a line: a rule in the
 * margin, not a filled pill. The icon takes the ink only when the row is live.
 */
export function Nav() {
  const isActive = useIsActive();

  return (
    <nav className="flex flex-col gap-7" aria-label="Main">
      {SECTIONS.map((section) => (
        <div key={section.label} className="flex flex-col">
          <p className="ledger-label mb-2.5">{section.label}</p>
          {section.items.map((item) => {
            const active = isActive(item.href);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  '-ml-5 flex items-center gap-2.5 border-l-2 py-1.5 pl-[18px] text-[0.9375rem] transition-colors duration-150',
                  active
                    ? 'border-foreground font-medium text-foreground'
                    : 'border-transparent text-muted-foreground hover:text-foreground',
                )}
              >
                <Icon
                  className={cn('size-4 shrink-0', active ? 'opacity-100' : 'opacity-70')}
                  aria-hidden
                />
                {item.label}
              </Link>
            );
          })}
        </div>
      ))}
    </nav>
  );
}

/**
 * Below the sidebar breakpoint the sections would cost half a screen before the
 * first figure, so the links wrap onto as many rows as they need. Every
 * destination stays on screen: nothing is hidden behind a sideways scroll.
 */
export function NavBar() {
  const isActive = useIsActive();

  return (
    <nav className="flex flex-wrap gap-x-4 gap-y-1 px-5 pb-3" aria-label="Main">
      {ITEMS.map((item) => {
        const active = isActive(item.href);
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? 'page' : undefined}
            className={cn(
              'flex min-w-0 items-center gap-1.5 rounded-md px-1.5 py-1 text-sm transition-colors duration-150',
              active
                ? 'bg-muted font-medium text-foreground'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            <Icon className="size-4 shrink-0" aria-hidden />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
