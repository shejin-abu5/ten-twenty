import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, Clock, Coins, Percent, ReceiptText, Wallet } from 'lucide-react';
import { MarginBar } from '@/components/ui-kit/bars';
import { DataTable, type Column } from '@/components/ui-kit/data-table';
import { PageHeader } from '@/components/ui-kit/page-header';
import { StatCard, StatGrid } from '@/components/ui-kit/stat-card';
import {
  monthlyPoints,
  projectDetail,
  type DepartmentBreakdown,
  type EmployeeContribution,
  type MonthlyPoint,
} from '@/lib/domain/aggregate';
import { periodLabel } from '@/lib/domain/period';
import {
  emphaticToneOf,
  formatHoursPlain,
  formatMoney,
  formatPercent,
  percentValue,
  round,
  toneOf,
} from '@/lib/format';
import { getCostModel } from '@/lib/model';
import type { SearchParams } from '@/lib/period-params';
import { cn } from '@/lib/utils';

export default async function ProjectPage({
  params,
  searchParams,
}: {
  params: Promise<{ refCode: string }>;
  searchParams: Promise<SearchParams>;
}) {
  const [{ refCode }, query] = await Promise.all([params, searchParams]);
  const model = getCostModel();
  const detail = projectDetail(model, decodeURIComponent(refCode));
  if (!detail) notFound();

  const { project } = detail;
  const backQuery = new URLSearchParams(
    Object.entries(query).flatMap(([key, value]) =>
      typeof value === 'string' ? [[key, value] as [string, string]] : [],
    ),
  ).toString();

  return (
    <>
      <Link
        href={`/projects${backQuery ? `?${backQuery}` : ''}`}
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-3.5" aria-hidden />
        All projects
      </Link>

      <PageHeader
        eyebrow={`${project.refCode}${project.category ? ` · ${project.category}` : ''}${project.status ? ` · ${project.status}` : ''}`}
        title={project.name ?? project.refCode}
        description={
          project.salesMonth
            ? `Sold in ${periodLabel(project.salesYear ?? 0, project.salesMonth)}. Figures below cover the project's whole life, because the price does too.`
            : "Figures below cover the project's whole life, because the price does too."
        }
      />

      <div className="space-y-10">
        {project.price == null ? (
          <div className="flex items-start gap-3 rounded-lg border px-5 py-4 text-sm">
            <span className="mt-[7px] size-1.5 shrink-0 rounded-full bg-caution" aria-hidden />
            <div className="min-w-0">
              <p className="font-medium">This project has no price</p>
              <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
                {formatHoursPlain(detail.lifetimeHours)} hours have been costed at{' '}
                {formatMoney(detail.lifetimeCost)}, but there is nothing to measure it against. Add
                the ref code to the project price sheet and re-upload it.
              </p>
            </div>
          </div>
        ) : null}

        <StatGrid>
          <StatCard icon={ReceiptText} label="Price" value={formatMoney(project.price)} hint="Contracted value" />
          <StatCard icon={Clock} label="Hours" value={formatHoursPlain(detail.lifetimeHours)} hint={`${detail.byEmployee.length} people`} />
          <StatCard icon={Wallet} label="Cost" value={formatMoney(detail.lifetimeCost)} hint="Direct salary plus indirect share" />
          <StatCard
            icon={Coins}
            label="Profit"
            value={formatMoney(detail.lifetimeProfit)}
            tone={emphaticToneOf(detail.lifetimeProfit)}
          />
          <StatCard
            icon={Percent}
            label="Margin"
            value={formatPercent(detail.lifetimeMargin)}
            tone={emphaticToneOf(detail.lifetimeMargin)}
            hint={
              detail.lifetimeHours > 0
                ? `${formatMoney(detail.lifetimeCost / detail.lifetimeHours)} cost per hour worked`
                : undefined
            }
          />
        </StatGrid>

        <DataTable
          title="Who worked on it"
          description="Revenue share is the price split by hours, so each person's profitability is their slice of the deal against what they cost."
          columns={EMPLOYEE_COLUMNS}
          rows={detail.byEmployee}
          rowKey={(row) => row.employeeNo}
          exportFilename={`project-${project.refCode}-people.csv`}
          footer={{
            employee: 'Total',
            hours: formatHoursPlain(detail.lifetimeHours),
            revenue: formatMoney(detail.byEmployee.reduce((t, r) => t + r.revenueShare, 0)),
            cost: formatMoney(detail.lifetimeCost),
            profit: formatMoney(detail.lifetimeProfit),
            profitability: formatPercent(detail.lifetimeMargin),
          }}
        />

        <div className="grid items-start gap-6 xl:grid-cols-2">
          <DataTable
            title="Hours by department"
            columns={DEPARTMENT_COLUMNS}
            rows={detail.byDepartment}
            rowKey={(row) => row.department}
            exportFilename={`project-${project.refCode}-departments.csv`}
            footer={{
              department: 'Total',
              people: detail.byEmployee.length,
              hours: formatHoursPlain(detail.lifetimeHours),
              cost: formatMoney(detail.lifetimeCost),
              revenue: formatMoney(project.price),
            }}
          />
          <DataTable
            title="Month by month"
            columns={MONTH_COLUMNS}
            rows={monthlyPoints(detail.entries)}
            rowKey={(row) => `${row.year}-${row.month}`}
            exportFilename={`project-${project.refCode}-months.csv`}
          />
        </div>
      </div>
    </>
  );
}

