import Link from 'next/link';
import { Banknote, FolderKanban, Percent, ReceiptText, Wallet } from 'lucide-react';
import { PeriodFilter } from '@/components/filters/period-filter';
import { MarginBar } from '@/components/ui-kit/bars';
import { DataTable, type Column } from '@/components/ui-kit/data-table';
import { NoDataState } from '@/components/ui-kit/empty-state';
import { PageHeader } from '@/components/ui-kit/page-header';
import { StatCard, StatGrid } from '@/components/ui-kit/stat-card';
import {
  availableMonths,
  availableYears,
  projectSummaries,
  type ProjectSummary,
} from '@/lib/domain/aggregate';
import { describeFilter } from '@/lib/domain/period';
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
import { periodQuery, resolvePeriod, type SearchParams } from '@/lib/period-params';
import { cn } from '@/lib/utils';

export default async function ProjectsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const model = getCostModel();
  if (model.entries.length === 0) {
    return (
      <>
        <PageHeader title="Projects" />
        <NoDataState />
      </>
    );
  }

  const years = availableYears(model);
  const filter = resolvePeriod(await searchParams, years);
  const query = periodQuery(filter);
  const summaries = projectSummaries(model, filter);

  const contracted = summaries.reduce((total, row) => total + (row.project.price ?? 0), 0);
  const revenue = summaries.reduce((total, row) => total + row.revenue, 0);
  const cost = summaries.reduce((total, row) => total + row.cost, 0);
  const losing = summaries.filter((row) => row.margin !== null && row.margin < 0).length;

  return (
    <>
      <PageHeader
        eyebrow={describeFilter(filter)}
        title="Projects"
        description="Every ref code the timesheet touches, plus any priced project with no hours against it."
        actions={
          <PeriodFilter
            year={filter.year}
            month={filter.month}
            years={years}
            months={availableMonths(model, filter.year)}
          />
        }
      />

      <div className="space-y-10">
        <StatGrid>
          <StatCard icon={FolderKanban} label="Projects" value={String(summaries.length)} hint={`${losing} losing money`} />
          <StatCard icon={ReceiptText} label="Contracted value" value={formatMoney(contracted)} hint="Across all loaded periods" />
          <StatCard icon={Banknote} label="Revenue in period" value={formatMoney(revenue)} />
          <StatCard icon={Wallet} label="Cost in period" value={formatMoney(cost)} />
          <StatCard
            icon={Percent}
            label="Margin in period"
            value={formatPercent(revenue > 0 ? (revenue - cost) / revenue : null)}
            tone={emphaticToneOf(revenue > 0 ? (revenue - cost) / revenue : null)}
          />
        </StatGrid>

        <DataTable
          columns={columns(query)}
          rows={summaries}
          rowKey={(row) => row.project.refCode}
          title="All projects"
          description="Price is the whole contract. Hours, cost and revenue are for the selected period."
          exportFilename={`projects-${filter.year ?? 'all'}${filter.month ? `-${filter.month}` : ''}.csv`}
        />
      </div>
    </>
  );
}

function columns(query: string): Column<ProjectSummary>[] {
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
    {
      key: 'category',
      header: 'Type',
      value: (row) => row.project.category ?? '',
      render: (row) => <span className="text-muted-foreground">{row.project.category ?? '—'}</span>,
    },
    {
      key: 'status',
      header: 'Status',
      value: (row) => row.project.status ?? '',
      render: (row) => <span className="text-muted-foreground">{row.project.status ?? '—'}</span>,
    },
    {
      key: 'price',
      header: 'Price',
      align: 'right',
      value: (row) => row.project.price,
      render: (row) =>
        row.project.price == null ? (
          <span className="text-muted-foreground">Not priced</span>
        ) : (
          formatMoney(row.project.price)
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
      header: 'Revenue',
      align: 'right',
      value: (row) => round(row.revenue),
      render: (row) => formatMoney(row.revenue),
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
      key: 'margin',
      header: 'Margin',
      align: 'right',
      headerClassName: 'w-[9.5rem]',
      value: (row) => percentValue(row.margin),
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
