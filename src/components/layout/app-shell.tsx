import Link from 'next/link';
import { cookies } from 'next/headers';
import type { ReactNode } from 'react';
import { NavBar } from './nav';
import { Sidebar } from './sidebar';
import { SIDEBAR_COOKIE } from './sidebar-cookie';
import { ThemeToggle } from './theme-toggle';

/**
 * Sidebar and page share one paper tone. The only thing between them is a
 * hairline, which is what keeps the shell from reading as a set of panels.
 */
export async function AppShell({ children }: { children: ReactNode }) {
  const collapsed = (await cookies()).get(SIDEBAR_COOKIE)?.value === '1';

  return (
    <div className="flex min-h-screen bg-paper">
      <Sidebar masthead={<Masthead />} defaultCollapsed={collapsed} />

      <div className="flex min-w-0 flex-1 flex-col">
        <div className="border-b lg:hidden">
          <div className="flex items-start justify-between gap-4 px-5 pb-4 pt-5">
            <Masthead />
            <ThemeToggle />
          </div>
          <NavBar />
        </div>
        <main className="mx-auto w-full min-w-0 max-w-[1360px] flex-1 px-5 py-8 sm:px-8 lg:px-12 lg:py-12">
          {children}
        </main>
      </div>
    </div>
  );
}

function Masthead() {
  return (
    <Link href="/" className="block rounded-sm outline-offset-4">
      <span className="block text-[1.0625rem] font-semibold leading-none tracking-[-0.02em]">
        Margin Dashboard
      </span>
      <span className="ledger-label mt-2 block">Agency profitability</span>
    </Link>
  );
}
