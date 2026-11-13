import { strFromU8, unzipSync } from 'fflate';

export type Row = (string | null)[];

export class WorkbookError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'WorkbookError';
  }
}

const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };

function decode(text: string): string {
  return text.replace(/&(#x[0-9a-f]+|#\d+|\w+);/gi, (entity, code: string) => {
    if (code.startsWith('#x') || code.startsWith('#X')) {
      return String.fromCodePoint(parseInt(code.slice(2), 16));
    }
    if (code.startsWith('#')) return String.fromCodePoint(Number(code.slice(1)));
    return ENTITIES[code] ?? entity;
  });
}

const attribute = (attributes: string, name: string) =>
  new RegExp(`\\b${name}="([^"]*)"`).exec(attributes)?.[1];

// All the text runs of a shared string or inline string, joined.
const textOf = (xml: string) =>
  [...xml.matchAll(/<t\b[^>]*>([\s\S]*?)<\/t>/g)].map((match) => decode(match[1] ?? '')).join('');

function columnIndex(reference: string): number {
  const letters = /^[A-Z]+/.exec(reference)?.[0] ?? '';
  return [...letters].reduce((index, letter) => index * 26 + letter.charCodeAt(0) - 64, 0) - 1;
}

function cellValue(type: string | undefined, body: string, shared: string[]): string | null {
  if (type === 'inlineStr') return textOf(body);
  const value = /<v>([\s\S]*?)<\/v>/.exec(body)?.[1];
  if (value === undefined) return null;
  if (type === 's') return shared[Number(value)] ?? null;
  return decode(value);
}

// Reads cell values (not formulas or formatting) from an .xlsx file: enough for a product sheet
// without pulling in a full spreadsheet library.
function unzip(file: Uint8Array) {
  try {
    return unzipSync(file);
  } catch {
    throw new WorkbookError('This is not an .xlsx workbook.');
  }
}

export function readWorkbook(file: Uint8Array) {
  const entries = unzip(file);
  const read = (path: string) => (entries[path] ? strFromU8(entries[path]) : undefined);

  const workbook = read('xl/workbook.xml');
  const relations = read('xl/_rels/workbook.xml.rels');
  if (!workbook || !relations) throw new WorkbookError('This is not an .xlsx workbook.');

  const shared = [...(read('xl/sharedStrings.xml') ?? '').matchAll(/<si>([\s\S]*?)<\/si>/g)].map(
    (match) => textOf(match[1] ?? ''),
  );
  const targets = new Map(
    [...relations.matchAll(/<Relationship\b([^>]*)\/?>/g)].map(([, attributes = '']) => [
      attribute(attributes, 'Id'),
      attribute(attributes, 'Target'),
    ]),
  );
  const sheets = new Map(
    [...workbook.matchAll(/<sheet\b([^>]*)\/?>/g)].map(([, attributes = '']) => [
      decode(attribute(attributes, 'name') ?? ''),
      targets.get(attribute(attributes, 'r:id')),
    ]),
  );

  return {
    sheetNames: [...sheets.keys()],

    rows(name: string): Row[] {
      const target = sheets.get(name);
      const xml = target && read(`xl/${target.replace(/^\/?xl\//, '')}`);
      if (!xml) throw new WorkbookError(`The workbook has no "${name}" sheet.`);

      return [...xml.matchAll(/<row\b[^>]*>([\s\S]*?)<\/row>/g)].map(([, rowXml = '']) => {
        const row: Row = [];
        for (const [, attributes = '', body = ''] of rowXml.matchAll(
          /<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g,
        )) {
          const index = columnIndex(attribute(attributes, 'r') ?? '');
          while (row.length < index) row.push(null);
          row[index] = cellValue(attribute(attributes, 't'), body, shared);
        }
        return row;
      });
    },
  };
}

export type Workbook = ReturnType<typeof readWorkbook>;

// Turns a sheet into records keyed by its header row, skipping blank rows.
export function records(rows: Row[]): Record<string, string | null>[] {
  const [header = [], ...body] = rows;
  return body
    .filter((row) => row.some((cell) => cell !== null && cell.trim() !== ''))
    .map((row) =>
      Object.fromEntries(
        header.flatMap((name, index) => {
          if (!name) return [];
          const value = row[index]?.trim();
          return [[name, value ? value : null]];
        }),
      ),
    );
}