const EMPLOYEE_COLUMNS: Column<EmployeeContribution>[] = [
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
    key: 'hours',
    header: 'Hours',
    align: 'right',
    value: (row) => round(row.hours),
    render: (row) => formatHoursPlain(row.hours),
  },
  {
    key: 'revenue',
    header: 'Revenue share',
    align: 'right',
    value: (row) => round(row.revenueShare),
    render: (row) => formatMoney(row.revenueShare),
  },
  {
    key: 'cost',
    header: 'Cost',
    align: 'right',
    value: (row) => round(row.cost),
    render: (row) => formatMoney(row.cost),
  },
  {
    key: 'profit',
    header: 'Profit',
    align: 'right',
    value: (row) => round(row.profit),
    render: (row) => <span className={toneOf(row.profit)}>{formatMoney(row.profit)}</span>,
  },
  {
    key: 'profitability',
    header: 'Profitability',
    align: 'right',
    headerClassName: 'w-[9.5rem]',
    value: (row) => percentValue(row.profitability),
    render: (row) => (
      <span className="flex items-center justify-end gap-2.5">
        <span className="hidden w-16 sm:block">
          <MarginBar margin={row.profitability} />
        </span>
        <span className={cn('w-14 text-right', toneOf(row.profitability))}>
          {formatPercent(row.profitability)}
        </span>
      </span>
    ),
  },
];

const DEPARTMENT_COLUMNS: Column<DepartmentBreakdown>[] = [
  { key: 'department', header: 'Department', value: (row) => row.department },
  { key: 'people', header: 'People', align: 'right', value: (row) => row.headcount },
  {
    key: 'hours',
    header: 'Hours',
    align: 'right',
    value: (row) => round(row.totalHours),
    render: (row) => formatHoursPlain(row.totalHours),
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

const MONTH_COLUMNS: Column<MonthlyPoint>[] = [
  {
    key: 'month',
    header: 'Month',
    value: (row) => periodLabel(row.year, row.month),
  },
  {
    key: 'hours',
    header: 'Hours',
    align: 'right',
    value: (row) => round(row.totalHours),
    render: (row) => formatHoursPlain(row.totalHours),
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
  {
    key: 'margin',
    header: 'Margin',
    align: 'right',
    value: (row) => percentValue(row.margin),
    render: (row) => <span className={toneOf(row.margin)}>{formatPercent(row.margin)}</span>,
  },
];
