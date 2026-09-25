'use client';

import { useState, type ReactNode } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Nav } from './nav';
import { SIDEBAR_COOKIE } from './sidebar-cookie';
import { ThemeToggle } from './theme-toggle';
const ONE_YEAR = 60 * 60 * 24 * 365;

/**
 * The desktop sidebar folds down to an icon rail. The choice lives in a cookie
 * so the server renders the shell the way it was left, with no flash on load.
 */
export function Sidebar({
  masthead,
  defaultCollapsed,
}: {
  masthead: ReactNode;
  defaultCollapsed: boolean;
}) {
  const [collapsed, setCollapsed] = useState(defaultCollapsed);
  const ToggleIcon = collapsed ? ChevronRight : ChevronLeft;

  function toggle() {
    const next = !collapsed;
    setCollapsed(next);
    document.cookie = `${SIDEBAR_COOKIE}=${next ? '1' : '0'}; path=/; max-age=${ONE_YEAR}; samesite=lax`;
  }

  return (
    // The wrapper carries the width so the toggle can straddle the border without
    // being clipped by the aside's overflow.
    <div
      className={cn(
        'sticky top-0 z-20 hidden h-screen shrink-0 transition-[width] duration-200 ease-out lg:block',
        collapsed ? 'w-14' : 'w-56',
      )}
    >
      {/* Padding and layout are identical in both states; only the width changes and
          overflow clips the text, so nothing reflows while the width animates. */}
      <aside className="flex h-full flex-col gap-9 overflow-hidden border-r px-5 py-7">
        <div
          className={cn(
            'shrink-0 whitespace-nowrap transition-[opacity,visibility] duration-150',
            collapsed && 'invisible opacity-0',
          )}
        >
          {masthead}
        </div>
        <Nav collapsed={collapsed} />
      </aside>

      {/* Bottom-right of the panel; on the icon rail that lands it dead centre. */}
      <ThemeToggle
        className={cn(
          'absolute bottom-6 transition-[right] duration-200 ease-out',
          collapsed ? 'right-2.5' : 'right-5',
        )}
      />

      <button
        type="button"
        onClick={toggle}
        aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        aria-expanded={!collapsed}
        title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        className="absolute right-0 top-8 flex size-6 translate-x-1/2 items-center justify-center rounded-full border bg-paper text-muted-foreground shadow-sm transition-colors duration-150 hover:bg-muted hover:text-foreground"
      >
        <ToggleIcon className="size-3.5" aria-hidden />
      </button>
    </div>
  );
}
