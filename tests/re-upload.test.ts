import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Grid } from '@/lib/ingest/cells';
import { parseSalaries } from '@/lib/ingest/salaries';
import { parseTimesheet } from '@/lib/ingest/timesheet';
import type { AnyParseResult } from '@/lib/ingest';

// The database path is read when the client module first loads, so it has to be
// pointed at a throwaway file before anything imports it.
const directory = mkdtempSync(join(tmpdir(), 'margin-test-'));
process.env.MARGIN_DB_PATH = join(directory, 'test.db');

type Repository = typeof import('@/lib/db/repository');
let repo: Repository;
let closeDb: () => void;

function timesheetGrid(rows: (string | number)[][]): Grid {
  return [['Month', 'Employee No.', 'Employee Name', 'Category', 'Ref Code', 'Hours'], ...rows];
}

const JANUARY = timesheetGrid([
  ['January 2025', '1', 'Ayesha', 'Projects', 'P1', 100],
  ['January 2025', '2', 'Rohit', 'Projects', 'P1', 80],
]);

const FEBRUARY = timesheetGrid([['February 2025', '1', 'Ayesha', 'Projects', 'P1', 90]]);

const JANUARY_CORRECTED = timesheetGrid([
  ['January 2025', '1', 'Ayesha', 'Projects', 'P1', 120],
  ['January 2025', '2', 'Rohit', 'Projects', 'P1', 80],
]);

const save = (grid: Grid, filename: string) => {
  const parsed = { ...parseTimesheet(grid, 'Timesheet'), kind: 'timesheet' } as AnyParseResult;
  return repo.saveDataset(parsed, filename);
};

beforeAll(async () => {
  repo = await import('@/lib/db/repository');
  ({ closeDb } = await import('@/lib/db/client'));
});

afterAll(() => {
  closeDb?.();
  rmSync(directory, { recursive: true, force: true });
});

describe('re-uploading a timesheet', () => {
  it('replaces only the months the file contains', () => {
    repo.clearAll();
    save(JANUARY, 'january.xlsx');
    save(FEBRUARY, 'february.xlsx');

    expect(hours()).toBe(270);

    const outcome = save(JANUARY_CORRECTED, 'january-corrected.xlsx');

    expect(outcome.replacedPeriods).toEqual([{ year: 2025, month: 1 }]);
    // January's 180 became 200; February's 90 is untouched.
    expect(hours()).toBe(290);
    expect(monthHours(1)).toBe(200);
    expect(monthHours(2)).toBe(90);
  });

  it('does not duplicate rows when the same file is uploaded twice', () => {
    repo.clearAll();
    save(JANUARY, 'january.xlsx');
    save(JANUARY, 'january.xlsx');

    expect(repo.loadModelInputs().entries).toHaveLength(2);
    expect(hours()).toBe(180);
  });
});

describe('re-uploading salaries', () => {
  const grid = (january: number | string, february: number | string): Grid => [
    [null, 'Salary Overview 2025 (AED)'],
    ['Employee No.', 'Employee Name', 'January', 'February'],
    ['1', 'Ayesha', january, february],
  ];

  const saveSalaries = (sheet: Grid, filename: string) =>
    repo.saveDataset(
      { ...parseSalaries(sheet, 'Salary'), kind: 'salaries' } as AnyParseResult,
      filename,
    );

  it('overwrites a corrected figure and leaves a blank cell alone', () => {
    repo.clearAll();
    saveSalaries(grid(18_000, 18_000), 'salaries.xlsx');
    expect(salaryFor(1)).toBe(18_000);
    expect(salaryFor(2)).toBe(18_000);

    // Only January is restated; February arrives as "-", meaning not provided.
    saveSalaries(grid(19_500, '-'), 'salaries-corrected.xlsx');

    expect(salaryFor(1)).toBe(19_500);
    expect(salaryFor(2)).toBe(18_000);
  });
});

describe('re-uploading project prices', () => {
  it('updates the ref codes present and keeps the rest', async () => {
    const { parseProjects } = await import('@/lib/ingest/projects');
    const saveProjects = (grid: Grid, filename: string) =>
      repo.saveDataset(
        { ...parseProjects(grid, 'Projects'), kind: 'projects' } as AnyParseResult,
        filename,
      );

    repo.clearAll();
    saveProjects(
      [
        ['Ref Code', 'Project Name', 'Project Price'],
        ['P1', 'One', 100_000],
        ['P2', 'Two', 200_000],
      ],
      'prices.xlsx',
    );

    saveProjects(
      [
        ['Ref Code', 'Project Name', 'Project Price'],
        ['P1', 'One, restated', 150_000],
      ],
      'prices-corrected.xlsx',
    );

    const projects = repo.loadModelInputs().projects;
    expect(projects).toHaveLength(2);
    expect(projects.find((p) => p.refCode === 'P1')?.price).toBe(150_000);
    expect(projects.find((p) => p.refCode === 'P2')?.price).toBe(200_000);
  });
});

describe('employee identity', () => {
  it('stitches a name-only salary row to the timesheet employee number', () => {
    repo.clearAll();
    save(JANUARY, 'january.xlsx');

    // This salary sheet has no employee-number column at all.
    repo.saveDataset(
      {
        ...parseSalaries(
          [
            ['Salary Overview 2025'],
            ['Employee Name', 'January'],
            ['Ayesha', 18_000],
          ],
          'Salary',
        ),
        kind: 'salaries',
      } as AnyParseResult,
      'salaries-no-numbers.xlsx',
    );

    const { salaries } = repo.loadModelInputs();
    expect(salaries[0].employeeNo).toBe('1');
  });
});

function hours(): number {
  return repo.loadModelInputs().entries.reduce((total, entry) => total + entry.hours, 0);
}

function monthHours(month: number): number {
  return repo
    .loadModelInputs()
    .entries.filter((entry) => entry.month === month)
    .reduce((total, entry) => total + entry.hours, 0);
}

function salaryFor(month: number): number | undefined {
  return repo.loadModelInputs().salaries.find((row) => row.month === month)?.amount;
}
