import type { Metadata } from 'next';
import { Instrument_Sans } from 'next/font/google';
import { AppShell } from '@/components/layout/app-shell';
import { ThemeProvider } from '@/components/layout/theme-provider';
import { Toaster } from '@/components/ui/sonner';
import './globals.css';

// One family throughout. Its tabular figures do the work a second, monospaced
// face would otherwise be brought in for.
const sans = Instrument_Sans({
  subsets: ['latin'],
  variable: '--font-instrument-sans',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Margin Dashboard',
  description: 'Project profitability, productivity and cost rates for the agency.',
};

// Every page reads the SQLite database at request time, so nothing here is
// prerenderable at build time.
export const dynamic = 'force-dynamic';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    // next-themes sets the class on <html> before hydration.
    <html lang="en" className={sans.variable} suppressHydrationWarning>
      <body className="font-sans antialiased">
        <ThemeProvider attribute="class" defaultTheme="dark" disableTransitionOnChange>
          <AppShell>{children}</AppShell>
          <Toaster position="top-center" />
        </ThemeProvider>
      </body>
    </html>
  );
}
