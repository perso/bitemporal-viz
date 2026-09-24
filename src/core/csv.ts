import { DataError } from "./errors";

export type CsvRecord = Readonly<Record<string, string>>;

export type Csv = {
  readonly header: readonly string[];
  readonly records: readonly CsvRecord[];
};

/** Split CSV text into rows of fields, honouring RFC 4180 quoting. */
export function parseRows(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (quoted) {
      if (char === '"' && text[i + 1] === '"') {
        field += '"';
        i++;
      } else if (char === '"') {
        quoted = false;
      } else {
        field += char;
      }
      continue;
    }
    if (char === '"') quoted = true;
    else if (char === ",") {
      row.push(field);
      field = "";
    } else if (char === "\n") {
      rows.push([...row, field.replace(/\r$/, "")]);
      row = [];
      field = "";
    } else field += char;
  }
  if (field !== "" || row.length > 0) rows.push([...row, field.replace(/\r$/, "")]);
  return rows.filter((r) => r.some((cell) => cell !== ""));
}

/** Parse CSV text with a header row into records keyed by column name. */
export function parseCsv(text: string): Csv {
  const [headerRow, ...body] = parseRows(text.replace(/^\uFEFF/, ""));
  if (headerRow === undefined) throw new DataError("CSV is empty");
  const header = headerRow.map((name) => name.trim());
  const records = body.map((cells) =>
    Object.fromEntries(header.map((name, i) => [name, cells[i] ?? ""])),
  );
  return { header, records };
}
