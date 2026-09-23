import { DataTable, type Column } from '@/components/ui-kit/data-table';
import { GapsPanel } from '@/components/ui-kit/data-health';
import { PageHeader } from '@/components/ui-kit/page-header';
import { StatCard, StatGrid } from '@/components/ui-kit/stat-card';
import { hasData, listUploads, type UploadRecord } from '@/lib/db/repository';
import { monthAbbr } from '@/lib/domain/period';
import { DATASET_LABELS } from '@/lib/ingest/types';
import { formatCount, formatDateTime, formatHoursPlain } from '@/lib/format';
import { getCostModel } from '@/lib/model';
import { UploadForm } from './upload-form';

export default function UploadPage() {
  const model = getCostModel();
  const uploads = listUploads();
  const loaded = hasData();

  const totalHours = model.entries.reduce((total, entry) => total + entry.hours, 0);
  const people = new Set(model.entries.map((entry) => entry.employeeNo)).size;

  return (
    <>
      <PageHeader
        eyebrow="Working"
        title="Data"
        description="The three spreadsheets, how they were read, and what each upload changed."
      />

      <div className="space-y-6">
        {loaded ? (
          <>
            <StatGrid>
              <StatCard label="Timesheet rows" value={formatCount(model.entries.length)} />
              <StatCard label="Hours" value={formatHoursPlain(totalHours)} />
              <StatCard label="People" value={String(people)} />
              <StatCard label="Months" value={String(model.months.length)} />
              <StatCard label="Projects priced" value={String(model.projects.length)} />
            </StatGrid>
            <GapsPanel gaps={model.gaps} />
          </>
        ) : null}

        <UploadForm hasData={loaded} />

        <section className="rounded-lg border bg-background p-4 text-sm">
          <h2 className="text-sm font-semibold tracking-tight">What a re-upload does</h2>
          <ul className="mt-2 space-y-1.5 text-muted-foreground">
            <li>
              <span className="font-medium text-foreground">Timesheet</span> — the months inside the
              file are deleted and rewritten. A file containing only March replaces March and leaves
              the rest of the year exactly as it was.
            </li>
            <li>
              <span className="font-medium text-foreground">Salaries</span> — updated per person per
              month. A blank or <code className="text-xs">-</code> cell means &ldquo;not
              provided&rdquo; and leaves the stored figure alone, so a partial sheet cannot wipe a
              month.
            </li>
            <li>
              <span className="font-medium text-foreground">Project prices</span> — updated per ref
              code. Projects missing from the file keep their existing price.
            </li>
          </ul>
        </section>

        <DataTable
          title="Upload history"
          description="Every file that has been through the parser, newest first."
          columns={COLUMNS}
          rows={uploads}
          rowKey={(row) => String(row.id)}
          empty={
            <p className="px-4 py-10 text-center text-sm text-muted-foreground">
              Nothing has been uploaded yet.
            </p>
          }
        />
      </div>
    </>
  );
}

const COLUMNS: Column<UploadRecord>[] = [
  {
    key: 'when',
    header: 'When',
    value: (row) => row.uploadedAt,
    render: (row) => formatDateTime(row.uploadedAt),
  },
  {
    key: 'kind',
    header: 'Dataset',
    value: (row) => DATASET_LABELS[row.kind],
    render: (row) => <span className="font-medium">{DATASET_LABELS[row.kind]}</span>,
  },
  {
    key: 'filename',
    header: 'File',
    value: (row) => row.filename,
    render: (row) => (
      <span className="block max-w-[20rem] truncate text-muted-foreground" title={row.filename}>
        {row.filename}
      </span>
    ),
  },
  {
    key: 'sheet',
    header: 'Sheet',
    value: (row) => row.sheetName,
    render: (row) => <span className="text-muted-foreground">{row.sheetName}</span>,
  },
  { key: 'header', header: 'Header row', align: 'right', value: (row) => row.headerRow },
  { key: 'rows', header: 'Rows', align: 'right', value: (row) => row.rowCount },
  {
    key: 'skipped',
    header: 'Skipped',
    align: 'right',
    value: (row) => row.skippedRows,
    render: (row) =>
      row.skippedRows > 0 ? (
        <span className="text-amber-600">{row.skippedRows}</span>
      ) : (
        <span className="text-muted-foreground">0</span>
      ),
  },
  {
    key: 'periods',
    header: 'Periods',
    value: (row) =>
      row.periods.map((period) => `${monthAbbr(period.month)} ${period.year}`).join(' '),
    render: (row) =>
      row.periods.length === 0 ? (
        <span className="text-muted-foreground">—</span>
      ) : (
        <span className="text-muted-foreground">
          {summarisePeriods(row.periods)}
        </span>
      ),
  },
  {
    key: 'issues',
    header: 'Issues',
    align: 'right',
    value: (row) => row.issues.length,
    render: (row) =>
      row.issues.length === 0 ? (
        <span className="text-muted-foreground">None</span>
      ) : (
        <span>{row.issues.length}</span>
      ),
  },
];

/** "Jan 2025 – Dec 2025" reads better than twelve labels in a cell. */
function summarisePeriods(periods: { year: number; month: number }[]): string {
  if (periods.length === 1) return `${monthAbbr(periods[0].month)} ${periods[0].year}`;
  const first = periods[0];
  const last = periods[periods.length - 1];
  return `${monthAbbr(first.month)} ${first.year} – ${monthAbbr(last.month)} ${last.year}`;
}
