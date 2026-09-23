import { PeriodFilter } from '@/components/filters/period-filter';
import { DataTable, type Column } from '@/components/ui-kit/data-table';
import { ReconciliationNote } from '@/components/ui-kit/data-health';
import { NoDataState } from '@/components/ui-kit/empty-state';
import { PageHeader } from '@/components/ui-kit/page-header';
import { availableMonths, availableYears } from '@/lib/domain/aggregate';
import { matchesFilter, periodLabel } from '@/lib/domain/period';
import type { EmployeeMonthRate, MonthlyRates } from '@/lib/domain/types';
import {
  formatHoursPlain,
  formatMoney,
  formatMoneyExact,
  formatRate,
  round,
} from '@/lib/format';
import { getCostModel } from '@/lib/model';
import { resolvePeriod, type SearchParams } from '@/lib/period-params';

export default async function AuditPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const model = getCostModel();
  if (model.entries.length === 0) {
    return (
      <>
        <PageHeader title="Cost audit" />
        <NoDataState />
      </>
    );
  }

  const years = availableYears(model);
  const filter = resolvePeriod(await searchParams, years);
  const months = model.months.filter((month) => matchesFilter(filter, month.year, month.month));

  return (
    <>
      <PageHeader
        eyebrow="Working"
        title="Cost audit"
        description="Every rate the dashboard uses, and where it came from. A month's salaries plus its overhead equal the cost charged to that month's billable hours."
        actions={
          <PeriodFilter
            year={filter.year}
            month={filter.month}
            years={years}
            months={availableMonths(model, filter.year)}
          />
        }
      />

      <div className="space-y-6">
        <ReconciliationNote check={model.reconciliation} />

        <div className="rounded-lg border bg-background p-4 text-sm">
          <h2 className="text-sm font-semibold tracking-tight">How a rate is built</h2>
          <ol className="mt-2 space-y-1 text-muted-foreground">
            <li>
              <span className="font-medium text-foreground">Direct rate</span> — that person&apos;s
              salary for the month ÷ every hour they logged that month, billable or not.
            </li>
            <li>
              <span className="font-medium text-foreground">Indirect pool</span> — salaries of
              anyone who logged nothing, plus everyone else&apos;s internal time valued at their own
              direct rate, plus the monthly overhead from Assumptions.
            </li>
            <li>
              <span className="font-medium text-foreground">Indirect rate</span> — that pool ÷ the
              month&apos;s billable hours.
            </li>
            <li>
              <span className="font-medium text-foreground">Cost of an hour on a project</span> —
              direct rate + indirect rate.
            </li>
          </ol>
          <p className="mt-3 text-xs text-muted-foreground">
            Internal time is never charged to a project twice: it enters the pool once, and the pool
            is spread across billable hours only.
          </p>
        </div>

        <DataTable
          title="Monthly rates"
          description="The pool is what the agency absorbed that month; the indirect rate is how it reaches a project."
          columns={MONTH_COLUMNS}
          rows={months}
          rowKey={(row) => `${row.year}-${row.month}`}
          exportFilename={`cost-rates-${filter.year ?? 'all'}.csv`}
          footer={{
            month: 'Total',
            salaries: formatMoney(months.reduce((t, m) => t + m.salaryTotal, 0)),
            overhead: formatMoney(months.reduce((t, m) => t + m.overhead, 0)),
            unlogged: formatMoney(months.reduce((t, m) => t + m.unloggedSalaryCost, 0)),
            nonBillable: formatMoney(months.reduce((t, m) => t + m.nonBillableCost, 0)),
            pool: formatMoney(months.reduce((t, m) => t + m.indirectPool, 0)),
            totalHours: formatHoursPlain(months.reduce((t, m) => t + m.totalHours, 0)),
            billableHours: formatHoursPlain(months.reduce((t, m) => t + m.billableHours, 0)),
          }}
        />

        {filter.month === null ? (
          <p className="rounded-lg border border-dashed bg-background px-4 py-6 text-center text-sm text-muted-foreground">
            Pick a month above to see each person&apos;s salary, hours and direct rate for it.
          </p>
        ) : null}

        {(filter.month === null ? [] : months).map((month) => (
          <DataTable
            key={`${month.year}-${month.month}`}
            title={periodLabel(month.year, month.month)}
            description={`Indirect rate ${formatRate(month.indirectRate)} on ${formatHoursPlain(month.billableHours)} billable hours. Pool ${formatMoneyExact(month.indirectPool)}.`}
            columns={PERSON_COLUMNS}
            rows={month.employees}
            rowKey={(row) => row.employeeNo}
            exportFilename={`cost-rates-${month.year}-${String(month.month).padStart(2, '0')}.csv`}
            footer={{
              employee: 'Total',
              salary: formatMoneyExact(month.salaryTotal),
              totalHours: formatHoursPlain(month.totalHours),
              billableHours: formatHoursPlain(month.billableHours),
              nonBillableHours: formatHoursPlain(month.totalHours - month.billableHours),
              nonBillableValue: formatMoneyExact(month.nonBillableCost),
            }}
          />
        ))}
      </div>
    </>
  );
}

