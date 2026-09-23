import Link from 'next/link';
import type { ReactNode } from 'react';
import { Nav } from './nav';

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen bg-surface">
      <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col gap-8 border-r bg-background px-4 py-6 lg:flex">
        <Link href="/" className="px-3">
          <span className="block text-sm font-semibold tracking-tight">Margin Dashboard</span>
          <span className="block text-xs text-muted-foreground">Agency profitability</span>
        </Link>
        <Nav />
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <div className="border-b bg-background px-4 py-3 lg:hidden">
          <Link href="/" className="text-sm font-semibold tracking-tight">
            Margin Dashboard
          </Link>
          <div className="mt-3">
            <Nav />
          </div>
        </div>
        <main className="mx-auto w-full max-w-[1400px] flex-1 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
          {children}
        </main>
      </div>
    </div>
  );
}
