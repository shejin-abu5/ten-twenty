import type BetterSqlite3 from 'better-sqlite3';

/**
 * The schema is created in full on every open. Each statement is idempotent, so
 * a fresh checkout and an existing database follow the same path.
 */
const STATEMENTS = [
  `CREATE TABLE IF NOT EXISTS uploads (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    kind         TEXT    NOT NULL,
    filename     TEXT    NOT NULL,
    sheet_name   TEXT    NOT NULL,
    header_row   INTEGER NOT NULL,
    row_count    INTEGER NOT NULL,
    skipped_rows INTEGER NOT NULL DEFAULT 0,
    periods      TEXT    NOT NULL DEFAULT '[]',
    issues       TEXT    NOT NULL DEFAULT '[]',
    uploaded_at  TEXT    NOT NULL
  )`,

  `CREATE TABLE IF NOT EXISTS timesheet_entries (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    year          INTEGER NOT NULL,
    month         INTEGER NOT NULL,
    employee_no   TEXT    NOT NULL,
    employee_name TEXT    NOT NULL,
    expense_type  TEXT,
    department    TEXT,
    designation   TEXT,
    category      TEXT    NOT NULL,
    ref_code      TEXT,
    task_name     TEXT,
    company       TEXT,
    description   TEXT,
    hours         REAL    NOT NULL,
    upload_id     INTEGER REFERENCES uploads(id) ON DELETE SET NULL
  )`,
  `CREATE INDEX IF NOT EXISTS idx_entries_period ON timesheet_entries (year, month)`,
  `CREATE INDEX IF NOT EXISTS idx_entries_ref ON timesheet_entries (ref_code)`,
  `CREATE INDEX IF NOT EXISTS idx_entries_employee ON timesheet_entries (employee_no)`,

  // Keyed by person and month so a re-upload corrects a cell instead of
  // appending a second salary for the same month.
  `CREATE TABLE IF NOT EXISTS salaries (
    employee_no   TEXT    NOT NULL,
    employee_name TEXT    NOT NULL,
    year          INTEGER NOT NULL,
    month         INTEGER NOT NULL,
    amount        REAL    NOT NULL,
    upload_id     INTEGER REFERENCES uploads(id) ON DELETE SET NULL,
    PRIMARY KEY (employee_no, year, month)
  )`,

  `CREATE TABLE IF NOT EXISTS projects (
    ref_code    TEXT PRIMARY KEY,
    name        TEXT,
    price       REAL,
    sales_year  INTEGER,
    sales_month INTEGER,
    category    TEXT,
    status      TEXT,
    upload_id   INTEGER REFERENCES uploads(id) ON DELETE SET NULL
  )`,

  `CREATE TABLE IF NOT EXISTS settings (
    key   TEXT PRIMARY KEY,
    value TEXT NOT NULL
  )`,
];

export function migrate(db: BetterSqlite3.Database): void {
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  db.transaction(() => {
    for (const statement of STATEMENTS) db.exec(statement);
  })();
}

export const TABLES = ['timesheet_entries', 'salaries', 'projects', 'uploads'] as const;
