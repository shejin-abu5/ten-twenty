import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { beforeAll, describe, expect, it } from 'vitest';
import { buildCostModel } from '@/lib/domain/cost-model';
import { parseDataset, type AnyParseResult } from '@/lib/ingest';
import type { CostModel } from '@/lib/domain/types';

const DIR = fileURLToPath(new URL('../sample-data/messy/', import.meta.url));

/**
 * The messy workbooks written by `npm run make:messy` carry one instance of
 * every defect the brief warns about. This test is the contract for what the
 * loader is expected to absorb and what it is expected to report.
 */
describe('the deliberately messy workbooks', () => {
  let timesheet: Extract<AnyParseResult, { kind: 'timesheet' }>;
  let salaries: Extract<AnyParseResult, { kind: 'salaries' }>;
  let projects: Extract<AnyParseResult, { kind: 'projects' }>;
  let model: CostModel;

  async function parse(kind: 'timesheet' | 'salaries' | 'projects', filename: string) {
    return parseDataset(kind, await readFile(join(DIR, filename)), filename);
  }

  beforeAll(async () => {
    const [rawTimesheet, rawSalaries, rawProjects] = await Promise.all([
      parse('timesheet', 'timesheet-messy.xlsx'),
      parse('salaries', 'salaries-messy.xlsx'),
      parse('projects', 'project-prices-messy.xlsx'),
    ]);

    if (
      rawTimesheet.kind !== 'timesheet' ||
      rawSalaries.kind !== 'salaries' ||
      rawProjects.kind !== 'projects'
    ) {
      throw new Error('messy files were detected as the wrong kind');
    }

    timesheet = rawTimesheet;
    salaries = rawSalaries;
    projects = rawProjects;

    model = buildCostModel({
      entries: timesheet.rows.map((row, index) => ({ ...row, id: index + 1 })),
      salaries: salaries.rows,
      projects: projects.rows,
      assumptions: { billableCategories: ['Projects', 'Enhancements', 'Hosting'], monthlyOverhead: 0 },
    });
  });

  it('finds the header under two rows of preamble', () => {
    expect(timesheet.headerRow).toBe(4);
  });

  it('resolves four spellings of March 2025 to one period', () => {
    expect(timesheet.periods).toEqual([{ year: 2025, month: 3 }]);
  });

  it('skips the rows it cannot trust and says which ones', () => {
    const rows = timesheet.rows;
    expect(rows.some((row) => row.employeeName === 'Imran Sheikh')).toBe(false);
    expect(timesheet.issues.some((issue) => issue.message.includes('Could not read the month'))).toBe(
      true,
    );
    expect(timesheet.issues.some((issue) => issue.message.includes('no employee name'))).toBe(true);
  });

  it('reads a dash as empty rather than as zero', () => {
    const leave = timesheet.rows.find((row) => row.category === 'FC - Leaves');
    expect(leave).toBeUndefined();
    expect(timesheet.issues.some((issue) => issue.message.includes('logged no hours'))).toBe(true);
  });

  it('keeps a row whose category is missing', () => {
    expect(timesheet.rows.some((row) => row.category === 'Uncategorised')).toBe(true);
  });

  it('reads a salary written as text with a thousands separator', () => {
    const rohit = salaries.rows.find(
      (row) => row.employeeName === 'Rohit Menon' && row.month === 3,
    );
    expect(rohit?.amount).toBe(12_500);
  });

  it('leaves a dashed salary cell out rather than storing a zero', () => {
    const lina = salaries.rows.filter((row) => row.employeeName === 'Lina Haddad');
    expect(lina.map((row) => row.month)).toEqual([1, 3]);
  });

  it('lets the later of two duplicate ref codes win and flags the collision', () => {
    expect(projects.rows).toHaveLength(3);
    const meridian = projects.rows.find((row) => row.refCode === 'Q2025001a');
    expect(meridian?.price).toBe(575_000);
    expect(projects.issues.some((issue) => issue.message.includes('also appears on row'))).toBe(true);
  });

  it('surfaces every gap the model can detect', () => {
    const kinds = new Set(model.gaps.map((gap) => gap.kind));
    expect(kinds).toContain('missing-salary'); // Ghost Contractor
    expect(kinds).toContain('unknown-ref-code'); // Q2025099z
    expect(kinds).toContain('price-without-hours'); // Q2025088x
  });

  it('still balances, and says which salary reached no project', () => {
    const check = model.reconciliation;

    // The salary sheet covers January to March but the timesheet covers only
    // March, so two months of payroll have no billable hour to land on. That
    // is reported rather than quietly dropped, and every dirham is still
    // accounted for on one side or the other.
    expect(check.balanced).toBe(true);
    expect(check.unabsorbedCost).toBeGreaterThan(0);
    expect(check.allocatedCost + check.unabsorbedCost).toBeCloseTo(check.expectedCost, 2);
    expect(model.gaps.map((gap) => gap.kind)).toContain('unabsorbed-pool');
  });
});
