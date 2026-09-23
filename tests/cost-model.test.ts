import { describe, expect, it } from 'vitest';
import { buildCostModel } from '@/lib/domain/cost-model';
import type { Assumptions, SalaryRecord, TimesheetEntry } from '@/lib/domain/types';

const BILLABLE: Assumptions = {
  billableCategories: ['Projects'],
  monthlyOverhead: 0,
};

let nextId = 1;

function entry(partial: Partial<TimesheetEntry> & { employeeNo: string; hours: number }): TimesheetEntry {
  return {
    id: nextId++,
    year: 2025,
    month: 1,
    employeeName: partial.employeeNo,
    expenseType: 'DL',
    department: 'Design',
    designation: 'Designer',
    category: 'Projects',
    refCode: 'P1',
    taskName: 'Project One',
    company: 'Client',
    description: null,
    ...partial,
  };
}

function salary(employeeNo: string, amount: number, month = 1): SalaryRecord {
  return { employeeNo, employeeName: employeeNo, year: 2025, month, amount };
}

describe('direct cost rate', () => {
  it('is that month salary divided by that month total logged hours', () => {
    const model = buildCostModel({
      entries: [
        entry({ employeeNo: 'A', hours: 60 }),
        entry({ employeeNo: 'A', hours: 40, category: 'FC - Leaves', refCode: null }),
      ],
      salaries: [salary('A', 10_000)],
      projects: [{ refCode: 'P1', name: 'P1', price: null, salesYear: null, salesMonth: null, category: null, status: null }],
      assumptions: BILLABLE,
    });

    const rate = model.months[0].employees[0];
    expect(rate.totalHours).toBe(100);
    expect(rate.directRate).toBe(100);
    expect(rate.nonBillableValue).toBe(4_000);
  });

  it('is zero, not infinite, when a person has a salary but no hours', () => {
    const model = buildCostModel({
      entries: [entry({ employeeNo: 'A', hours: 100 })],
      salaries: [salary('A', 10_000), salary('SUPPORT', 5_000)],
      projects: [],
      assumptions: BILLABLE,
    });

    const support = model.months[0].employees.find((e) => e.employeeNo === 'SUPPORT')!;
    expect(support.directRate).toBe(0);
    expect(model.months[0].unloggedSalaryCost).toBe(5_000);
  });
});

describe('indirect cost pool', () => {
  it('is unlogged salaries plus non-billable time plus overhead', () => {
    const model = buildCostModel({
      entries: [
        entry({ employeeNo: 'A', hours: 80 }),
        entry({ employeeNo: 'A', hours: 20, category: 'FC - Idle', refCode: null }),
      ],
      salaries: [salary('A', 10_000), salary('SUPPORT', 6_000)],
      projects: [],
      assumptions: { billableCategories: ['Projects'], monthlyOverhead: 1_000 },
    });

    const month = model.months[0];
    // A earns 100/h, so 20 idle hours push 2,000 into the pool.
    expect(month.nonBillableCost).toBe(2_000);
    expect(month.unloggedSalaryCost).toBe(6_000);
    expect(month.overhead).toBe(1_000);
    expect(month.indirectPool).toBe(9_000);
    expect(month.billableHours).toBe(80);
    expect(month.indirectRate).toBe(112.5);
  });
});

describe('the self-check from the brief', () => {
  it('returns total cost equal to total salaries when overhead is zero', () => {
    const entries: TimesheetEntry[] = [];
    const salaries: SalaryRecord[] = [];

    for (let month = 1; month <= 12; month++) {
      salaries.push(salary('A', 12_000, month), salary('B', 9_000, month), salary('SUPPORT', 7_000, month));
      entries.push(
        entry({ employeeNo: 'A', hours: 120 + month, month }),
        entry({ employeeNo: 'A', hours: 30, month, category: 'FC - Meetings', refCode: null }),
        entry({ employeeNo: 'B', hours: 95.5, month, refCode: 'P2' }),
        entry({ employeeNo: 'B', hours: 44.5, month, category: 'FC - Leaves', refCode: null }),
      );
    }

    const model = buildCostModel({
      entries,
      salaries,
      projects: [],
      assumptions: { billableCategories: ['Projects'], monthlyOverhead: 0 },
    });

    expect(model.reconciliation.totalSalaries).toBe(12 * 28_000);
    expect(model.reconciliation.allocatedCost).toBeCloseTo(12 * 28_000, 6);
    expect(model.reconciliation.balanced).toBe(true);
  });

  it('adds overhead on top, once per month', () => {
    const model = buildCostModel({
      entries: [entry({ employeeNo: 'A', hours: 100 }), entry({ employeeNo: 'A', hours: 100, month: 2 })],
      salaries: [salary('A', 10_000, 1), salary('A', 10_000, 2)],
      projects: [],
      assumptions: { billableCategories: ['Projects'], monthlyOverhead: 5_000 },
    });

    expect(model.reconciliation.totalOverhead).toBe(10_000);
    expect(model.reconciliation.allocatedCost).toBeCloseTo(30_000, 6);
    expect(model.reconciliation.balanced).toBe(true);
  });

  it('never counts non-billable time twice', () => {
    const model = buildCostModel({
      entries: [
        entry({ employeeNo: 'A', hours: 50 }),
        entry({ employeeNo: 'A', hours: 50, category: 'FC - Learning', refCode: null }),
      ],
      salaries: [salary('A', 10_000)],
      projects: [],
      assumptions: BILLABLE,
    });

    const nonBillable = model.entries.find((e) => !e.isBillable)!;
    expect(nonBillable.allocatedCost).toBe(0);
    expect(nonBillable.directCost).toBe(5_000);
    expect(model.reconciliation.allocatedCost).toBeCloseTo(10_000, 6);
  });
});

