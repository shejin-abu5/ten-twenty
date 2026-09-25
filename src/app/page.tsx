import Link from 'next/link';
import { Banknote, Clock, Percent, Timer, TrendingDown, TrendingUp, Wallet, type LucideIcon } from 'lucide-react';
import { PeriodFilter } from '@/components/filters/period-filter';
import { DataTable, type Column } from '@/components/ui-kit/data-table';
import { GapsPanel, ReconciliationNote } from '@/components/ui-kit/data-health';
import { MarginBar } from '@/components/ui-kit/bars';
import { NoDataState, PeriodEmpty } from '@/components/ui-kit/empty-state';
import { PageHeader } from '@/components/ui-kit/page-header';
import { StatCard, StatGrid } from '@/components/ui-kit/stat-card';
import {
  availableMonths,
  availableYears,
  departmentBreakdown,
  filterEntries,
  monthlyPoints,
  projectSummaries,
  summarise,
  type DepartmentBreakdown,
  type MonthlyPoint,
  type ProjectSummary,
} from '@/lib/domain/aggregate';
import { describeFilter, monthName, periodLabel } from '@/lib/domain/period';
import {
  emphaticToneOf,
  formatHours,
  formatHoursPlain,
  formatMoney,
  formatPercent,
  percentValue,
  round,
  toneOf,
} from '@/lib/format';
import { getCostModel } from '@/lib/model';
import { periodQuery, resolvePeriod, type SearchParams } from '@/lib/period-params';
import { cn } from '@/lib/utils';

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const model = getCostModel();
  if (model.entries.length === 0) {
    return (
      <>
        <PageHeader title="Dashboard" description="Did we actually make money on that project?" />
        <NoDataState />
      </>
    );
  }

  const years = availableYears(model);
  const filter = resolvePeriod(await searchParams, years);
  const entries = filterEntries(model, filter);
  const totals = summarise(entries);
  const query = periodQuery(filter);

  const projects = projectSummaries(model, filter).filter((summary) => summary.hours > 0);
  const departments = departmentBreakdown(entries);
  const months = monthlyPoints(entries);

  const best = [...projects].sort((a, b) => (b.margin ?? -Infinity) - (a.margin ?? -Infinity))[0];
  const worst = [...projects].sort((a, b) => (a.margin ?? Infinity) - (b.margin ?? Infinity))[0];

  return (
    <>
      <PageHeader
        eyebrow={describeFilter(filter)}
        title="Dashboard"
        description="Revenue is each project's price spread across the hours worked on it, so cost and revenue land in the same month."
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
          No hours were logged in this period. Pick another month, or upload the timesheet for{' '}
          {describeFilter(filter)}.
        </PeriodEmpty>
      ) : (
        <div className="space-y-10">
          <StatGrid>
            <StatCard
              icon={Clock}
              label="Total hours"
              value={formatHoursPlain(totals.totalHours)}
              hint={`${formatPercent(totals.productivity)} of it billable`}
            />
            <StatCard icon={Timer} label="Billable hours" value={formatHoursPlain(totals.billableHours)} hint={`${formatHoursPlain(totals.nonBillableHours)} h internal`} />
            <StatCard icon={Wallet} label="Cost" value={formatMoney(totals.cost)} hint="Salaries and overhead charged to billable work" />
            <StatCard icon={Banknote} label="Revenue" value={formatMoney(totals.revenue)} hint="Contract value earned in this period" />
            <StatCard
              icon={Percent}
              label="Margin"
              value={formatPercent(totals.margin)}
              tone={emphaticToneOf(totals.margin)}
              hint={`${formatMoney(totals.profit)} profit`}
              shimmer
            />
          </StatGrid>

          <div className="grid items-start gap-4 lg:grid-cols-2">
            <ReconciliationNote check={model.reconciliation} />
            <GapsPanel gaps={model.gaps} />
          </div>

          {best && worst && best !== worst ? (
            <div className="grid gap-4 sm:grid-cols-2">
              <HighlightCard heading="Best margin" icon={TrendingUp} summary={best} query={query} />
              <HighlightCard heading="Worst margin" icon={TrendingDown} summary={worst} query={query} />
            </div>
          ) : null}

          <DataTable
            title="Projects"
            description="Sorted by margin. Cost includes each person's share of the month's indirect pool."
            columns={projectColumns(query)}
            rows={[...projects].sort((a, b) => (a.margin ?? Infinity) - (b.margin ?? Infinity))}
            rowKey={(row) => row.project.refCode}
            exportFilename={`projects-${filter.year ?? 'all'}.csv`}
            footer={{
              ref: 'Total',
              hours: formatHoursPlain(projects.reduce((t, p) => t + p.hours, 0)),
              revenue: formatMoney(projects.reduce((t, p) => t + p.revenue, 0)),
              cost: formatMoney(projects.reduce((t, p) => t + p.cost, 0)),
              profit: formatMoney(projects.reduce((t, p) => t + p.profit, 0)),
            }}
          />

          <div className={cn('grid items-start gap-10', filter.month === null && 'xl:grid-cols-[1.35fr_1fr]')}>
            {filter.month === null ? (
              <DataTable
                title="Month by month"
                description="Cost against the revenue those hours earned."
                columns={MONTH_COLUMNS}
                rows={months}
                rowKey={(row) => `${row.year}-${row.month}`}
                exportFilename={`monthly-${filter.year ?? 'all'}.csv`}
              />
            ) : null}

            <DataTable
              title="Departments"
              description="Cost is what reached billable work, so a department that never touches a client project shows zero and sits inside the indirect pool instead."
              columns={departmentColumns(query)}
              rows={departments}
              rowKey={(row) => row.department}
              exportFilename={`departments-${filter.year ?? 'all'}.csv`}
            />
          </div>
        </div>
      )}
    </>
  );
}

