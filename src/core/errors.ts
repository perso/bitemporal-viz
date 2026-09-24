/** A problem in the loaded data itself — a bad timestamp, an empty file — worth showing the user. */
export class DataError extends Error {
  override name = "DataError";
}
