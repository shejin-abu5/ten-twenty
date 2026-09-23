import { describe, expect, it } from 'vitest';
import { cleanString, parseMonth, parseNumber } from '@/lib/ingest/cells';
import { IngestError } from '@/lib/ingest/errors';
import { parseProjects } from '@/lib/ingest/projects';
import { parseSalaries } from '@/lib/ingest/salaries';
import { parseTimesheet } from '@/lib/ingest/timesheet';
import type { Grid } from '@/lib/ingest/cells';

describe('cleanString', () => {
  it('treats the placeholders the sheets use as empty', () => {
    for (const blank of ['-', '  -  ', '–', 'N/A', 'n/a', '', '   ', 'NULL']) {
      expect(cleanString(blank)).toBeNull();
    }
  });

  it('collapses the whitespace inside a value', () => {
    expect(cleanString('  Lina   Haddad ')).toBe('Lina Haddad');
  });
});

describe('parseNumber', () => {
  it('reads the shapes a price column arrives in', () => {
    expect(parseNumber(560000)).toBe(560000);
    expect(parseNumber('560,000')).toBe(560000);
    expect(parseNumber('AED 560,000.50')).toBe(560000.5);
    expect(parseNumber('(1,200)')).toBe(-1200);
  });

  it('returns null rather than zero for a blank or unreadable cell', () => {
    expect(parseNumber('-')).toBeNull();
    expect(parseNumber('')).toBeNull();
    expect(parseNumber('tbc')).toBeNull();
    expect(parseNumber(null)).toBeNull();
  });
});

describe('parseMonth', () => {
  it('reads every month format the brief names', () => {
    expect(parseMonth("May '25")).toEqual({ year: 2025, month: 5 });
    expect(parseMonth('January 2026')).toEqual({ year: 2026, month: 1 });
    expect(parseMonth('January')).toEqual({ year: null, month: 1 });
  });

  it('reads the other shapes a month column picks up', () => {
    expect(parseMonth('Jan-25')).toEqual({ year: 2025, month: 1 });
    expect(parseMonth('Sept 2025')).toEqual({ year: 2025, month: 9 });
    expect(parseMonth('2025-05')).toEqual({ year: 2025, month: 5 });
    expect(parseMonth('05/2025')).toEqual({ year: 2025, month: 5 });
    expect(parseMonth('March2025')).toEqual({ year: 2025, month: 3 });
    expect(parseMonth(new Date(Date.UTC(2025, 6, 1)))).toEqual({ year: 2025, month: 7 });
  });

  it('refuses to guess at something that is not a month', () => {
    expect(parseMonth('Total')).toBeNull();
    expect(parseMonth('-')).toBeNull();
    expect(parseMonth('Ju')).toBeNull();
    // A quarter is not a month, and a stray word next to a number is not one
    // either; guessing here would silently file hours under January.
    expect(parseMonth('Q1')).toBeNull();
    expect(parseMonth('Q1 2025')).toBeNull();
    expect(parseMonth('Total 12')).toBeNull();
    // A bare number in a month column is still a month.
    expect(parseMonth('3')).toEqual({ year: null, month: 3 });
    expect(parseMonth(3)).toEqual({ year: null, month: 3 });
  });
});

const TIMESHEET_GRID: Grid = [
  ['Monthly timesheet export', null, null, null, null, null],
  [null, null, null, null, null, null],
  ['Month', 'Employee No.', 'Employee Name', 'Category', 'Ref Code', 'Hours'],
  ["May '25", '10201', 'Ayesha Rahman', 'Projects', 'Q2025001a', 135.9],
  ['May', '10201', 'Ayesha Rahman', 'FC - Leaves', 'FC - Leaves', 8],
  ['May 2025', '10202', 'Rohit Menon', 'Projects', 'Q2025001a', '-'],
  ['Total', null, null, null, null, 143.9],
];

