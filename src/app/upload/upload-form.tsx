'use client';

import { useActionState, useRef, useState, useTransition } from 'react';
import { Database, Loader2, Trash2, UploadCloud } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PanelHeading } from '@/components/ui-kit/panel';
import { monthName } from '@/lib/domain/period';
import { DATASET_LABELS, type DatasetKind } from '@/lib/ingest/types';
import { cn } from '@/lib/utils';
import { clearData, loadSampleData, uploadDatasets } from './actions';
import { IDLE_UPLOAD_STATE, type DatasetOutcome, type UploadState } from './types';

const SLOTS: { kind: DatasetKind; hint: string }[] = [
  { kind: 'timesheet', hint: 'One row per person, per task, per month.' },
  { kind: 'salaries', hint: 'One row per person, one column per month.' },
  { kind: 'projects', hint: 'One row per project, with its ref code and price.' },
];

export function UploadForm({ hasData }: { hasData: boolean }) {
  const [state, action, uploading] = useActionState(uploadDatasets, IDLE_UPLOAD_STATE);
  const [sideState, setSideState] = useState<UploadState | null>(null);
  const [pending, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);

  const shown = sideState ?? state;
  const busy = uploading || pending;

  const runSample = () => {
    startTransition(async () => setSideState(await loadSampleData()));
  };

  const runClear = () => {
    if (!window.confirm('Remove every uploaded timesheet, salary and project price?')) return;
    startTransition(async () => {
      setSideState(await clearData());
      formRef.current?.reset();
    });
  };

  return (
    <div className="space-y-6">
      <form
        ref={formRef}
        action={(formData) => {
          setSideState(null);
          action(formData);
        }}
        className="rounded-lg border"
      >
        <PanelHeading
          title="Upload spreadsheets"
          description="Upload one file or all three. Re-uploading a corrected month replaces only that month."
        />

        <div className="grid gap-6 px-5 py-5 lg:grid-cols-3">
          {SLOTS.map((slot) => (
            <div key={slot.kind} className="min-w-0">
              <Label htmlFor={slot.kind} className="text-sm font-medium">
                {DATASET_LABELS[slot.kind]}
              </Label>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{slot.hint}</p>
              <Input
                id={slot.kind}
                name={slot.kind}
                type="file"
                accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                className="mt-2 cursor-pointer file:mr-3 file:cursor-pointer file:text-xs"
              />
            </div>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2 border-t px-5 py-4">
          <Button type="submit" size="sm" disabled={busy}>
            {uploading ? (
              <Loader2 className="size-3.5 animate-spin" aria-hidden />
            ) : (
              <UploadCloud className="size-3.5" aria-hidden />
            )}
            Upload
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={runSample} disabled={busy}>
            {pending ? (
              <Loader2 className="size-3.5 animate-spin" aria-hidden />
            ) : (
              <Database className="size-3.5" aria-hidden />
            )}
            Load sample year
          </Button>
          {hasData ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={runClear}
              disabled={busy}
              className="ml-auto text-muted-foreground hover:text-negative"
            >
              <Trash2 className="size-3.5" aria-hidden />
              Clear all data
            </Button>
          ) : null}
        </div>
      </form>

      {shown.outcomes.length > 0 ? (
        <div className="space-y-3">
          {shown.outcomes.map((outcome, index) => (
            <OutcomeCard key={`${outcome.kind}-${index}`} outcome={outcome} />
          ))}
        </div>
      ) : null}
    </div>
  );
}

function OutcomeCard({ outcome }: { outcome: DatasetOutcome }) {
  const errors = outcome.issues.filter((issue) => issue.severity === 'error');
  const warnings = outcome.issues.filter((issue) => issue.severity === 'warning');
  
  return (
    <section
      className={cn(
        'rounded-lg border',
        outcome.ok ? 'border-positive/35' : 'border-negative/40',
      )}
    >
      <div className="flex items-start gap-3 px-5 py-4">
        <span
          className={cn(
            'mt-[7px] size-1.5 shrink-0 rounded-full',
            outcome.ok ? 'bg-positive' : 'bg-negative',
          )}
          aria-hidden
        />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium">
            {DATASET_LABELS[outcome.kind]}
            {outcome.filename ? (
              <span className="font-normal text-muted-foreground"> · {outcome.filename}</span>
            ) : null}
          </p>
          <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{outcome.message}</p>
          {outcome.hint ? <p className="mt-1 text-sm text-muted-foreground">{outcome.hint}</p> : null}

          {outcome.ok ? (
            <dl className="mt-3 flex flex-wrap gap-x-6 gap-y-1.5 text-xs text-muted-foreground">
              <Fact label="Sheet" value={outcome.sheetName} />
              <Fact label="Header row" value={outcome.headerRow} />
              <Fact label="Rows skipped" value={outcome.skippedRows} />
              {outcome.replacedPeriods && outcome.replacedPeriods.length > 0 ? (
                <Fact
                  label="Periods"
                  value={outcome.replacedPeriods
                    .map((period) => `${monthName(period.month).slice(0, 3)} ${period.year}`)
                    .join(', ')}
                />
              ) : null}
            </dl>
          ) : null}
        </div>
      </div>

      {outcome.issues.length > 0 ? (
        <details className="border-t px-5 py-3 text-sm">
          <summary className="cursor-pointer list-none text-xs text-muted-foreground">
            {errors.length} error{errors.length === 1 ? '' : 's'} and {warnings.length} warning
            {warnings.length === 1 ? '' : 's'} — show detail
          </summary>
          <ul className="mt-2 space-y-1">
            {outcome.issues.slice(0, 60).map((issue, index) => (
              <li key={index} className="flex gap-2 text-xs">
                <span
                  className={cn(
                    'shrink-0 font-medium',
                    issue.severity === 'error' ? 'text-negative' : 'text-caution',
                  )}
                >
                  {issue.row ? `Row ${issue.row}` : issue.severity === 'error' ? 'Error' : 'Note'}
                </span>
                <span className="text-muted-foreground">
                  {issue.column ? `${issue.column}: ` : ''}
                  {issue.message}
                </span>
              </li>
            ))}
            {outcome.issues.length > 60 ? (
              <li className="text-xs text-muted-foreground">
                …and {outcome.issues.length - 60} more.
              </li>
            ) : null}
          </ul>
        </details>
      ) : null}
    </section>
  );
}

function Fact({ label, value }: { label: string; value: string | number | undefined }) {
  if (value === undefined || value === null || value === '') return null;
  return (
    <span className="flex gap-1.5">
      <dt>{label}</dt>
      <dd className="num font-medium text-foreground">{value}</dd>
    </span>
  );
}
