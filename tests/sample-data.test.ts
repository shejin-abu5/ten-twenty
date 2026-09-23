import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { beforeAll, describe, expect, it } from 'vitest';
import { buildCostModel } from '@/lib/domain/cost-model';
import { categoryBreakdown, projectDetail, summarise } from '@/lib/domain/aggregate';
import { ALL_PERIODS } from '@/lib/domain/period';
import { parseDataset } from '@/lib/ingest';
import type { CostModel } from '@/lib/domain/types';

const SAMPLE_DIR = fileURLToPath(new URL('../sample-data/', import.meta.url));

const load = (filename: string) => readFile(join(SAMPLE_DIR, filename));

/**
 * The brief's self-check, run against the workbooks the agency actually sent.
 * If the cost model ever starts double-counting, this is the test that fails.
 */
describe('the supplied 2025 workbooks', () => {
  let model: CostModel;

  beforeAll(async () => {
    const [timesheet, salaries, projects] = await Promise.all([
      parseDataset('timesheet', await load('timesheet-2025.xlsx'), 'timesheet-2025.xlsx'),
      parseDataset('salaries', await load('salaries-2025.xlsx'), 'salaries-2025.xlsx'),
      parseDataset('projects', await load('project-prices-2025.xlsx'), 'project-prices-2025.xlsx'),
    ]);

    if (timesheet.kind !== 'timesheet' || salaries.kind !== 'salaries' || projects.kind !== 'projects') {
      throw new Error('sample files were detected as the wrong kind');
    }

    model = buildCostModel({
      entries: timesheet.rows.map((row, index) => ({ ...row, id: index + 1 })),
      salaries: salaries.rows,
      projects: projects.rows,
      assumptions: { billableCategories: ['Projects', 'Enhancements', 'Hosting'], monthlyOverhead: 0 },
    });
  });

  it('parses every row of the year', () => {
    expect(model.entries).toHaveLength(562);
    expect(model.months).toHaveLength(12);
  });

  it('reconciles total cost to total salaries, to the dirham', () => {
    expect(model.reconciliation.totalSalaries).toBe(2_400_000);
    expect(model.reconciliation.allocatedCost).toBeCloseTo(2_400_000, 2);
    expect(model.reconciliation.unabsorbedCost).toBe(0);
    expect(model.reconciliation.balanced).toBe(true);
  });

  it('gives back the full contract value once every project is counted', () => {
    const totals = summarise(model.entries);
    expect(totals.revenue).toBeCloseTo(5_012_000, 2);
    expect(totals.totalHours).toBeCloseTo(19_815.2, 1);
    expect(totals.billableHours).toBeCloseTo(15_265.6, 1);
  });

  it('splits a project price across its contributors without losing a dirham', () => {
    const detail = projectDetail(model, 'Q2025001a')!;
    expect(detail.price).toBe(560_000);
    const shares = detail.byEmployee.reduce((total, row) => total + row.revenueShare, 0);
    expect(shares).toBeCloseTo(560_000, 2);
    const costs = detail.byEmployee.reduce((total, row) => total + row.cost, 0);
    expect(costs).toBeCloseTo(detail.lifetimeCost, 6);
  });

  it('still reconciles when overhead is switched on', () => {
    const withOverhead = buildCostModel({
      entries: model.entries,
      salaries: [],
      projects: model.projects,
      assumptions: { billableCategories: model.assumptions.billableCategories, monthlyOverhead: 50_000 },
    });
    // Salaries are empty here, so the whole expected cost is the 12 monthly
    // overhead figures, and every dirham of it must still land on a project.
    expect(withOverhead.reconciliation.expectedCost).toBe(600_000);
    expect(withOverhead.reconciliation.allocatedCost).toBeCloseTo(600_000, 6);
  });

  it('keeps the category view from double-counting internal time', () => {
    const rows = categoryBreakdown(model, ALL_PERIODS);
    const charged = rows.reduce((total, row) => total + row.chargedCost, 0);
    const absorbed = rows.reduce((total, row) => total + row.absorbedCost, 0);

    // The charged column is the whole company cost on its own. The absorbed
    // column is a subset of it, reported separately and never added to it.
    expect(charged).toBeCloseTo(2_400_000, 2);
    expect(absorbed).toBeGreaterThan(0);
    expect(absorbed).toBeLessThan(charged);
  });

  it('finds no missing salaries or unpriced ref codes in this year', () => {
    expect(model.gaps.filter((gap) => gap.kind === 'missing-salary')).toHaveLength(0);
    expect(model.gaps.filter((gap) => gap.kind === 'unknown-ref-code')).toHaveLength(0);
  });
});
