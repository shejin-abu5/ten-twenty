import { parseProjects } from './projects';
import { parseSalaries } from './salaries';
import { parseTimesheet } from './timesheet';
import {
  yearFromFilename,
  type DatasetKind,
  type ParseResult,
  type ParsedProjectRow,
  type ParsedSalaryRow,
  type ParsedTimesheetRow,
} from './types';
import { readSheetGrid } from './workbook';

export * from './errors';
export * from './types';
export { readSheetGrid } from './workbook';

export type AnyParseResult =
  | ({ kind: 'timesheet' } & ParseResult<ParsedTimesheetRow>)
  | ({ kind: 'salaries' } & ParseResult<ParsedSalaryRow>)
  | ({ kind: 'projects' } & ParseResult<ParsedProjectRow>);

/**
 * Parses an uploaded workbook as the kind the user said it was.
 *
 * If the file is not that kind, `locateHeader` will not find the columns it
 * needs and throws an IngestError naming the missing ones, which the upload
 * page shows to the user.
 */
export async function parseDataset(
  kind: DatasetKind,
  buffer: ArrayBuffer | Buffer,
  filename: string,
): Promise<AnyParseResult> {
  const { sheetName, grid } = await readSheetGrid(buffer);
  const options = { fallbackYear: yearFromFilename(filename) };

  switch (kind) {
    case 'timesheet':
      return { ...parseTimesheet(grid, sheetName, options), kind: 'timesheet' };
    case 'salaries':
      return { ...parseSalaries(grid, sheetName, options), kind: 'salaries' };
    case 'projects':
      return { ...parseProjects(grid, sheetName, options), kind: 'projects' };
  }
}
