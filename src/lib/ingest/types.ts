import type { Period } from '@/lib/domain/period';
import type { IngestIssue } from './errors';

export type DatasetKind = 'timesheet' | 'salaries' | 'projects';

export const DATASET_LABELS: Record<DatasetKind, string> = {
  timesheet: 'Timesheet',
  salaries: 'Salary overview',
  projects: 'Project prices',
};

export interface ParseResult<Row> {
  kind: DatasetKind;
  sheetName: string;
  /** 1-based, so it reads the same as the row number in Excel. */
  headerRow: number;
  rows: Row[];
  issues: IngestIssue[];
  /** Periods this file carries. Re-uploading replaces exactly these. */
  periods: Period[];
  /** Year used for rows whose month cell carried no year. */
  assumedYear: number | null;
  skippedRows: number;
}

export interface ParsedTimesheetRow {
  year: number;
  month: number;
  employeeNo: string;
  employeeName: string;
  expenseType: string | null;
  department: string | null;
  designation: string | null;
  category: string;
  refCode: string | null;
  taskName: string | null;
  company: string | null;
  description: string | null;
  hours: number;
}

export interface ParsedSalaryRow {
  employeeNo: string;
  employeeName: string;
  year: number;
  month: number;
  amount: number;
}

export interface ParsedProjectRow {
  refCode: string;
  name: string | null;
  price: number | null;
  salesYear: number | null;
  salesMonth: number | null;
  category: string | null;
  status: string | null;
}

export interface ParseOptions {
  /** Used when a month cell names no year, e.g. a bare "January". */
  fallbackYear?: number;
}

/** Derives a fallback year from a filename like "timesheet-2025.xlsx". */
export function yearFromFilename(filename: string): number | undefined {
  const match = filename.match(/(19|20)\d{2}/);
  if (!match) return undefined;
  const year = Number(match[0]);
  return year >= 1990 && year <= 2100 ? year : undefined;
}

/** Stable identity for a person when the sheet gives no employee number. */
export function employeeKeyFromName(name: string): string {
  return `name:${name.toLowerCase().replace(/[^a-z0-9]+/g, '')}`;
}
