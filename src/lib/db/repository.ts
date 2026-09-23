import { periodId } from '@/lib/domain/period';
import type { ProjectRecord, SalaryRecord, TimesheetEntry } from '@/lib/domain/types';
import type {
  AnyParseResult,
  DatasetKind,
  IngestIssue,
  ParsedProjectRow,
  ParsedSalaryRow,
  ParsedTimesheetRow,
} from '@/lib/ingest';
import { getDb } from './client';
import { bumpDataVersion } from './settings';
import { TABLES } from './schema';

export interface UploadRecord {
  id: number;
  kind: DatasetKind;
  filename: string;
  sheetName: string;
  headerRow: number;
  rowCount: number;
  skippedRows: number;
  periods: { year: number; month: number }[];
  issues: IngestIssue[];
  uploadedAt: string;
}

export interface SaveOutcome {
  uploadId: number;
  rowsWritten: number;
  /** Periods whose existing rows this upload replaced. */
  replacedPeriods: { year: number; month: number }[];
}

/**
 * Persists one parsed workbook.
 *
 * Re-upload rules, chosen so a corrected file is safe to drop in:
 *  - Timesheet: the months present in the file are deleted and rewritten. Months
 *    the file does not mention are untouched, so a single corrected month never
 *    takes the rest of the year with it.
 *  - Salaries: upserted per person per month. A blank cell was already dropped
 *    during parsing, so it leaves the stored figure alone.
 *  - Projects: upserted per ref code. Projects absent from the file survive.
 */
export function saveDataset(result: AnyParseResult, filename: string): SaveOutcome {
  const db = getDb();

  return db.transaction((): SaveOutcome => {
    const uploadId = insertUpload(result, filename);

    switch (result.kind) {
      case 'timesheet':
        return { uploadId, ...writeTimesheet(result.rows, result.periods, uploadId) };
      case 'salaries':
        return { uploadId, ...writeSalaries(result.rows, uploadId) };
      case 'projects':
        return { uploadId, ...writeProjects(result.rows, uploadId) };
    }
  })();
}