const MONTH_COLUMNS: Column<MonthlyRates>[] = [
  { key: 'month', header: 'Month', value: (row) => periodLabel(row.year, row.month) },
  {
    key: 'salaries',
    header: 'Salaries',
    align: 'right',
    value: (row) => round(row.salaryTotal),
    render: (row) => formatMoney(row.salaryTotal),
  },
  {
    key: 'overhead',
    header: 'Overhead',
    align: 'right',
    value: (row) => round(row.overhead),
    render: (row) => formatMoney(row.overhead),
  },
  {
    key: 'unlogged',
    header: 'Unlogged salaries',
    align: 'right',
    value: (row) => round(row.unloggedSalaryCost),
    render: (row) => formatMoney(row.unloggedSalaryCost),
  },
  {
    key: 'nonBillable',
    header: 'Internal time',
    align: 'right',
    value: (row) => round(row.nonBillableCost),
    render: (row) => formatMoney(row.nonBillableCost),
  },
  {
    key: 'pool',
    header: 'Indirect pool',
    align: 'right',
    value: (row) => round(row.indirectPool),
    render: (row) => <span className="font-medium">{formatMoney(row.indirectPool)}</span>,
  },
  {
    key: 'totalHours',
    header: 'Hours',
    align: 'right',
    value: (row) => round(row.totalHours),
    render: (row) => formatHoursPlain(row.totalHours),
  },
  {
    key: 'billableHours',
    header: 'Billable',
    align: 'right',
    value: (row) => round(row.billableHours),
    render: (row) => formatHoursPlain(row.billableHours),
  },
  {
    key: 'indirectRate',
    header: 'Indirect rate',
    align: 'right',
    value: (row) => round(row.indirectRate),
    render: (row) => <span className="font-medium">{formatRate(row.indirectRate)}</span>,
  },
];

const PERSON_COLUMNS: Column<EmployeeMonthRate>[] = [
  {
    key: 'employee',
    header: 'Person',
    value: (row) => row.employeeName,
    render: (row) => (
      <span className="flex items-center gap-2">
        <span className="font-medium">{row.employeeName}</span>
        {row.hasSalaryRecord ? null : (
          <span className="rounded bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-medium text-amber-700">
            no salary row
          </span>
        )}
      </span>
    ),
  },
  {
    key: 'salary',
    header: 'Salary',
    align: 'right',
    value: (row) => round(row.salary),
    render: (row) => formatMoney(row.salary),
  },
  {
    key: 'totalHours',
    header: 'Hours logged',
    align: 'right',
    value: (row) => round(row.totalHours),
    render: (row) => formatHoursPlain(row.totalHours),
  },
  {
    key: 'directRate',
    header: 'Direct rate',
    align: 'right',
    value: (row) => round(row.directRate),
    render: (row) => <span className="font-medium">{formatRate(row.directRate)}</span>,
  },
  {
    key: 'billableHours',
    header: 'Billable',
    align: 'right',
    value: (row) => round(row.billableHours),
    render: (row) => formatHoursPlain(row.billableHours),
  },
  {
    key: 'nonBillableHours',
    header: 'Internal',
    align: 'right',
    value: (row) => round(row.nonBillableHours),
    render: (row) => (
      <span className="text-muted-foreground">{formatHoursPlain(row.nonBillableHours)}</span>
    ),
  },
  {
    key: 'nonBillableValue',
    header: 'Into the pool',
    align: 'right',
    value: (row) => round(row.nonBillableValue),
    render: (row) => formatMoney(row.nonBillableValue),
  },
];
