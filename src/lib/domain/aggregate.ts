import { matchesFilter, type PeriodFilter } from './period';
import type { CostModel, CostedEntry, ProjectRecord } from './types';

export interface Totals {
  totalHours: number;
  billableHours: number;
  nonBillableHours: number;
  cost: number;
  revenue: number;
  profit: number;
  /** Null when there is no revenue to divide by. */
  margin: number | null;
  productivity: number | null;
}

export interface ProjectSummary {
  project: ProjectRecord;
  hours: number;
  cost: number;
  /** Pro-rata price share for the filtered period. */
  revenue: number;
  profit: number;
  margin: number | null;
  /** Hours across every loaded period, so a filtered view still shows completeness. */
  lifetimeHours: number;
  lifetimeCost: number;
  contributorCount: number;
}

export interface EmployeeContribution {
  employeeNo: string;
  employeeName: string;
  department: string | null;
  designation: string | null;
  hours: number;
  cost: number;
  revenueShare: number;
  profit: number;
  profitability: number | null;
}

export interface EmployeeProductivity {
  employeeNo: string;
  employeeName: string;
  department: string | null;
  designation: string | null;
  totalHours: number;
  billableHours: number;
  nonBillableHours: number;
  productivity: number | null;
  cost: number;
  revenue: number;
}

export interface CategoryBreakdown {
  category: string;
  isBillable: boolean;
  hours: number;
  shareOfHours: number;
  /**
   * What this category charged to projects. Billable rows only, so this column
   * sums to the company's total cost.
   */
  chargedCost: number;
  /**
   * Salary value of internal time. It is already inside chargedCost by way of
   * the indirect rate, so the two columns are deliberately never added together.
   */
  absorbedCost: number;
  people: number;
}

export interface DepartmentBreakdown {
  department: string;
  totalHours: number;
  billableHours: number;
  productivity: number | null;
  cost: number;
  revenue: number;
  headcount: number;
}

export interface MonthlyPoint {
  year: number;
  month: number;
  totalHours: number;
  billableHours: number;
  cost: number;
  revenue: number;
  margin: number | null;
}

export function filterEntries(model: CostModel, filter: PeriodFilter): CostedEntry[] {
  if (filter.year === null && filter.month === null) return model.entries;
  return model.entries.filter((e) => matchesFilter(filter, e.year, e.month));
}

export function summarise(entries: CostedEntry[]): Totals {
  let totalHours = 0;
  let billableHours = 0;
  let cost = 0;
  let revenue = 0;

  for (const entry of entries) {
    totalHours += entry.hours;
    if (entry.isBillable) billableHours += entry.hours;
    cost += entry.allocatedCost;
    revenue += entry.recognisedRevenue;
  }

  return {
    totalHours,
    billableHours,
    nonBillableHours: totalHours - billableHours,
    cost,
    revenue,
    profit: revenue - cost,
    margin: ratio(revenue - cost, revenue),
    productivity: ratio(billableHours, totalHours),
  };
}

export function projectSummaries(model: CostModel, filter: PeriodFilter): ProjectSummary[] {
  const inPeriod = filterEntries(model, filter);
  const periodByRef = groupByRef(inPeriod);
  const lifetimeByRef = groupByRef(model.entries);

  const refCodes = new Set<string>([
    ...model.projects.map((p) => p.refCode),
    ...lifetimeByRef.keys(),
  ]);

  const summaries: ProjectSummary[] = [];
  for (const refCode of refCodes) {
    const project =
      model.projects.find((p) => p.refCode === refCode) ?? unknownProject(refCode, lifetimeByRef);
    const rows = periodByRef.get(refCode) ?? [];
    const lifetime = lifetimeByRef.get(refCode) ?? [];
    const hours = sum(rows, (r) => r.hours);
    const cost = sum(rows, (r) => r.allocatedCost);
    const revenue = sum(rows, (r) => r.recognisedRevenue);

    summaries.push({
      project,
      hours,
      cost,
      revenue,
      profit: revenue - cost,
      margin: ratio(revenue - cost, revenue),
      lifetimeHours: sum(lifetime, (r) => r.hours),
      lifetimeCost: sum(lifetime, (r) => r.allocatedCost),
      contributorCount: new Set(rows.map((r) => r.employeeNo)).size,
    });
  }

  return summaries.sort((a, b) => b.hours - a.hours || b.lifetimeHours - a.lifetimeHours);
}

export interface ProjectDetail {
  project: ProjectRecord;
  entries: CostedEntry[];
  totals: Totals;
  /** Whole-life profit against the contracted price, which is what "did we make money" means. */
  price: number | null;
  lifetimeCost: number;
  lifetimeHours: number;
  lifetimeProfit: number | null;
  lifetimeMargin: number | null;
  byDepartment: DepartmentBreakdown[];
  byEmployee: EmployeeContribution[];
  byMonth: MonthlyPoint[];
}

