import Link from 'next/link';
import type { ReactNode } from 'react';
import { Nav, NavBar } from './nav';

/**
 * Sidebar and page share one paper tone. The only thing between them is a
 * hairline, which is what keeps the shell from reading as a set of panels.
 */
export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen bg-paper">
      <aside className="sticky top-0 hidden h-screen w-56 shrink-0 flex-col gap-9 border-r px-5 py-7 lg:flex">
        <Masthead />
        <Nav />
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <div className="border-b lg:hidden">
          <div className="px-5 pb-4 pt-5">
            <Masthead />
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