describe('gaps in the data', () => {
  it('costs an employee with no salary row at zero and reports it', () => {
    const model = buildCostModel({
      entries: [entry({ employeeNo: 'GHOST', employeeName: 'Ghost', hours: 40 })],
      salaries: [],
      projects: [],
      assumptions: BILLABLE,
    });

    expect(model.reconciliation.allocatedCost).toBe(0);
    expect(model.gaps.map((g) => g.kind)).toContain('missing-salary');
  });

  it('reports a ref code that has hours but no price', () => {
    const model = buildCostModel({
      entries: [entry({ employeeNo: 'A', hours: 100, refCode: 'NOPRICE' })],
      salaries: [salary('A', 10_000)],
      projects: [],
      assumptions: BILLABLE,
    });

    expect(model.gaps.map((g) => g.kind)).toContain('unknown-ref-code');
    expect(model.entries[0].recognisedRevenue).toBe(0);
  });

  it('reports a priced project with no hours logged against it', () => {
    const model = buildCostModel({
      entries: [entry({ employeeNo: 'A', hours: 100 })],
      salaries: [salary('A', 10_000)],
      projects: [
        { refCode: 'P1', name: 'P1', price: 1_000, salesYear: 2025, salesMonth: 1, category: null, status: null },
        { refCode: 'IDLE', name: 'Idle', price: 5_000, salesYear: 2025, salesMonth: 1, category: null, status: null },
      ],
      assumptions: BILLABLE,
    });

    const gap = model.gaps.find((g) => g.kind === 'price-without-hours');
    expect(gap?.label).toContain('IDLE');
  });

  it('flags a month whose cost no billable hour can absorb', () => {
    const model = buildCostModel({
      entries: [entry({ employeeNo: 'A', hours: 100, category: 'FC - Idle', refCode: null })],
      salaries: [salary('A', 10_000)],
      projects: [],
      assumptions: BILLABLE,
    });

    expect(model.months[0].unabsorbedPool).toBe(10_000);
    expect(model.reconciliation.unabsorbedCost).toBe(10_000);
    expect(model.gaps.map((g) => g.kind)).toContain('unabsorbed-pool');
  });
});

describe('revenue attribution', () => {
  it('splits the price across hours, and the shares add back to the price', () => {
    const model = buildCostModel({
      entries: [
        entry({ employeeNo: 'A', hours: 75 }),
        entry({ employeeNo: 'B', hours: 25 }),
      ],
      salaries: [salary('A', 10_000), salary('B', 5_000)],
      projects: [
        { refCode: 'P1', name: 'P1', price: 200_000, salesYear: 2025, salesMonth: 1, category: null, status: null },
      ],
      assumptions: BILLABLE,
    });

    const [a, b] = model.entries;
    expect(a.recognisedRevenue).toBe(150_000);
    expect(b.recognisedRevenue).toBe(50_000);
    expect(a.recognisedRevenue + b.recognisedRevenue).toBe(200_000);
  });
});

describe('configurable assumptions', () => {
  it('moves a category between billable and absorbed without touching the totals', () => {
    const input = {
      entries: [
        entry({ employeeNo: 'A', hours: 60 }),
        entry({ employeeNo: 'A', hours: 40, category: 'Hosting', refCode: 'H1' }),
      ],
      salaries: [salary('A', 10_000)],
      projects: [],
    };

    const withoutHosting = buildCostModel({ ...input, assumptions: BILLABLE });
    const withHosting = buildCostModel({
      ...input,
      assumptions: { billableCategories: ['Projects', 'Hosting'], monthlyOverhead: 0 },
    });

    expect(withoutHosting.reconciliation.allocatedCost).toBeCloseTo(10_000, 6);
    expect(withHosting.reconciliation.allocatedCost).toBeCloseTo(10_000, 6);
    expect(withoutHosting.months[0].billableHours).toBe(60);
    expect(withHosting.months[0].billableHours).toBe(100);
  });
});