describe('parseTimesheet', () => {
  it('finds a header that is not in row one', () => {
    const result = parseTimesheet(TIMESHEET_GRID, 'Timesheet');
    expect(result.headerRow).toBe(3);
  });

  it('fills in the year for a row that names only a month', () => {
    const result = parseTimesheet(TIMESHEET_GRID, 'Timesheet');
    const leave = result.rows.find((row) => row.category === 'FC - Leaves')!;
    expect(leave.year).toBe(2025);
    expect(result.assumedYear).toBe(2025);
  });

  it('drops rows with no hours instead of costing them at zero', () => {
    const result = parseTimesheet(TIMESHEET_GRID, 'Timesheet');
    expect(result.rows).toHaveLength(2);
    expect(result.issues.some((i) => i.message.includes('logged no hours'))).toBe(true);
  });

  it('reports the periods it covers so the writer knows what to replace', () => {
    const result = parseTimesheet(TIMESHEET_GRID, 'Timesheet');
    expect(result.periods).toEqual([{ year: 2025, month: 5 }]);
  });

  it('falls back to the filename year when no row carries one', () => {
    const grid: Grid = [
      ['Month', 'Employee Name', 'Category', 'Hours'],
      ['January', 'Ayesha Rahman', 'Projects', 10],
    ];
    const result = parseTimesheet(grid, 'Timesheet', { fallbackYear: 2024 });
    expect(result.rows[0].year).toBe(2024);
  });

  it('refuses a sheet with no hours column', () => {
    const grid: Grid = [
      ['Ref Code', 'Project Name', 'Project Price'],
      ['Q1', 'A project', 1000],
    ];
    expect(() => parseTimesheet(grid, 'Projects')).toThrow(IngestError);
  });
});

const SALARY_GRID: Grid = [
  [null, 'Salary Overview 2025 (AED)', null, null, null],
  ['Employee No.', 'Employee Name', 'January', 'February', 'March'],
  ['10201', 'Ayesha Rahman', 18000, 18000, 18500],
  ['10202', 'Rohit Menon', 12000, '-', 12500],
  [null, null, null, null, null],
];

describe('parseSalaries', () => {
  it('reads the matrix layout and takes the year from the title row', () => {
    const result = parseSalaries(SALARY_GRID, 'Salary');
    expect(result.headerRow).toBe(2);
    expect(result.assumedYear).toBe(2025);
    expect(result.rows).toHaveLength(5);
  });

  it('skips a blank month rather than writing a zero salary', () => {
    const result = parseSalaries(SALARY_GRID, 'Salary');
    const rohit = result.rows.filter((row) => row.employeeName === 'Rohit Menon');
    expect(rohit.map((row) => row.month)).toEqual([1, 3]);
  });

  it('refuses a sheet that has no month columns', () => {
    const grid: Grid = [
      ['Employee No.', 'Employee Name', 'Department'],
      ['10201', 'Ayesha Rahman', 'Design'],
    ];
    expect(() => parseSalaries(grid, 'Staff')).toThrow(IngestError);
  });
});

describe('parseProjects', () => {
  const grid: Grid = [
    ['Ref Code', 'Project (Billable) Name', 'Project Price', 'Sales month', 'Status'],
    ['Q2025001a', 'Meridian website', 560000, "January '25", 'in progress'],
    ['Q2025004c', 'Alwasl app', '-', "February '25", 'in progress'],
    ['Q2025001a', 'Meridian website v2', 600000, "January '25", 'completed'],
  ];

  it('keeps a project whose price is missing and flags it', () => {
    const result = parseProjects(grid, 'Projects');
    const alwasl = result.rows.find((row) => row.refCode === 'Q2025004c')!;
    expect(alwasl.price).toBeNull();
    expect(result.issues.some((i) => i.message.includes('no price'))).toBe(true);
  });

  it('lets the later of two duplicate ref codes win', () => {
    const result = parseProjects(grid, 'Projects');
    expect(result.rows).toHaveLength(2);
    expect(result.rows.find((row) => row.refCode === 'Q2025001a')?.price).toBe(600000);
  });

  it('reads the sales month', () => {
    const result = parseProjects(grid, 'Projects');
    expect(result.rows[0].salesYear).toBe(2025);
    expect(result.rows[0].salesMonth).toBe(1);
  });
});
