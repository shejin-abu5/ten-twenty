import { PeriodFilter } from '@/components/filters/period-filter';
import { MagnitudeBar } from '@/components/ui-kit/bars';
import { DataTable, type Column } from '@/components/ui-kit/data-table';
import { NoDataState } from '@/components/ui-kit/empty-state';
import { PageHeader } from '@/components/ui-kit/page-header';
import { StatCard, StatGrid } from '@/components/ui-kit/stat-card';
import { Badge } from '@/components/ui/badge';
import {
  availableMonths,
  availableYears,
  categoryBreakdown,
  employeeCategoryMatrix,
  filterEntries,
  summarise,
  type CategoryBreakdown,
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

export default async function CategoriesPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const model = getCostModel();
  if (model.entries.length === 0) {
    return (
      <>
        <PageHeader title="Categories" />
        <NoDataState />
      </>
    );
  }

  const years = availableYears(model);
  const filter = resolvePeriod(await searchParams, years);
  const rows = categoryBreakdown(model, filter);
  const totals = summarise(filterEntries(model, filter));
  const matrix = employeeCategoryMatrix(model, filter);
  const max = rows[0]?.hours ?? 0;
  const biggestInternal = rows.find((row) => !row.isBillable);

  return (
    <>
      <PageHeader
        eyebrow={describeFilter(filter)}
        title="Categories"
        description="Where the time actually goes. Billable categories are the ones charged to a project; everything else is absorbed by the agency."
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
          No hours were logged in {describeFilter(filter)}.
        </div>
      ) : (
        <div className="space-y-6">
          <StatGrid>
            <StatCard label="Total hours" value={formatHoursPlain(totals.totalHours)} />
            <StatCard label="Billable" value={formatHoursPlain(totals.billableHours)} hint={formatPercent(totals.productivity)} />
            <StatCard label="Internal" value={formatHoursPlain(totals.nonBillableHours)} hint={`${rows.filter((r) => !r.isBillable).length} categories`} />
            <StatCard
              label="Biggest internal drain"
              value={biggestInternal?.category ?? '—'}
              hint={biggestInternal ? formatHoursPlain(biggestInternal.hours) + ' h' : undefined}
            />
            <StatCard label="Categories in use" value={String(rows.length)} />
          </StatGrid>

          <section className="rounded-lg border bg-background">
            <div className="border-b px-4 py-3">
              <h2 className="text-sm font-semibold tracking-tight">Hours per category</h2>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Solid bars are billable work; faded bars are time the agency absorbs.
              </p>
            </div>
            <div className="px-4 py-3">
              {rows.map((row) => (
                <MagnitudeBar
                  key={row.category}
                  label={row.category}
                  value={row.hours}
                  max={max}
                  amount={formatHoursPlain(row.hours)}
                  share={formatPercent(row.shareOfHours, 0)}
                  muted={!row.isBillable}
                />
              ))}
            </div>
          </section>

          <DataTable
            title="Category detail"
            description="Charged is what reached a project. Absorbed is the salary value of internal time — it is already inside the charged column through the indirect rate, which is why the two are never added together."
            columns={COLUMNS}
            rows={rows}
            rowKey={(row) => row.category}
            exportFilename={`categories-${filter.year ?? 'all'}${filter.month ? `-${filter.month}` : ''}.csv`}
            footer={{
              category: 'Total',
              hours: formatHoursPlain(totals.totalHours),
              share: '100%',
              chargedCost: formatMoney(rows.reduce((total, row) => total + row.chargedCost, 0)),
              absorbedCost: formatMoney(rows.reduce((total, row) => total + row.absorbedCost, 0)),
            }}
          />

          <DataTable
            title="Person by category"
            description="The pivot the finance team builds by hand. Hours only."
            columns={matrixColumns(matrix.categories)}
            rows={matrix.rows}
            rowKey={(row) => row.employeeNo}
            exportFilename={`person-by-category-${filter.year ?? 'all'}.csv`}
            footer={{
              employee: 'Total',
              total: formatHoursPlain(matrix.grandTotal),
              ...Object.fromEntries(
                matrix.categories.map((category, index) => [
                  `c${index}`,
                  formatHoursPlain(matrix.columnTotals[index]),
                ]),
              ),
            }}
          />
        </div>
      )}
    </>
  );
}

const COLUMNS: Column<CategoryBreakdown>[] = [
  {
    key: 'category',
    header: 'Category',
    value: (row) => row.category,
    render: (row) => (
      <span className="flex items-center gap-2">
        <span className="font-medium">{row.category}</span>
        {row.isBillable ? (
          <Badge variant="secondary" className="h-5 px-1.5 text-[10px] font-medium">
            Billable
          </Badge>
        ) : null}
      </span>
    ),
  },
  { key: 'people', header: 'People', align: 'right', value: (row) => row.people },
  {
    key: 'hours',
    header: 'Hours',
    align: 'right',
    value: (row) => round(row.hours),
    render: (row) => formatHoursPlain(row.hours),
  },
  {
    key: 'share',
    header: 'Share of time',
    align: 'right',
    value: (row) => percentValue(row.shareOfHours),
    render: (row) => formatPercent(row.shareOfHours),
  },
  {
    key: 'chargedCost',
    header: 'Charged to projects',
    align: 'right',
    value: (row) => round(row.chargedCost),
    render: (row) =>
      row.isBillable ? (
        formatMoney(row.chargedCost)
      ) : (
        <span className="text-muted-foreground">—</span>
      ),
  },
  {
    key: 'absorbedCost',
    header: 'Absorbed',
    align: 'right',
    value: (row) => round(row.absorbedCost),
    render: (row) =>
      row.isBillable ? (
        <span className="text-muted-foreground">—</span>
      ) : (
        formatMoney(row.absorbedCost)
      ),
  },
];

type MatrixRow = ReturnType<typeof employeeCategoryMatrix>['rows'][number];

function matrixColumns(categories: string[]): Column<MatrixRow>[] {
  return [
    {
      key: 'employee',
      header: 'Person',
      value: (row) => row.employeeName,
      render: (row) => (
        <div className="min-w-0">
          <p className="truncate font-medium">{row.employeeName}</p>
          <p className="truncate text-xs text-muted-foreground">{row.department ?? row.employeeNo}</p>
        </div>
      ),
    },
    ...categories.map<Column<MatrixRow>>((category, index) => ({
      key: `c${index}`,
      header: category,
      align: 'right' as const,
      value: (row) => round(row.hours[index], 1),
      render: (row) =>
        row.hours[index] > 0 ? (
          formatHoursPlain(row.hours[index])
        ) : (
          <span className="text-muted-foreground/50">—</span>
        ),
    })),
    {
      key: 'total',
      header: 'Total',
      align: 'right',
      value: (row) => round(row.total),
      render: (row) => <span className="font-medium">{formatHoursPlain(row.total)}</span>,
    },
  ];
}