function HighlightCard({
  heading,
  icon: Icon,
  summary,
  query,
}: {
  heading: string;
  icon: LucideIcon;
  summary: ProjectSummary;
  query: string;
}) {
  return (
    <Link
      href={`/projects/${encodeURIComponent(summary.project.refCode)}${query}`}
      className="group flex min-w-0 items-end justify-between gap-4 rounded-lg border px-5 py-4 transition-colors duration-150 hover:bg-muted"
    >
      <div className="min-w-0">
        <p className="ledger-label flex items-center gap-1.5">
          <Icon
            aria-hidden
            strokeWidth={1.5}
            className={cn('size-4 shrink-0', emphaticToneOf(summary.margin))}
          />
          {heading}
        </p>
        <p className="mt-3 truncate text-sm font-medium underline-offset-4 group-hover:underline">
          {summary.project.name ?? summary.project.refCode}
        </p>
        <p className="num mt-1.5 truncate text-xs text-muted-foreground">
          {summary.project.refCode} · {formatHours(summary.hours)} · {formatMoney(summary.revenue)}{' '}
          revenue
        </p>
      </div>
      <p
        className={cn(
          'num num-shimmer shrink-0 text-2xl font-medium leading-none',
          emphaticToneOf(summary.margin),
        )}
      >
        {formatPercent(summary.margin)}
      </p>
    </Link>
  );
}

function projectColumns(query: string): Column<ProjectSummary>[] {
  return [
    {
      key: 'ref',
      header: 'Ref code',
      value: (row) => row.project.refCode,
      render: (row) => (
        <Link
          href={`/projects/${encodeURIComponent(row.project.refCode)}${query}`}
          className="font-medium underline-offset-4 hover:underline"
        >
          {row.project.refCode}
        </Link>
      ),
    },
    {
      // Status lives on the Projects page. Here the question is only whether
      // the work made money, so the column would be paid for in margin.
      key: 'name',
      header: 'Project',
      value: (row) => row.project.name ?? '',
      render: (row) => (
        <span
          className="block max-w-[24rem] truncate text-muted-foreground"
          title={row.project.name ?? ''}
        >
          {row.project.name ?? '—'}
        </span>
      ),
    },
    { key: 'hours', header: 'Hours', align: 'right', value: (row) => round(row.hours), render: (row) => formatHoursPlain(row.hours) },
    { key: 'revenue', header: 'Revenue', align: 'right', value: (row) => round(row.revenue), render: (row) => formatMoney(row.revenue) },
    { key: 'cost', header: 'Cost', align: 'right', value: (row) => round(row.cost), render: (row) => formatMoney(row.cost) },
    {
      key: 'profit',
      header: 'Profit',
      align: 'right',
      value: (row) => round(row.profit),
      render: (row) => <span className={toneOf(row.profit)}>{formatMoney(row.profit)}</span>,
    },
    {
      key: 'margin',
      header: 'Margin',
      align: 'right',
      value: (row) => percentValue(row.margin),
      headerClassName: 'w-[9.5rem]',
      render: (row) => (
        <span className="flex items-center justify-end gap-2.5">
          <span className="hidden w-16 sm:block">
            <MarginBar margin={row.margin} />
          </span>
          <span className={cn('w-14 text-right', toneOf(row.margin))}>
            {formatPercent(row.margin)}
          </span>
        </span>
      ),
    },
  ];
}

const MONTH_COLUMNS: Column<MonthlyPoint>[] = [
  { key: 'month', header: 'Month', value: (row) => periodLabel(row.year, row.month), render: (row) => monthName(row.month) },
  { key: 'hours', header: 'Hours', align: 'right', value: (row) => round(row.totalHours), render: (row) => formatHoursPlain(row.totalHours) },
  { key: 'billable', header: 'Billable', align: 'right', value: (row) => round(row.billableHours), render: (row) => formatHoursPlain(row.billableHours) },
  {
    key: 'productivity',
    header: 'Billable %',
    align: 'right',
    value: (row) => (row.totalHours > 0 ? percentValue(row.billableHours / row.totalHours) : null),
    render: (row) => formatPercent(row.totalHours > 0 ? row.billableHours / row.totalHours : null),
  },
  { key: 'cost', header: 'Cost', align: 'right', value: (row) => round(row.cost), render: (row) => formatMoney(row.cost) },
  { key: 'revenue', header: 'Revenue', align: 'right', value: (row) => round(row.revenue), render: (row) => formatMoney(row.revenue) },
  {
    key: 'margin',
    header: 'Margin',
    align: 'right',
    value: (row) => percentValue(row.margin),
    render: (row) => <span className={toneOf(row.margin)}>{formatPercent(row.margin)}</span>,
  },
];

function departmentColumns(query: string): Column<DepartmentBreakdown>[] {
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
    { key: 'hours', header: 'Hours', align: 'right', value: (row) => round(row.totalHours), render: (row) => formatHoursPlain(row.totalHours) },
    {
      key: 'productivity',
      header: 'Billable %',
      align: 'right',
      value: (row) => percentValue(row.productivity),
      render: (row) => formatPercent(row.productivity),
    },
    { key: 'cost', header: 'Cost', align: 'right', value: (row) => round(row.cost), render: (row) => formatMoney(row.cost) },
  ];
}
