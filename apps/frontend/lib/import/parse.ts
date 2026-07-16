import * as XLSX from 'xlsx';

/**
 * ─── Spreadsheet parsing ─────────────────────────────────────────────────────
 *
 * Parsing happens in the browser, not on the server. The bytes are already here,
 * so the user sees their columns and a live preview the instant they drop a file
 * — no upload, no temp storage, no round trip before the first useful screen.
 * Only *mapped, structured rows* are ever posted, and the server re-validates
 * every one of them.
 *
 * Everything is read as display text (`raw: false`) rather than as typed cells.
 * A phone number is the reason: Excel stores "01000000092" as the number
 * 1000000092, and the only place the original string still exists is the cell's
 * formatted display value. Dates are the exception — `dateNF` pins them to an
 * unambiguous ISO day so "01/02/2026" can't be read as either January or February.
 */

export const SUPPORTED_EXTENSIONS = ['.csv', '.tsv', '.txt', '.xlsx', '.xls', '.xlsm'] as const;

export const ACCEPT_ATTRIBUTE = SUPPORTED_EXTENSIONS.join(',');

/** Guard against a mis-dropped 200 MB file locking up the tab. */
export const MAX_FILE_BYTES = 25 * 1024 * 1024;
export const MAX_ROWS = 50_000;

export interface ParsedSheet {
  name: string;
  headers: string[];
  /** Data rows, already aligned to `headers.length`. */
  rows: string[][];
  /** Rows present in the sheet beyond MAX_ROWS, dropped from `rows`. */
  truncated: number;
}

export interface ParsedFile {
  fileName: string;
  sheets: ParsedSheet[];
}

const TEXT_EXTENSIONS = new Set(['.csv', '.tsv', '.txt']);

function extensionOf(fileName: string): string {
  const index = fileName.lastIndexOf('.');
  return index === -1 ? '' : fileName.slice(index).toLowerCase();
}

/**
 * Pick the delimiter by seeing which candidate carves the header line into the
 * most columns. Counting occurrences alone would crown the comma for a
 * semicolon-separated file whose first cell is "Doe, John".
 */
export function detectDelimiter(sample: string): string {
  const firstLine = sample.split(/\r?\n/).find((line) => line.trim() !== '') ?? '';
  const candidates = [',', '\t', ';', '|'];

  let best = ',';
  let bestCount = 0;
  for (const candidate of candidates) {
    // Ignore delimiters inside quoted cells.
    const outsideQuotes = firstLine.replace(/"[^"]*"/g, '');
    const count = outsideQuotes.split(candidate).length - 1;
    if (count > bestCount) {
      best = candidate;
      bestCount = count;
    }
  }
  return best;
}

function toSheet(workbook: XLSX.WorkBook, name: string, hasHeaderRow: boolean): ParsedSheet {
  const worksheet = workbook.Sheets[name];
  const matrix = XLSX.utils.sheet_to_json<string[]>(worksheet, {
    header: 1,
    blankrows: false,
    defval: '',
    raw: false,
    dateNF: 'yyyy-mm-dd',
  });

  const cleaned = matrix.filter((row) => row.some((cell) => String(cell ?? '').trim() !== ''));
  if (cleaned.length === 0) return { name, headers: [], rows: [], truncated: 0 };

  const width = cleaned.reduce((max, row) => Math.max(max, row.length), 0);
  const pad = (row: string[]) =>
    Array.from({ length: width }, (_, index) => String(row[index] ?? '').trim());

  const headers = hasHeaderRow
    ? pad(cleaned[0]).map((header, index) => header || `Column ${columnLetter(index)}`)
    : Array.from({ length: width }, (_, index) => `Column ${columnLetter(index)}`);

  const body = hasHeaderRow ? cleaned.slice(1) : cleaned;
  const rows = body.slice(0, MAX_ROWS).map(pad);

  return { name, headers, rows, truncated: Math.max(0, body.length - MAX_ROWS) };
}

/** 0 → "A", 25 → "Z", 26 → "AA" — matches what the user sees in Excel. */
export function columnLetter(index: number): string {
  let letters = '';
  let current = index;
  do {
    letters = String.fromCharCode(65 + (current % 26)) + letters;
    current = Math.floor(current / 26) - 1;
  } while (current >= 0);
  return letters;
}

export class ImportParseError extends Error {}

export async function parseFile(file: File, opts: { hasHeaderRow?: boolean } = {}): Promise<ParsedFile> {
  const hasHeaderRow = opts.hasHeaderRow ?? true;
  const extension = extensionOf(file.name);

  if (!SUPPORTED_EXTENSIONS.includes(extension as (typeof SUPPORTED_EXTENSIONS)[number])) {
    throw new ImportParseError(
      `${extension || 'That file type'} is not supported. Use CSV, TSV, or Excel (.xlsx, .xls).`,
    );
  }
  if (file.size > MAX_FILE_BYTES) {
    throw new ImportParseError(`That file is ${(file.size / 1024 / 1024).toFixed(1)} MB. The limit is 25 MB.`);
  }

  let workbook: XLSX.WorkBook;
  try {
    if (TEXT_EXTENSIONS.has(extension)) {
      // Decode explicitly as UTF-8 so Arabic headers survive; SheetJS would
      // otherwise guess a codepage from the raw bytes.
      const text = new TextDecoder('utf-8').decode(await file.arrayBuffer()).replace(/^\uFEFF/, '');
      workbook = XLSX.read(text, { type: 'string', FS: detectDelimiter(text), raw: false });
    } else {
      workbook = XLSX.read(await file.arrayBuffer(), { type: 'array', cellDates: true, raw: false });
    }
  } catch (error) {
    throw new ImportParseError(
      `That file could not be read${error instanceof Error ? `: ${error.message}` : ''}. It may be corrupt or password-protected.`,
    );
  }

  const sheets = workbook.SheetNames.map((name) => toSheet(workbook, name, hasHeaderRow)).filter(
    (sheet) => sheet.headers.length > 0,
  );

  if (!sheets.length) throw new ImportParseError('That file has no readable rows.');

  return { fileName: file.name, sheets };
}

/** Turn the failed rows into a CSV the user can fix and re-upload as-is. */
export function buildErrorReport(
  headers: string[],
  failures: Array<{ row: number; values: string[]; errors: string[] }>,
): string {
  const escape = (value: string) => {
    const text = String(value ?? '');
    return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  };

  const lines = [['Row', ...headers, 'Error'].map(escape).join(',')];
  for (const failure of failures) {
    lines.push([String(failure.row), ...failure.values, failure.errors.join('; ')].map(escape).join(','));
  }
  // The BOM makes Excel open a UTF-8 CSV without mangling Arabic.
  return `\uFEFF${lines.join('\n')}`;
}

export function downloadCsv(fileName: string, content: string): void {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  URL.revokeObjectURL(url);
}