function insertUpload(result: AnyParseResult, filename: string): number {
  const info = getDb()
    .prepare(
      `INSERT INTO uploads
         (kind, filename, sheet_name, header_row, row_count, skipped_rows, periods, issues, uploaded_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      result.kind,
      filename,
      result.sheetName,
      result.headerRow,
      result.rows.length,
      result.skippedRows,
      JSON.stringify(result.periods),
      JSON.stringify(result.issues),
      new Date().toISOString(),
    );

  bumpDataVersion();
  return Number(info.lastInsertRowid);
}

function writeTimesheet(
  rows: ParsedTimesheetRow[],
  periods: { year: number; month: number }[],
  uploadId: number,
): Omit<SaveOutcome, 'uploadId'> {
  const db = getDb();
  const remove = db.prepare('DELETE FROM timesheet_entries WHERE year = ? AND month = ?');
  for (const period of periods) remove.run(period.year, period.month);

  const insert = db.prepare(
    `INSERT INTO timesheet_entries
       (year, month, employee_no, employee_name, expense_type, department, designation,
        category, ref_code, task_name, company, description, hours, upload_id)
     VALUES (@year, @month, @employeeNo, @employeeName, @expenseType, @department, @designation,
             @category, @refCode, @taskName, @company, @description, @hours, @uploadId)`,
  );

  for (const row of rows) insert.run({ ...row, uploadId });

  return { rowsWritten: rows.length, replacedPeriods: periods };
}

function writeSalaries(rows: ParsedSalaryRow[], uploadId: number): Omit<SaveOutcome, 'uploadId'> {
  const upsert = getDb().prepare(
    `INSERT INTO salaries (employee_no, employee_name, year, month, amount, upload_id)
     VALUES (@employeeNo, @employeeName, @year, @month, @amount, @uploadId)
     ON CONFLICT(employee_no, year, month) DO UPDATE SET
       employee_name = excluded.employee_name,
       amount        = excluded.amount,
       upload_id     = excluded.upload_id`,
  );

  for (const row of rows) upsert.run({ ...row, uploadId });

  const periods = new Set(rows.map((row) => periodId(row.year, row.month)));
  return {
    rowsWritten: rows.length,
    replacedPeriods: [...periods]
      .sort()
      .map((id) => ({ year: Math.floor(id / 100), month: id % 100 })),
  };
}

function writeProjects(rows: ParsedProjectRow[], uploadId: number): Omit<SaveOutcome, 'uploadId'> {
  const upsert = getDb().prepare(
    `INSERT INTO projects (ref_code, name, price, sales_year, sales_month, category, status, upload_id)
     VALUES (@refCode, @name, @price, @salesYear, @salesMonth, @category, @status, @uploadId)
     ON CONFLICT(ref_code) DO UPDATE SET
       name        = excluded.name,
       price       = excluded.price,
       sales_year  = excluded.sales_year,
       sales_month = excluded.sales_month,
       category    = excluded.category,
       status      = excluded.status,
       upload_id   = excluded.upload_id`,
  );

  for (const row of rows) upsert.run({ ...row, uploadId });

  return { rowsWritten: rows.length, replacedPeriods: [] };
}

export interface ModelInputs {
  entries: TimesheetEntry[];
  salaries: SalaryRecord[];
  projects: ProjectRecord[];
}

export function loadModelInputs(): ModelInputs {
  const db = getDb();

  const entries = (
    db
      .prepare(
        `SELECT id, year, month, employee_no, employee_name, expense_type, department,
                designation, category, ref_code, task_name, company, description, hours
         FROM timesheet_entries
         ORDER BY year, month, employee_name, category`,
      )
      .all() as TimesheetRow[]
  ).map(toEntry);

  const salaries = (
    db
      .prepare(
        `SELECT employee_no, employee_name, year, month, amount
         FROM salaries ORDER BY year, month, employee_name`,
      )
      .all() as SalaryRow[]
  ).map(toSalary);

  const projects = (
    db
      .prepare(
        `SELECT ref_code, name, price, sales_year, sales_month, category, status
         FROM projects ORDER BY ref_code`,
      )
      .all() as ProjectRow[]
  ).map(toProject);

  return reconcileEmployeeKeys({ entries, salaries, projects });
}

/**
 * A sheet without an employee-number column gets a name-derived key. If the
 * other sheet did carry numbers, the two must be stitched together or the
 * person appears twice: once with hours and no salary, once with the reverse.
 */
function reconcileEmployeeKeys(inputs: ModelInputs): ModelInputs {
  const numberByName = new Map<string, string>();

  for (const record of [...inputs.entries, ...inputs.salaries]) {
    if (record.employeeNo.startsWith('name:')) continue;
    numberByName.set(nameKey(record.employeeName), record.employeeNo);
  }
  if (numberByName.size === 0) return inputs;

  const resolve = <T extends { employeeNo: string; employeeName: string }>(record: T): T => {
    if (!record.employeeNo.startsWith('name:')) return record;
    const found = numberByName.get(nameKey(record.employeeName));
    return found ? { ...record, employeeNo: found } : record;
  };

  return {
    entries: inputs.entries.map(resolve),
    salaries: inputs.salaries.map(resolve),
    projects: inputs.projects,
  };
}

function nameKey(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '');
}

export function listUploads(limit = 50): UploadRecord[] {
  const rows = getDb()
    .prepare(
      `SELECT id, kind, filename, sheet_name, header_row, row_count, skipped_rows,
              periods, issues, uploaded_at
       FROM uploads ORDER BY id DESC LIMIT ?`,
    )
    .all(limit) as UploadRow[];

  return rows.map((row) => ({
    id: row.id,
    kind: row.kind as DatasetKind,
    filename: row.filename,
    sheetName: row.sheet_name,
    headerRow: row.header_row,
    rowCount: row.row_count,
    skippedRows: row.skipped_rows,
    periods: safeParse<{ year: number; month: number }[]>(row.periods, []),
    issues: safeParse<IngestIssue[]>(row.issues, []),
    uploadedAt: row.uploaded_at,
  }));
}

export function hasData(): boolean {
  const row = getDb().prepare('SELECT COUNT(*) AS count FROM timesheet_entries').get() as {
    count: number;
  };
  return row.count > 0;
}

export function clearAll(): void {
  const db = getDb();
  db.transaction(() => {
    for (const table of TABLES) db.exec(`DELETE FROM ${table}`);
    db.exec("DELETE FROM sqlite_sequence WHERE name IN ('timesheet_entries', 'uploads')");
    bumpDataVersion();
  })();
}

interface TimesheetRow {
  id: number;
  year: number;
  month: number;
  employee_no: string;
  employee_name: string;
  expense_type: string | null;
  department: string | null;
  designation: string | null;
  category: string;
  ref_code: string | null;
  task_name: string | null;
  company: string | null;
  description: string | null;
  hours: number;
}

interface SalaryRow {
  employee_no: string;
  employee_name: string;
  year: number;
  month: number;
  amount: number;
}

interface ProjectRow {
  ref_code: string;
  name: string | null;
  price: number | null;
  sales_year: number | null;
  sales_month: number | null;
  category: string | null;
  status: string | null;
}

interface UploadRow {
  id: number;
  kind: string;
  filename: string;
  sheet_name: string;
  header_row: number;
  row_count: number;
  skipped_rows: number;
  periods: string;
  issues: string;
  uploaded_at: string;
}

function toEntry(row: TimesheetRow): TimesheetEntry {
  return {
    id: row.id,
    year: row.year,
    month: row.month,
    employeeNo: row.employee_no,
    employeeName: row.employee_name,
    expenseType: row.expense_type,
    department: row.department,
    designation: row.designation,
    category: row.category,
    refCode: row.ref_code,
    taskName: row.task_name,
    company: row.company,
    description: row.description,
    hours: row.hours,
  };
}

function toSalary(row: SalaryRow): SalaryRecord {
  return {
    employeeNo: row.employee_no,
    employeeName: row.employee_name,
    year: row.year,
    month: row.month,
    amount: row.amount,
  };
}

function toProject(row: ProjectRow): ProjectRecord {
  return {
    refCode: row.ref_code,
    name: row.name,
    price: row.price,
    salesYear: row.sales_year,
    salesMonth: row.sales_month,
    category: row.category,
    status: row.status,
  };
}

function safeParse<T>(value: string, fallback: T): T {
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}
