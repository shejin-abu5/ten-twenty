import type { IngestIssue } from '@/lib/ingest/errors';
import type { DatasetKind } from '@/lib/ingest/types';

/** What one file did when it went through the parser and the writer. */
export interface DatasetOutcome {
  kind: DatasetKind;
  filename: string;
  ok: boolean;
  message: string;
  hint?: string;
  sheetName?: string;
  headerRow?: number;
  rowsWritten?: number;
  skippedRows?: number;
  replacedPeriods?: { year: number; month: number }[];
  issues: IngestIssue[];
}

export interface UploadState {
  status: 'idle' | 'done';
  outcomes: DatasetOutcome[];
}

// Kept out of the actions module: a 'use server' file may only export async
// functions, so a constant declared there arrives on the client as undefined.
export const IDLE_UPLOAD_STATE: UploadState = { status: 'idle', outcomes: [] };
