import Link from 'next/link';
import { PeriodFilter } from '@/components/filters/period-filter';
import { DataTable, type Column } from '@/components/ui-kit/data-table';
import { NoDataState } from '@/components/ui-kit/empty-state';
import { PageHeader } from '@/components/ui-kit/page-header';
import {
  availableMonths,
  availableYears,
  departmentBreakdown,
  filterEntries,
  summarise,
  type DepartmentBreakdown,
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
import { periodQuery, resolvePeriod, type SearchParams } from '@/lib/period-params';

export default async function DepartmentsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const model = getCostModel();
  if (model.entries.length === 0) {
    return (
      <>
        <PageHeader title="Departments" />
        <NoDataState />
      </>
    );
  }

  const years = availableYears(model);
  const filter = resolvePeriod(await searchParams, years);
  const entries = filterEntries(model, filter);
  const rows = departmentBreakdown(entries);
  const totals = summarise(entries);

  return (
    <>
      <PageHeader
        eyebrow={describeFilter(filter)}
        title="Departments"
        description="Click a department to see the hours and cost of every person in it."
        actions={
          <PeriodFilter
            year={filter.year}
            month={filter.month}
            years={years}
            months={availableMonths(model, filter.year)}
          />
        }
      />

      <DataTable
        columns={columns(periodQuery(filter))}
        rows={rows}
        rowKey={(row) => row.department}
        title="All departments"
        description="Cost is what that department's billable hours charged to projects. Internal time is not lost; it sits in the monthly indirect pool that every billable hour carries."
        exportFilename={`departments-${filter.year ?? 'all'}${filter.month ? `-${filter.month}` : ''}.csv`}
        footer={{
          department: 'Total',
          headcount: rows.reduce((total, row) => total + row.headcount, 0),
          hours: formatHoursPlain(totals.totalHours),
          billable: formatHoursPlain(totals.billableHours),
          productivity: formatPercent(totals.productivity),
          cost: formatMoney(totals.cost),
          revenue: formatMoney(totals.revenue),
        }}
      />
    </>
  );
}

function columns(query: string): Column<DepartmentBreakdown>[] {
  return [
    {
      key: 'department',
      header: 'Department',
      value: (row) => row.department,
      render: (row) => (
        <Link
          href={`/departments/${encodeURIComponent(row.department)}${query}`}
          className="font-medium underline-offset-4 hover:underline"
        >
          {row.department}
        </Link>
      ),
    },
    { key: 'headcount', header: 'People', align: 'right', value: (row) => row.headcount },
    {
      key: 'hours',
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
      key: 'productivity',
      header: 'Billable %',
      align: 'right',
      value: (row) => percentValue(row.productivity),
      render: (row) => formatPercent(row.productivity),
    },
    {
      key: 'cost',
      header: 'Cost',
      align: 'right',
      value: (row) => round(row.cost),
      render: (row) => formatMoney(row.cost),
    },
    {
      key: 'revenue',
      header: 'Revenue',
      align: 'right',
      value: (row) => round(row.revenue),
      render: (row) => formatMoney(row.revenue),
    },
  ];
}
