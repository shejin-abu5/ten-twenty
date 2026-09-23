import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import Database from 'better-sqlite3';
import { migrate } from './schema';

/** Kept inside the repo so a clean checkout has somewhere to write with no setup. */
const DEFAULT_DATABASE_PATH = join(process.cwd(), 'data', 'margin.db');

export const DATABASE_PATH = process.env.MARGIN_DB_PATH || DEFAULT_DATABASE_PATH;

// Next.js replaces modules on every hot reload; a module-level variable would
// leak a new SQLite handle each time, so the connection hangs off globalThis.
const globalForDb = globalThis as typeof globalThis & {
  __marginDb?: Database.Database;
};

export function getDb(): Database.Database {
  if (globalForDb.__marginDb) return globalForDb.__marginDb;

  mkdirSync(dirname(DATABASE_PATH), { recursive: true });
  const db = new Database(DATABASE_PATH);
  migrate(db);

  globalForDb.__marginDb = db;
  return db;
}

export function closeDb(): void {
  globalForDb.__marginDb?.close();
  globalForDb.__marginDb = undefined;
}
