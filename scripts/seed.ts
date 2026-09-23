/**
 * Loads the sample workbooks so the dashboard is populated on first open.
 *
 *   npm run seed            add or refresh the sample year
 *   npm run seed -- --reset wipe everything first
 */
import { readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { clearAll, saveDataset } from '@/lib/db/repository';
import { DATASET_LABELS, IngestError, parseDataset, type DatasetKind } from '@/lib/ingest';

const SAMPLE_DIR = resolve(process.cwd(), 'sample-data');

const FILES: { kind: DatasetKind; filename: string }[] = [
  { kind: 'timesheet', filename: 'timesheet-2025.xlsx' },
  { kind: 'salaries', filename: 'salaries-2025.xlsx' },
  { kind: 'projects', filename: 'project-prices-2025.xlsx' },
];

async function main(): Promise<void> {
  if (process.argv.includes('--reset')) {
    clearAll();
    console.log('Cleared existing data.');
  }

  for (const { kind, filename } of FILES) {
    const buffer = await readFile(join(SAMPLE_DIR, filename));
    const parsed = await parseDataset(kind, buffer, filename);
    const outcome = saveDataset(parsed, filename);

    const errors = parsed.issues.filter((issue) => issue.severity === 'error').length;
    const warnings = parsed.issues.length - errors;

    console.log(
      `${DATASET_LABELS[kind].padEnd(16)} ${String(outcome.rowsWritten).padStart(5)} rows` +
        `  header row ${parsed.headerRow}` +
        `  ${warnings} warning(s), ${errors} error(s)`,
    );
  }

  console.log('\nSeeded. Run `npm run reconcile` to check the totals, or `npm run dev`.');
}

main().catch((error: unknown) => {
  if (error instanceof IngestError) {
    console.error(`\n${error.message}${error.hint ? `\n${error.hint}` : ''}`);
  } else {
    console.error(error);
  }
  process.exitCode = 1;
});