export function projectDetail(model: CostModel, refCode: string): ProjectDetail | null {
  const entries = model.entries.filter((e) => e.isBillable && e.refCode === refCode);
  const project = model.projects.find((p) => p.refCode === refCode);
  if (!project && entries.length === 0) return null;

  const resolved: ProjectRecord = project ?? {
    refCode,
    name: entries[0]?.taskName ?? null,
    price: null,
    salesYear: null,
    salesMonth: null,
    category: entries[0]?.category ?? null,
    status: null,
  };

  const lifetimeHours = sum(entries, (e) => e.hours);
  const lifetimeCost = sum(entries, (e) => e.allocatedCost);
  const price = resolved.price;

  return {
    project: resolved,
    entries,
    totals: summarise(entries),
    price,
    lifetimeCost,
    lifetimeHours,
    lifetimeProfit: price == null ? null : price - lifetimeCost,
    lifetimeMargin: price == null ? null : ratio(price - lifetimeCost, price),
    byDepartment: departmentBreakdown(entries),
    byEmployee: employeeContributions(entries, price, lifetimeHours),
    byMonth: monthlyPoints(entries),
  };
}

export function employeeContributions(
  entries: CostedEntry[],
  price: number | null,
  totalProjectHours: number,
): EmployeeContribution[] {
  const map = new Map<string, EmployeeContribution>();

  for (const entry of entries) {
    let row = map.get(entry.employeeNo);
    if (!row) {
      row = {
        employeeNo: entry.employeeNo,
        employeeName: entry.employeeName,
        department: entry.department,
        designation: entry.designation,
        hours: 0,
        cost: 0,
        revenueShare: 0,
        profit: 0,
        profitability: null,
      };
      map.set(entry.employeeNo, row);
    }
    row.hours += entry.hours;
    row.cost += entry.allocatedCost;
  }

  for (const row of map.values()) {
    row.revenueShare =
      price != null && totalProjectHours > 0 ? price * (row.hours / totalProjectHours) : 0;
    row.profit = row.revenueShare - row.cost;
    row.profitability = ratio(row.profit, row.revenueShare);
  }

  return [...map.values()].sort((a, b) => b.hours - a.hours);
}

export function employeeProductivity(
  model: CostModel,
  filter: PeriodFilter,
): EmployeeProductivity[] {
  const map = new Map<string, EmployeeProductivity>();

  for (const entry of filterEntries(model, filter)) {
    let row = map.get(entry.employeeNo);
    if (!row) {
      row = {
        employeeNo: entry.employeeNo,
        employeeName: entry.employeeName,
        department: entry.department,
        designation: entry.designation,
        totalHours: 0,
        billableHours: 0,
        nonBillableHours: 0,
        productivity: null,
        cost: 0,
        revenue: 0,
      };
      map.set(entry.employeeNo, row);
    }
    row.totalHours += entry.hours;
    if (entry.isBillable) row.billableHours += entry.hours;
    else row.nonBillableHours += entry.hours;
    row.cost += entry.allocatedCost;
    row.revenue += entry.recognisedRevenue;
  }

  for (const row of map.values()) row.productivity = ratio(row.billableHours, row.totalHours);

  return [...map.values()].sort(
    (a, b) => (b.productivity ?? -1) - (a.productivity ?? -1) || b.totalHours - a.totalHours,
  );
}

export function categoryBreakdown(model: CostModel, filter: PeriodFilter): CategoryBreakdown[] {
  const entries = filterEntries(model, filter);
  const totalHours = sum(entries, (e) => e.hours);
  const map = new Map<string, CategoryBreakdown & { staff: Set<string> }>();

  for (const entry of entries) {
    let row = map.get(entry.category);
    if (!row) {
      row = {
        category: entry.category,
        isBillable: entry.isBillable,
        hours: 0,
        shareOfHours: 0,
        chargedCost: 0,
        absorbedCost: 0,
        people: 0,
        staff: new Set<string>(),
      };
      map.set(entry.category, row);
    }
    row.hours += entry.hours;
    row.chargedCost += entry.allocatedCost;
    if (!entry.isBillable) row.absorbedCost += entry.directCost;
    row.staff.add(entry.employeeNo);
  }

  return [...map.values()]
    .map(({ staff, ...row }) => ({
      ...row,
      people: staff.size,
      shareOfHours: totalHours > 0 ? row.hours / totalHours : 0,
    }))
    .sort((a, b) => b.hours - a.hours);
}

export function departmentBreakdown(entries: CostedEntry[]): DepartmentBreakdown[] {
  const map = new Map<string, DepartmentBreakdown & { staff: Set<string> }>();

  for (const entry of entries) {
    const key = entry.department ?? 'Unassigned';
    let row = map.get(key);
    if (!row) {
      row = {
        department: key,
        totalHours: 0,
        billableHours: 0,
        productivity: null,
        cost: 0,
        revenue: 0,
        headcount: 0,
        staff: new Set<string>(),
      };
      map.set(key, row);
    }
    row.totalHours += entry.hours;
    if (entry.isBillable) row.billableHours += entry.hours;
    row.cost += entry.allocatedCost;
    row.revenue += entry.recognisedRevenue;
    row.staff.add(entry.employeeNo);
  }

  return [...map.values()]
    .map(({ staff, ...row }) => ({
      ...row,
      headcount: staff.size,
      productivity: ratio(row.billableHours, row.totalHours),
    }))
    .sort((a, b) => b.totalHours - a.totalHours);
}

