import ExcelJS from 'exceljs';
import type { Grid, RawCell } from './cells';
import { IngestError } from './errors';

export interface SheetGrid {
  sheetName: string;
  grid: Grid;
}

/**
 * Reads the first sheet that has any content into a plain rectangular grid.
 *
 * Everything downstream works on the grid, not on ExcelJS, so the parsers stay
 * testable with literal arrays and the spreadsheet library stays swappable.
 */
export async function readSheetGrid(buffer: ArrayBuffer | Buffer): Promise<SheetGrid> {
  const workbook = new ExcelJS.Workbook();

  try {
    await workbook.xlsx.load(toArrayBuffer(buffer));
  } catch (cause) {
    throw new IngestError(
      'That file could not be opened as an Excel workbook.',
      'Expected a .xlsx file. A .csv, .xls or a renamed PDF will not load.',
      { cause },
    );
  }

  const sheet = workbook.worksheets.find((ws) => ws.rowCount > 0) ?? workbook.worksheets[0];
  if (!sheet) throw new IngestError('The workbook has no sheets.');

  return { sheetName: sheet.name, grid: toGrid(sheet) };
}

function toGrid(sheet: ExcelJS.Worksheet): Grid {
  const width = Math.max(sheet.columnCount, 1);
  const grid: Grid = [];

  sheet.eachRow({ includeEmpty: true }, (row) => {
    const cells: RawCell[] = [];
    for (let column = 1; column <= width; column++) {
      cells.push(readCell(row.getCell(column).value));
    }
    grid.push(cells);
  });

  return grid;
}

/** Flattens ExcelJS's richer cell shapes (formulas, rich text, hyperlinks) to a scalar. */
function readCell(value: ExcelJS.CellValue): RawCell {
  if (value === null || value === undefined) return null;
  if (value instanceof Date) return value;
  if (typeof value === 'object') {
    if ('result' in value) return readCell(value.result ?? null);
    if ('richText' in value) return value.richText.map((part) => part.text).join('');
    if ('text' in value) return String(value.text);
    if ('error' in value) return null;
    return null;
  }
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return value;
  }
  return null;
}

function toArrayBuffer(buffer: ArrayBuffer | Buffer): ArrayBuffer {
  if (!Buffer.isBuffer(buffer)) return buffer;
  // Copy rather than hand over the pooled allocation Buffer may be a view into.
  const copy = new ArrayBuffer(buffer.byteLength);
  new Uint8Array(copy).set(buffer);
  return copy;
}
