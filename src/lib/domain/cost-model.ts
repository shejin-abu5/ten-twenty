import { periodId } from './period';
import type {
  Assumptions,
  CostModel,
  CostedEntry,
  DataGap,
  EmployeeMonthRate,
  MonthlyRates,
  ProjectRecord,
  Reconciliation,
  SalaryRecord,
  TimesheetEntry,
} from './types';

export interface CostModelInput {
  entries: TimesheetEntry[];
  salaries: SalaryRecord[];
  projects: ProjectRecord[];
  assumptions: Assumptions;
}

/** One fils. Anything under this is floating-point noise, not a modelling error. */
const RECONCILIATION_TOLERANCE = 0.01;

/**
 * Turns raw rows into a fully costed dataset.
 *
 * Costs are attributed once, here, and every page reads the result. The
 * arithmetic is the brief's, and it balances by construction: summing a month's
 * allocated cost gives back that month's salaries plus overhead, because the
 * indirect pool is exactly the salary value that billable hours did not already
 * carry.
 */
export function buildCostModel(input: CostModelInput): CostModel {
  const { entries, salaries, projects, assumptions } = input;
  const billable = new Set(assumptions.billableCategories);
  const overhead = Number.isFinite(assumptions.monthlyOverhead)
    ? Math.max(0, assumptions.monthlyOverhead)
    : 0;

  const entriesByPeriod = groupBy(entries, (e) => periodId(e.year, e.month));
  const salariesByPeriod = groupBy(salaries, (s) => periodId(s.year, s.month));

  const periodIds = [...new Set([...entriesByPeriod.keys(), ...salariesByPeriod.keys()])].sort(
    (a, b) => a - b,
  );

  const months: MonthlyRates[] = [];
  const costed: CostedEntry[] = [];

  for (const id of periodIds) {
    const monthEntries = entriesByPeriod.get(id) ?? [];
    const monthSalaries = salariesByPeriod.get(id) ?? [];
    const rates = computeMonthlyRates({
      year: Math.floor(id / 100),
      month: id % 100,
      entries: monthEntries,
      salaries: monthSalaries,
      billable,
      overhead,
    });
    months.push(rates);

    const directRate = new Map(rates.employees.map((e) => [e.employeeNo, e.directRate]));
    for (const entry of monthEntries) {
      const isBillable = billable.has(entry.category);
      const directCost = entry.hours * (directRate.get(entry.employeeNo) ?? 0);
      const indirectCost = isBillable ? entry.hours * rates.indirectRate : 0;
      costed.push({
        ...entry,
        isBillable,
        directCost,
        indirectCost,
        allocatedCost: isBillable ? directCost + indirectCost : 0,
        recognisedRevenue: 0,
      });
    }
  }

  const projectHours = new Map<string, number>();
  for (const entry of costed) {
    if (!entry.isBillable || !entry.refCode) continue;
    projectHours.set(entry.refCode, (projectHours.get(entry.refCode) ?? 0) + entry.hours);
  }

  const priceByRef = new Map(projects.map((p) => [p.refCode, p.price]));
  for (const entry of costed) {
    if (!entry.isBillable || !entry.refCode) continue;
    const price = priceByRef.get(entry.refCode);
    const total = projectHours.get(entry.refCode) ?? 0;
    if (price == null || total <= 0) continue;
    entry.recognisedRevenue = price * (entry.hours / total);
  }

  return {
    entries: costed,
    months,
    projects,
    projectHours,
    assumptions: { ...assumptions, monthlyOverhead: overhead },
    gaps: findGaps(costed, months, projects, projectHours),
    categories: distinctSorted(entries.map((e) => e.category)),
    departments: distinctSorted(entries.map((e) => e.department)),
    reconciliation: reconcile(costed, months),
  };
}

interface MonthlyRatesInput {
  year: number;
  month: number;
  entries: TimesheetEntry[];
  salaries: SalaryRecord[];
  billable: Set<string>;
  overhead: number;
}

/** The brief's rate arithmetic for a single month, with the working kept. */
export function computeMonthlyRates(input: MonthlyRatesInput): MonthlyRates {
  const { year, month, entries, salaries, billable, overhead } = input;

  const byEmployee = new Map<string, EmployeeMonthRate>();
  const employee = (no: string, name: string): EmployeeMonthRate => {
    let rate = byEmployee.get(no);
    if (!rate) {
      rate = {
        employeeNo: no,
        employeeName: name,
        salary: 0,
        hasSalaryRecord: false,
        totalHours: 0,
        billableHours: 0,
        nonBillableHours: 0,
        directRate: 0,
        nonBillableValue: 0,
      };
      byEmployee.set(no, rate);
    }
    return rate;
  };

  for (const salary of salaries) {
    const rate = employee(salary.employeeNo, salary.employeeName);
    rate.salary += salary.amount;
    rate.hasSalaryRecord = true;
  }

  for (const entry of entries) {
    const rate = employee(entry.employeeNo, entry.employeeName);
    if (!rate.employeeName) rate.employeeName = entry.employeeName;
    rate.totalHours += entry.hours;
    if (billable.has(entry.category)) rate.billableHours += entry.hours;
    else rate.nonBillableHours += entry.hours;
  }

  let unloggedSalaryCost = 0;
  let nonBillableCost = 0;
  let billableHours = 0;
  let totalHours = 0;
  let salaryTotal = 0;

  for (const rate of byEmployee.values()) {
    rate.directRate = rate.totalHours > 0 ? rate.salary / rate.totalHours : 0;
    rate.nonBillableValue = rate.nonBillableHours * rate.directRate;

    salaryTotal += rate.salary;
    totalHours += rate.totalHours;
    billableHours += rate.billableHours;
    if (rate.totalHours > 0) nonBillableCost += rate.nonBillableValue;
    else unloggedSalaryCost += rate.salary;
  }

  const indirectPool = unloggedSalaryCost + nonBillableCost + overhead;
  const indirectRate = billableHours > 0 ? indirectPool / billableHours : 0;

  return {
    year,
    month,
    employees: [...byEmployee.values()].sort((a, b) =>
      a.employeeName.localeCompare(b.employeeName),
    ),
    unloggedSalaryCost,
    nonBillableCost,
    overhead,
    indirectPool,
    billableHours,
    totalHours,
    indirectRate,
    unabsorbedPool: billableHours > 0 ? 0 : indirectPool,
    salaryTotal,
  };
}