export function monthlyPoints(entries: CostedEntry[]): MonthlyPoint[] {
  const map = new Map<number, MonthlyPoint>();

  for (const entry of entries) {
    const key = entry.year * 100 + entry.month;
    let point = map.get(key);
    if (!point) {
      point = {
        year: entry.year,
        month: entry.month,
        totalHours: 0,
        billableHours: 0,
        cost: 0,
        revenue: 0,
        margin: null,
      };
      map.set(key, point);
    }
    point.totalHours += entry.hours;
    if (entry.isBillable) point.billableHours += entry.hours;
    point.cost += entry.allocatedCost;
    point.revenue += entry.recognisedRevenue;
  }

  return [...map.entries()]
    .sort(([a], [b]) => a - b)
    .map(([, point]) => ({ ...point, margin: ratio(point.revenue - point.cost, point.revenue) }));
}

/** The pivot the finance team builds by hand: hours per person per category. */
export interface CategoryMatrix {
  categories: string[];
  rows: {
    employeeNo: string;
    employeeName: string;
    department: string | null;
    hours: number[];
    total: number;
  }[];
  columnTotals: number[];
  grandTotal: number;
}

export function employeeCategoryMatrix(model: CostModel, filter: PeriodFilter): CategoryMatrix {
  const entries = filterEntries(model, filter);
  const categories = [...new Set(entries.map((e) => e.category))].sort((a, b) => a.localeCompare(b));
  const index = new Map(categories.map((c, i) => [c, i]));
  const rows = new Map<string, CategoryMatrix['rows'][number]>();

  for (const entry of entries) {
    let row = rows.get(entry.employeeNo);
    if (!row) {
      row = {
        employeeNo: entry.employeeNo,
        employeeName: entry.employeeName,
        department: entry.department,
        hours: new Array(categories.length).fill(0),
        total: 0,
      };
      rows.set(entry.employeeNo, row);
    }
    row.hours[index.get(entry.category)!] += entry.hours;
    row.total += entry.hours;
  }

  const ordered = [...rows.values()].sort((a, b) => a.employeeName.localeCompare(b.employeeName));
  const columnTotals = categories.map((_, i) => sum(ordered, (r) => r.hours[i]));

  return {
    categories,
    rows: ordered,
    columnTotals,
    grandTotal: sum(columnTotals, (v) => v),
  };
}

export interface ProjectRollup {
  refCode: string;
  name: string | null;
  hours: number;
  cost: number;
  revenue: number;
}

/** Project totals for an arbitrary slice of entries, e.g. one department's rows. */
export function projectRollup(entries: CostedEntry[]): ProjectRollup[] {
  const map = new Map<string, ProjectRollup>();

  for (const entry of entries) {
    if (!entry.isBillable || !entry.refCode) continue;
    let row = map.get(entry.refCode);
    if (!row) {
      row = { refCode: entry.refCode, name: entry.taskName, hours: 0, cost: 0, revenue: 0 };
      map.set(entry.refCode, row);
    }
    row.hours += entry.hours;
    row.cost += entry.allocatedCost;
    row.revenue += entry.recognisedRevenue;
  }

  return [...map.values()].sort((a, b) => b.hours - a.hours);
}

export function availableYears(model: CostModel): number[] {
  return [...new Set(model.entries.map((e) => e.year))].sort((a, b) => b - a);
}

export function availableMonths(model: CostModel, year: number | null): number[] {
  const source = year === null ? model.entries : model.entries.filter((e) => e.year === year);
  return [...new Set(source.map((e) => e.month))].sort((a, b) => a - b);
}

function groupByRef(entries: CostedEntry[]): Map<string, CostedEntry[]> {
  const map = new Map<string, CostedEntry[]>();
  for (const entry of entries) {
    if (!entry.isBillable || !entry.refCode) continue;
    const bucket = map.get(entry.refCode);
    if (bucket) bucket.push(entry);
    else map.set(entry.refCode, [entry]);
  }
  return map;
}

function unknownProject(refCode: string, byRef: Map<string, CostedEntry[]>): ProjectRecord {
  const first = byRef.get(refCode)?.[0];
  return {
    refCode,
    name: first?.taskName ?? null,
    price: null,
    salesYear: null,
    salesMonth: null,
    category: first?.category ?? null,
    status: null,
  };
}

function sum<T>(items: T[], value: (item: T) => number): number {
  let total = 0;
  for (const item of items) total += value(item);
  return total;
}

function ratio(numerator: number, denominator: number): number | null {
  return denominator > 0 ? numerator / denominator : null;
}
