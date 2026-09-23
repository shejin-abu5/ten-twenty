/** One timesheet row: a person's hours against one task in one month. */
export interface TimesheetEntry {
  id: number;
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

/** One person's salary for one month. */
export interface SalaryRecord {
  employeeNo: string;
  employeeName: string;
  year: number;
  month: number;
  amount: number;
}

/** One sold project, keyed by the ref code that timesheet rows join on. */
export interface ProjectRecord {
  refCode: string;
  name: string | null;
  price: number | null;
  salesYear: number | null;
  salesMonth: number | null;
  category: string | null;
  status: string | null;
}

/** The two things the user can change without editing code. */
export interface Assumptions {
  billableCategories: string[];
  monthlyOverhead: number;
}

/** A timesheet entry with the cost the model attributes to it. */
export interface CostedEntry extends TimesheetEntry {
  isBillable: boolean;
  /** Salary-funded cost of these hours: hours x direct rate. */
  directCost: number;
  /** Share of the month's indirect pool. Zero on non-billable rows. */
  indirectCost: number;
  /**
   * Cost carried by this row. Billable rows carry direct + indirect; non-billable
   * rows carry nothing, because their direct cost is already inside the pool that
   * the billable rows absorb. Summing this column never double-counts.
   */
  allocatedCost: number;
  /** Pro-rata share of the project price, by hours. Zero when the ref code has no price. */
  recognisedRevenue: number;
}

/** Per-person working of the direct rate for one month. */
export interface EmployeeMonthRate {
  employeeNo: string;
  employeeName: string;
  salary: number;
  hasSalaryRecord: boolean;
  totalHours: number;
  billableHours: number;
  nonBillableHours: number;
  directRate: number;
  /** Non-billable hours valued at the direct rate. This is the person's push into the pool. */
  nonBillableValue: number;
}

/** Every number behind one month's rates, kept so the audit page can show the working. */
export interface MonthlyRates {
  year: number;
  month: number;
  employees: EmployeeMonthRate[];
  /** Salaries of people who were paid but logged nothing at all this month. */
  unloggedSalaryCost: number;
  /** Everyone else's non-billable time, valued at their direct rate. */
  nonBillableCost: number;
  overhead: number;
  indirectPool: number;
  billableHours: number;
  totalHours: number;
  indirectRate: number;
  /**
   * Pool that no billable hour could absorb (a month with cost but no billable work).
   * Non-zero here is the only way the reconciliation can fail, so it is reported.
   */
  unabsorbedPool: number;
  salaryTotal: number;
}

/** Something the data itself is missing, surfaced rather than silently defaulted. */
export interface DataGap {
  kind:
    | 'missing-salary'
    | 'missing-price'
    | 'unknown-ref-code'
    | 'billable-without-ref'
    | 'price-without-hours'
    | 'unabsorbed-pool';
  label: string;
  detail: string;
  /** Money or hours at stake, for sorting the list by how much it matters. */
  magnitude: number;
}

/** The whole costed dataset. Built once, then filtered by each page. */
export interface CostModel {
  entries: CostedEntry[];
  months: MonthlyRates[];
  projects: ProjectRecord[];
  /** Total hours logged against a ref code across every loaded period. */
  projectHours: Map<string, number>;
  assumptions: Assumptions;
  gaps: DataGap[];
  categories: string[];
  departments: string[];
  reconciliation: Reconciliation;
}

/** The self-check from the brief, computed rather than asserted. */
export interface Reconciliation {
  totalSalaries: number;
  totalOverhead: number;
  expectedCost: number;
  allocatedCost: number;
  /** Pool from months with no billable hours. Cost that exists but reached no project. */
  unabsorbedCost: number;
  difference: number;
  balanced: boolean;
}
