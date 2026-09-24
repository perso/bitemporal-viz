import type { SourceFile } from "../core/dataset";

/** Read browser `File`s (from a picker or a drop) as text sources, ignoring non-CSV files. */
export async function readCsvFiles(files: Iterable<File>): Promise<SourceFile[]> {
  const csvs = [...files].filter((file) => file.name.toLowerCase().endsWith(".csv"));
  return Promise.all(csvs.map(async (file) => ({ name: file.name, text: await file.text() })));
}
