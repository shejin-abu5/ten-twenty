'use server';

import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { revalidatePath } from 'next/cache';
import { clearAll, saveDataset } from '@/lib/db/repository';
import type { DatasetOutcome, UploadState } from './types';
import {
  DATASET_LABELS,
  IngestError,
  parseDataset,
  type DatasetKind,
} from '@/lib/ingest';

const KINDS: DatasetKind[] = ['timesheet', 'salaries', 'projects'];

const SAMPLE_FILES: Record<DatasetKind, string> = {
  timesheet: 'timesheet-2025.xlsx',
  salaries: 'salaries-2025.xlsx',
  projects: 'project-prices-2025.xlsx',
};

const MAX_BYTES = 20 * 1024 * 1024;

export async function uploadDatasets(
  _previous: UploadState,
  formData: FormData,
): Promise<UploadState> {
  const outcomes: DatasetOutcome[] = [];

  for (const kind of KINDS) {
    const file = formData.get(kind);
    if (!(file instanceof File) || file.size === 0) continue;

    if (file.size > MAX_BYTES) {
      outcomes.push({
        kind,
        filename: file.name,
        ok: false,
        message: 'That file is too large to process.',
        hint: `The limit is ${MAX_BYTES / 1024 / 1024} MB and this file is ${(file.size / 1024 / 1024).toFixed(1)} MB.`,
        issues: [],
      });
      continue;
    }

    outcomes.push(await ingest(kind, Buffer.from(await file.arrayBuffer()), file.name));
  }

  if (outcomes.length === 0) {
    return {
      status: 'done',
      outcomes: [
        {
          kind: 'timesheet',
          filename: '',
          ok: false,
          message: 'Choose at least one file before uploading.',
          issues: [],
        },
      ],
    };
  }

  revalidatePath('/', 'layout');
  return { status: 'done', outcomes };
}

/** One-click load of the workbooks committed under sample-data/. */
export async function loadSampleData(): Promise<UploadState> {
  const outcomes: DatasetOutcome[] = [];

  for (const kind of KINDS) {
    const filename = SAMPLE_FILES[kind];
    try {
      const buffer = await readFile(join(process.cwd(), 'sample-data', filename));
      outcomes.push(await ingest(kind, buffer, filename));
    } catch (error) {
      outcomes.push({
        kind,
        filename,
        ok: false,
        message: 'The sample file could not be read.',
        hint: error instanceof Error ? error.message : undefined,
        issues: [],
      });
    }
  }

  revalidatePath('/', 'layout');
  return { status: 'done', outcomes };
}

export async function clearData(): Promise<UploadState> {
  clearAll();
  revalidatePath('/', 'layout');
  return { status: 'idle', outcomes: [] };
}

async function ingest(
  kind: DatasetKind,
  buffer: Buffer,
  filename: string,
): Promise<DatasetOutcome> {
  try {
    const parsed = await parseDataset(kind, buffer, filename);
    const errors = parsed.issues.filter((entry) => entry.severity === 'error');

    if (parsed.rows.length === 0) {
      return {
        kind,
        filename,
        ok: false,
        message: `No usable rows were found in ${filename}.`,
        hint: errors[0]?.message,
        sheetName: parsed.sheetName,
        headerRow: parsed.headerRow,
        issues: parsed.issues,
      };
    }

    const outcome = saveDataset(parsed, filename);

    return {
      kind,
      filename,
      ok: true,
      message: describeSave(kind, outcome.rowsWritten, outcome.replacedPeriods.length),
      sheetName: parsed.sheetName,
      headerRow: parsed.headerRow,
      rowsWritten: outcome.rowsWritten,
      skippedRows: parsed.skippedRows,
      replacedPeriods: outcome.replacedPeriods,
      issues: parsed.issues,
    };
  } catch (error) {
    if (error instanceof IngestError) {
      return { kind, filename, ok: false, message: error.message, hint: error.hint, issues: [] };
    }
    return {
      kind,
      filename,
      ok: false,
      message: `${DATASET_LABELS[kind]} could not be processed.`,
      hint: error instanceof Error ? error.message : undefined,
      issues: [],
    };
  }
}

function describeSave(kind: DatasetKind, rows: number, periods: number): string {
  const count = `${rows.toLocaleString('en-AE')} row${rows === 1 ? '' : 's'}`;
  switch (kind) {
    case 'timesheet':
      return `${count} loaded, replacing ${periods} month${periods === 1 ? '' : 's'}. Other months were left untouched.`;
    case 'salaries':
      return `${count} loaded. Existing figures for the same person and month were overwritten; blank cells were left alone.`;
    case 'projects':
      return `${count} loaded. Projects not in this file were left in place.`;
  }
}
