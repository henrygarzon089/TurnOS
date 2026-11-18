import "server-only";
import { MAX_FILE_BYTES, parseCsv } from "@/lib/domain/fresha-import";
import { readXlsxRows, XlsxError } from "./xlsx";

export type ImportFileError = "TOO_BIG" | "NOT_READABLE" | "NO_COLUMNS";

/**
 * Lee un archivo subido (CSV o Excel) en memoria; nunca se guarda (REQ-100.1, REQ-100.11).
 * null si no vino archivo.
 */
export async function fileRows(
  value: FormDataEntryValue | null,
): Promise<string[][] | ImportFileError | null> {
  if (!value || typeof value === "string" || value.size === 0) return null;
  if (value.size > MAX_FILE_BYTES) return "TOO_BIG";
  const buf = Buffer.from(await value.arrayBuffer());
  try {
    // Un .xlsx es un zip: empieza por "PK"
    if (buf[0] === 0x50 && buf[1] === 0x4b) return readXlsxRows(buf);
    return parseCsv(buf.toString("utf8"));
  } catch (e) {
    if (e instanceof XlsxError) return "NOT_READABLE";
    throw e;
  }
}
