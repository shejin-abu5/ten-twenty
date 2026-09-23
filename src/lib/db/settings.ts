import type { Assumptions } from '@/lib/domain/types';
import { getDb } from './client';

/** The three categories the brief names as billable work charged to a project. */
export const DEFAULT_BILLABLE_CATEGORIES = ['Projects', 'Enhancements', 'Hosting'];
export const DEFAULT_MONTHLY_OVERHEAD = 0;

const KEY_BILLABLE = 'billable_categories';
const KEY_OVERHEAD = 'monthly_overhead';
const KEY_VERSION = 'data_version';

function read(key: string): string | null {
  const row = getDb().prepare('SELECT value FROM settings WHERE key = ?').get(key) as
    | { value: string }
    | undefined;
  return row?.value ?? null;
}

function write(key: string, value: string): void {
  getDb()
    .prepare(
      `INSERT INTO settings (key, value) VALUES (?, ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
    )
    .run(key, value);
}

export function readAssumptions(): Assumptions {
  const billable = read(KEY_BILLABLE);
  const overhead = read(KEY_OVERHEAD);

  return {
    billableCategories: parseCategories(billable) ?? DEFAULT_BILLABLE_CATEGORIES,
    monthlyOverhead: parseOverhead(overhead) ?? DEFAULT_MONTHLY_OVERHEAD,
  };
}

export function writeAssumptions(next: Partial<Assumptions>): void {
  const db = getDb();
  db.transaction(() => {
    if (next.billableCategories) {
      write(KEY_BILLABLE, JSON.stringify([...new Set(next.billableCategories)]));
    }
    if (next.monthlyOverhead !== undefined) {
      write(KEY_OVERHEAD, String(Math.max(0, next.monthlyOverhead)));
    }
    write(KEY_VERSION, String(readDataVersion() + 1));
  })();
}

/** Bumped by every write, so cached models can tell they are stale. */
export function readDataVersion(): number {
  return Number(read(KEY_VERSION) ?? 0) || 0;
}

export function bumpDataVersion(): void {
  write(KEY_VERSION, String(readDataVersion() + 1));
}

function parseCategories(value: string | null): string[] | null {
  if (!value) return null;
  try {
    const parsed: unknown = JSON.parse(value);
    if (!Array.isArray(parsed)) return null;
    return parsed.filter((item): item is string => typeof item === 'string');
  } catch {
    return null;
  }
}

function parseOverhead(value: string | null): number | null {
  if (value === null) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(0, parsed) : null;
}
