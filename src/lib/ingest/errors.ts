/** A file we could not read at all. Carries a hint the upload page can show verbatim. */
export class IngestError extends Error {
  readonly hint: string | undefined;

  constructor(message: string, hint?: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = 'IngestError';
    this.hint = hint;
  }
}

export type IssueSeverity = 'warning' | 'error';

/** A row we could read but could not fully trust. Collected, never thrown. */
export interface IngestIssue {
  severity: IssueSeverity;
  /** 1-based sheet row, so it matches what the user sees in Excel. */
  row: number | null;
  column: string | null;
  message: string;
}

export function issue(
  severity: IssueSeverity,
  message: string,
  row: number | null = null,
  column: string | null = null,
): IngestIssue {
  return { severity, message, row, column };
}
