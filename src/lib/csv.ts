export type CsvValue = string | number | null | undefined;

/** Excel needs the BOM to read a UTF-8 CSV as UTF-8. */
const BOM = '﻿';

export function toCsv(matrix: CsvValue[][]): string {
  return BOM + matrix.map((row) => row.map(escapeCell).join(',')).join('\r\n');
}

function escapeCell(value: CsvValue): string {
  if (value === null || value === undefined) return '';
  const text = String(value);
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function csvFilename(base: string, suffix?: string | null): string {
  const parts = [base, suffix].filter(Boolean).join('-');
  return `${parts.replace(/[^a-zA-Z0-9-_]+/g, '-').replace(/-+/g, '-').toLowerCase()}.csv`;
}
