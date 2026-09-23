import { PeriodFilter } from '@/components/filters/period-filter';
import { DataTable, type Column } from '@/components/ui-kit/data-table';
import { NoDataState } from '@/components/ui-kit/empty-state';
import { PageHeader } from '@/components/ui-kit/page-header';
import { StatCard, StatGrid } from '@/components/ui-kit/stat-card';
import {
  availableMonths,
  availableYears,
  employeeProductivity,
  filterEntries,
  summarise,
  type EmployeeProductivity,
} from '@/lib/domain/aggregate';
import { describeFilter } from '@/lib/domain/period';
import {
  formatHoursPlain,
  formatMoney,
  formatPercent,
  percentValue,
  round,
} from '@/lib/format';
import { getCostModel } from '@/lib/model';
import { resolvePeriod, type SearchParams } from '@/lib/period-params';

export default async function ProductivityPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const model = getCostModel();
  if (model.entries.length === 0) {
    return (
      <>
        <PageHeader title="Productivity" />
        <NoDataState />
      </>
    );
  }

  const years = availableYears(model);
  const filter = resolvePeriod(await searchParams, years);
  const rows = employeeProductivity(model, filter);
  const totals = summarise(filterEntries(model, filter));

  const fullyInternal = rows.filter((row) => row.billableHours === 0);
  const median = medianProductivity(rows);

  return (
    <>
      <PageHeader
        eyebrow={describeFilter(filter)}
        title="Productivity"
        description="Billable hours divided by total hours logged, per person. Leave, meetings, learning and idle time all count against it."
        actions={
          <PeriodFilter
            year={filter.year}
            month={filter.month}
            years={years}
            months={availableMonths(model, filter.year)}
          />
        }
      />

      {rows.length === 0 ? (
        <div className="rounded-lg border border-dashed bg-background px-6 py-16 text-center text-sm text-muted-foreground">
          Nobody logged hours in {describeFilter(filter)}.
        </div>
      ) : (
        <div className="space-y-6">
          <StatGrid>
            <StatCard label="People logging time" value={String(rows.length)} />
            <StatCard label="Agency productivity" value={formatPercent(totals.productivity)} hint="Billable ÷ total hours" />
            <StatCard label="Median person" value={formatPercent(median)} />
            <StatCard label="Billable hours" value={formatHoursPlain(totals.billableHours)} />
            <StatCard
              label="Never billable"
              value={String(fullyInternal.length)}
              hint={
                fullyInternal.length > 0
                  ? fullyInternal.map((row) => row.employeeName).join(', ')
                  : 'Everyone touched a client project'
              }
            />
          </StatGrid>

          <DataTable
            title="By person"
            description="Sorted by productivity. Cost is what their billable hours charged to projects; internal time sits in the indirect pool instead."
            columns={COLUMNS}
            rows={rows}
            rowKey={(row) => row.employeeNo}
            exportFilename={`productivity-${filter.year ?? 'all'}${filter.month ? `-${filter.month}` : ''}.csv`}
            footer={{
              employee: 'Total',
              total: formatHoursPlain(totals.totalHours),
              billable: formatHoursPlain(totals.billableHours),
              nonBillable: formatHoursPlain(totals.nonBillableHours),
              productivity: formatPercent(totals.productivity),
              cost: formatMoney(totals.cost),
            }}
          />
        </div>
      )}
    </>
  );
}

const COLUMNS: Column<EmployeeProductivity>[] = [
  {
    key: 'employee',
    header: 'Person',
    value: (row) => row.employeeName,
    render: (row) => (
      <div className="min-w-0">
        <p className="truncate font-medium">{row.employeeName}</p>
        <p className="truncate text-xs text-muted-foreground">
          {[row.department, row.designation].filter(Boolean).join(' · ') || row.employeeNo}
        </p>
      </div>
    ),
  },
  {
    key: 'total',
    header: 'Total hours',
    align: 'right',
    value: (row) => round(row.totalHours),
    render: (row) => formatHoursPlain(row.totalHours),
  },
  {
    key: 'billable',
    header: 'Billable',
    align: 'right',
    value: (row) => round(row.billableHours),
    render: (row) => formatHoursPlain(row.billableHours),
  },
  {
    key: 'nonBillable',
    header: 'Internal',
    align: 'right',
    value: (row) => round(row.nonBillableHours),
    render: (row) => (
      <span className="text-muted-foreground">{formatHoursPlain(row.nonBillableHours)}</span>
    ),
  },
  {
    key: 'productivity',
    header: 'Productivity',
    align: 'right',
    headerClassName: 'w-[11rem]',
    value: (row) => percentValue(row.productivity),
    render: (row) => (
      <span className="flex items-center justify-end gap-2.5">
        <span className="hidden h-2 w-20 rounded-full bg-muted sm:block" aria-hidden>
          <span
            className="block h-full rounded-full bg-foreground/80"
            style={{ width: `${(row.productivity ?? 0) * 100}%` }}
          />
        </span>
        <span className="w-14 text-right">{formatPercent(row.productivity)}</span>
      </span>
    ),
  },
  {
    key: 'cost',
    header: 'Cost to projects',
    align: 'right',
    value: (row) => round(row.cost),
    render: (row) => formatMoney(row.cost),
  },
  {
    key: 'revenue',
    header: 'Revenue earned',
    align: 'right',
    value: (row) => round(row.revenue),
    render: (row) => formatMoney(row.revenue),
  },
];

function medianProductivity(rows: EmployeeProductivity[]): number | null {
  const values = rows
    .map((row) => row.productivity)
    .filter((value): value is number => value !== null)
    .sort((a, b) => a - b);

  if (values.length === 0) return null;
  const middle = Math.floor(values.length / 2);
  return values.length % 2 === 0 ? (values[middle - 1] + values[middle]) / 2 : values[middle];
}