function reconcile(entries: CostedEntry[], months: MonthlyRates[]): Reconciliation {
  const totalSalaries = sum(months, (m) => m.salaryTotal);
  const totalOverhead = sum(months, (m) => m.overhead);
  const unabsorbedCost = sum(months, (m) => m.unabsorbedPool);
  const allocatedCost = sum(entries, (e) => e.allocatedCost);
  const expectedCost = totalSalaries + totalOverhead;
  const difference = expectedCost - (allocatedCost + unabsorbedCost);

  return {
    totalSalaries,
    totalOverhead,
    expectedCost,
    allocatedCost,
    unabsorbedCost,
    difference,
    balanced: Math.abs(difference) < RECONCILIATION_TOLERANCE,
  };
}

function findGaps(
  entries: CostedEntry[],
  months: MonthlyRates[],
  projects: ProjectRecord[],
  projectHours: Map<string, number>,
): DataGap[] {
  const gaps: DataGap[] = [];

  const unsalaried = new Map<string, { name: string; hours: number; months: string[] }>();
  for (const month of months) {
    for (const rate of month.employees) {
      if (rate.hasSalaryRecord || rate.totalHours <= 0) continue;
      const found = unsalaried.get(rate.employeeNo) ?? {
        name: rate.employeeName,
        hours: 0,
        months: [],
      };
      found.hours += rate.totalHours;
      found.months.push(`${month.year}-${String(month.month).padStart(2, '0')}`);
      unsalaried.set(rate.employeeNo, found);
    }
  }
  for (const [employeeNo, found] of unsalaried) {
    gaps.push({
      kind: 'missing-salary',
      label: `${found.name} (${employeeNo}) has no salary row`,
      detail: `${formatHours(found.hours)} logged across ${found.months.length} month(s) is costed at zero until a salary is loaded.`,
      magnitude: found.hours,
    });
  }

  const known = new Map(projects.map((p) => [p.refCode, p]));
  const orphanRefs = new Map<string, number>();
  let unreferencedHours = 0;
  for (const entry of entries) {
    if (!entry.isBillable) continue;
    if (!entry.refCode) {
      unreferencedHours += entry.hours;
      continue;
    }
    const project = known.get(entry.refCode);
    if (!project || project.price == null) {
      orphanRefs.set(entry.refCode, (orphanRefs.get(entry.refCode) ?? 0) + entry.hours);
    }
  }
  for (const [refCode, hours] of orphanRefs) {
    const project = known.get(refCode);
    gaps.push({
      kind: project ? 'missing-price' : 'unknown-ref-code',
      label: project
        ? `${refCode} has no price`
        : `${refCode} is not in the project price sheet`,
      detail: `${formatHours(hours)} of billable work earns no revenue in the model.`,
      magnitude: hours,
    });
  }
  if (unreferencedHours > 0) {
    gaps.push({
      kind: 'billable-without-ref',
      label: 'Billable hours with no ref code',
      detail: `${formatHours(unreferencedHours)} are costed but cannot be attributed to a project.`,
      magnitude: unreferencedHours,
    });
  }

  for (const project of projects) {
    if (project.price == null) continue;
    if ((projectHours.get(project.refCode) ?? 0) > 0) continue;
    gaps.push({
      kind: 'price-without-hours',
      label: `${project.refCode} has a price but no hours`,
      detail: `${formatMoney(project.price)} sold with nothing logged against it.`,
      magnitude: project.price,
    });
  }

  for (const month of months) {
    if (month.unabsorbedPool <= RECONCILIATION_TOLERANCE) continue;
    gaps.push({
      kind: 'unabsorbed-pool',
      label: `${month.year}-${String(month.month).padStart(2, '0')} has cost but no billable hours`,
      detail: `${formatMoney(month.unabsorbedPool)} of salary and overhead cannot be spread across any project.`,
      magnitude: month.unabsorbedPool,
    });
  }

  return gaps.sort((a, b) => b.magnitude - a.magnitude);
}

function groupBy<T, K>(items: T[], key: (item: T) => K): Map<K, T[]> {
  const map = new Map<K, T[]>();
  for (const item of items) {
    const k = key(item);
    const bucket = map.get(k);
    if (bucket) bucket.push(item);
    else map.set(k, [item]);
  }
  return map;
}

function distinctSorted(values: (string | null)[]): string[] {
  return [...new Set(values.filter((v): v is string => Boolean(v)))].sort((a, b) =>
    a.localeCompare(b),
  );
}

function sum<T>(items: T[], value: (item: T) => number): number {
  let total = 0;
  for (const item of items) total += value(item);
  return total;
}

function formatHours(hours: number): string {
  return `${hours.toLocaleString('en-AE', { maximumFractionDigits: 1 })} h`;
}

function formatMoney(amount: number): string {
  return `AED ${amount.toLocaleString('en-AE', { maximumFractionDigits: 0 })}`;
}
