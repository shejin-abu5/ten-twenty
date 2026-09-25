import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, Banknote, Clock, Gauge, Users, Wallet } from 'lucide-react';
import { PeriodFilter } from '@/components/filters/period-filter';
import { DataTable, type Column } from '@/components/ui-kit/data-table';
import { NoDataState, PeriodEmpty } from '@/components/ui-kit/empty-state';
import { PageHeader } from '@/components/ui-kit/page-header';
import { StatCard, StatGrid } from '@/components/ui-kit/stat-card';
import {
  availableMonths,
  availableYears,
  employeeProductivity,
  filterEntries,
  projectRollup,
  summarise,
  type EmployeeProductivity,
  type ProjectRollup,
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

export default async function DepartmentPage({
  params,
  searchParams,
}: {
  params: Promise<{ name: string }>;
  searchParams: Promise<SearchParams>;
}) {
  const model = getCostModel();
  if (model.entries.length === 0) {
    return (
      <>
        <PageHeader title="Department" />
        <NoDataState />
      </>
    );
  }

  const [{ name }, rawSearch] = await Promise.all([params, searchParams]);
  const department = decodeURIComponent(name);
  if (!model.departments.includes(department)) notFound();

  const years = availableYears(model);
  const filter = resolvePeriod(rawSearch, years);
  const query = periodQuery(filter);

  const entries = filterEntries(model, filter).filter((entry) => entry.department === department);
  const people = employeeProductivity(model, filter).filter(
    (row) => row.department === department,
  );
  const totals = summarise(entries);
  const projects = projectRollup(entries);

  return (
    <>
      <Link
        href={`/departments${query}`}
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-3.5" aria-hidden />
        All departments
      </Link>

      <PageHeader
        eyebrow={describeFilter(filter)}
        title={department}
        description={`${people.length} ${people.length === 1 ? 'person' : 'people'} logging time in this period.`}
        actions={
          <PeriodFilter
            year={filter.year}
            month={filter.month}
            years={years}
            months={availableMonths(model, filter.year)}
          />
        }
      />

      {entries.length === 0 ? (
        <PeriodEmpty>
          Nobody in {department} logged hours in {describeFilter(filter)}.
        </PeriodEmpty>
      ) : (
        <div className="space-y-10">
          <StatGrid>
            <StatCard icon={Users} label="People" value={String(people.length)} />
            <StatCard icon={Clock} label="Total hours" value={formatHoursPlain(totals.totalHours)} />
            <StatCard icon={Gauge} label="Billable %" value={formatPercent(totals.productivity)} hint={`${formatHoursPlain(totals.billableHours)} h billable`} />
            <StatCard icon={Wallet} label="Cost to projects" value={formatMoney(totals.cost)} />
            <StatCard icon={Banknote} label="Revenue earned" value={formatMoney(totals.revenue)} />
          </StatGrid>

          <DataTable
            title="People"
            columns={PEOPLE_COLUMNS}
            rows={people}
            rowKey={(row) => row.employeeNo}
            exportFilename={`department-${department}-people.csv`}
            footer={{
              employee: 'Total',
              total: formatHoursPlain(totals.totalHours),
              billable: formatHoursPlain(totals.billableHours),
              productivity: formatPercent(totals.productivity),
              cost: formatMoney(totals.cost),
            }}
          />

          <DataTable
            title="What they worked on"
            description="Billable hours this department put into each project."
            columns={projectColumns(query)}
            rows={projects}
            rowKey={(row) => row.refCode}
            exportFilename={`department-${department}-projects.csv`}
            empty={
              <p className="px-4 py-10 text-center text-sm text-muted-foreground">
                This department logged no billable hours in {describeFilter(filter)}.
              </p>
            }
          />
        </div>
      )}
    </>
  );
}

const PEOPLE_COLUMNS: Column<EmployeeProductivity>[] = [
  {
    key: 'employee',
    header: 'Person',
    value: (row) => row.employeeName,
    render: (row) => (
      <div className="min-w-0">
        <p className="truncate font-medium">{row.employeeName}</p>
        <p className="truncate text-xs text-muted-foreground">
          {row.designation ?? row.employeeNo}
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

function projectColumns(query: string): Column<ProjectRollup>[] {
  return [
    {
      key: 'ref',
      header: 'Ref code',
      value: (row) => row.refCode,
      render: (row) => (
        <Link
          href={`/projects/${encodeURIComponent(row.refCode)}${query}`}
          className="font-medium underline-offset-4 hover:underline"
        >
          {row.refCode}
        </Link>
      ),
    },
    {
      key: 'name',
      header: 'Project',
      value: (row) => row.name ?? '',
      render: (row) => (
        <span className="block max-w-[28rem] truncate text-muted-foreground" title={row.name ?? ''}>
          {row.name ?? '—'}
        </span>
      ),
    },
    {
      key: 'hours',
      header: 'Hours',
      align: 'right',
      value: (row) => round(row.hours),
      render: (row) => formatHoursPlain(row.hours),
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
