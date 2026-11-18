import "server-only";
import { inflateRawSync } from "node:zlib";

/**
 * Lector mínimo de Excel (.xlsx) para importar de Fresha (REQ-100.1, design.md §32.2). Solo lee
 * la primera hoja y devuelve las celdas como texto. Sin librerías: las que hay para el servidor
 * arrastran dependencias viejas (T-291). Las fechas de Excel salen como `AAAA-MM-DD HH:MM`.
 */

/** Tope de lo que se descomprime (un .xlsx de 4 MB no pasa de esto; evita bombas zip). */
const MAX_UNZIPPED = 40 * 1024 * 1024;

export class XlsxError extends Error {}

function unzip(buf: Buffer): Map<string, Buffer> {
  let eocd = -1;
  for (let i = buf.length - 22; i >= Math.max(0, buf.length - 65_557); i--) {
    if (buf.readUInt32LE(i) === 0x06054b50) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) throw new XlsxError("NOT_XLSX");
  const count = buf.readUInt16LE(eocd + 10);
  let p = buf.readUInt32LE(eocd + 16);
  const files = new Map<string, Buffer>();
  let total = 0;
  for (let n = 0; n < count; n++) {
    if (p + 46 > buf.length || buf.readUInt32LE(p) !== 0x02014b50) throw new XlsxError("NOT_XLSX");
    const method = buf.readUInt16LE(p + 10);
    const size = buf.readUInt32LE(p + 20);
    const nameLen = buf.readUInt16LE(p + 28);
    const extraLen = buf.readUInt16LE(p + 30);
    const commentLen = buf.readUInt16LE(p + 32);
    const local = buf.readUInt32LE(p + 42);
    const name = buf.toString("utf8", p + 46, p + 46 + nameLen);
    p += 46 + nameLen + extraLen + commentLen;
    if (
      !/^xl\/(sharedStrings|styles|workbook)\.xml$|^xl\/worksheets\/sheet\d+\.xml$|^xl\/_rels\/workbook\.xml\.rels$/.test(
        name,
      )
    )
      continue;
    if (local + 30 > buf.length || buf.readUInt32LE(local) !== 0x04034b50)
      throw new XlsxError("NOT_XLSX");
    const start = local + 30 + buf.readUInt16LE(local + 26) + buf.readUInt16LE(local + 28);
    const raw = buf.subarray(start, start + size);
    let data: Buffer;
    if (method === 0) data = Buffer.from(raw);
    else if (method === 8) {
      try {
        data = inflateRawSync(raw, { maxOutputLength: MAX_UNZIPPED - total });
      } catch {
        throw new XlsxError("NOT_XLSX");
      }
    } else throw new XlsxError("NOT_XLSX");
    total += data.length;
    files.set(name, data);
  }
  return files;
}

function decode(s: string): string {
  return s.replace(/&(#x[0-9a-f]+|#\d+|amp|lt|gt|quot|apos);/gi, (_, e: string) => {
    const k = e.toLowerCase();
    if (k === "amp") return "&";
    if (k === "lt") return "<";
    if (k === "gt") return ">";
    if (k === "quot") return '"';
    if (k === "apos") return "'";
    const code = k.startsWith("#x") ? parseInt(k.slice(2), 16) : parseInt(k.slice(1), 10);
    return Number.isFinite(code) ? String.fromCodePoint(code) : "";
  });
}

/** Texto de un `<si>` o `<is>`: todos los `<t>` juntos (texto con formato viene en varios). */
function richText(xml: string): string {
  return [...xml.matchAll(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g)].map((m) => decode(m[1])).join("");
}

const BUILTIN_DATE = new Set([14, 15, 16, 17, 18, 19, 20, 21, 22, 45, 46, 47]);

/** Índices de estilo (`s`) que son fecha u hora. */
function dateStyles(styles: string | undefined): Set<number> {
  const out = new Set<number>();
  if (!styles) return out;
  const custom = new Map<number, string>();
  for (const m of styles.matchAll(/<numFmt\b[^>]*numFmtId="(\d+)"[^>]*formatCode="([^"]*)"/g))
    custom.set(+m[1], decode(m[2]));
  const xfs = styles.match(/<cellXfs\b[^>]*>([\s\S]*?)<\/cellXfs>/)?.[1] ?? "";
  [...xfs.matchAll(/<xf\b([^>]*)\/?>/g)].forEach((m, i) => {
    const id = +(m[1].match(/numFmtId="(\d+)"/)?.[1] ?? 0);
    const code = (custom.get(id) ?? "").replace(/"[^"]*"|\[[^\]]*\]|\\./g, "").toLowerCase();
    if (BUILTIN_DATE.has(id) || /[dyhs]/.test(code)) out.add(i);
  });
  return out;
}

const pad = (n: number) => String(n).padStart(2, "0");

/** Número de serie de Excel → `AAAA-MM-DD`, `HH:MM` o los dos. */
function serialToText(v: number): string {
  const days = Math.floor(v);
  const minutes = Math.round((v - days) * 24 * 60);
  const time = `${pad(Math.floor(minutes / 60) % 24)}:${pad(minutes % 60)}`;
  if (days === 0) return time;
  const d = new Date(Date.UTC(1899, 11, 30) + days * 86_400_000);
  const date = `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
  return minutes === 0 ? date : `${date} ${time}`;
}

function columnIndex(ref: string): number {
  const letters = ref.match(/^[A-Z]+/)?.[0] ?? "A";
  let n = 0;
  for (const ch of letters) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n - 1;
}

export function readXlsxRows(buf: Buffer): string[][] {
  const files = unzip(buf);
  const sheetName = files.has("xl/worksheets/sheet1.xml")
    ? "xl/worksheets/sheet1.xml"
    : [...files.keys()].filter((k) => k.startsWith("xl/worksheets/")).sort()[0];
  const sheet = sheetName ? files.get(sheetName)?.toString("utf8") : undefined;
  if (!sheet) throw new XlsxError("NOT_XLSX");
  const shared = [
    ...(files.get("xl/sharedStrings.xml")?.toString("utf8") ?? "").matchAll(
      /<si>([\s\S]*?)<\/si>/g,
    ),
  ].map((m) => richText(m[1]));
  const dates = dateStyles(files.get("xl/styles.xml")?.toString("utf8"));

  const rows: string[][] = [];
  for (const rm of sheet.matchAll(/<row\b[^>]*>([\s\S]*?)<\/row>/g)) {
    const row: string[] = [];
    for (const cm of rm[1].matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
      const attrs = cm[1];
      const body = cm[2] ?? "";
      const ref = attrs.match(/\br="([A-Z]+\d+)"/)?.[1];
      const type = attrs.match(/\bt="(\w+)"/)?.[1];
      const style = +(attrs.match(/\bs="(\d+)"/)?.[1] ?? -1);
      const v = body.match(/<v>([\s\S]*?)<\/v>/)?.[1];
      let text = "";
      if (type === "s") text = shared[Number(v)] ?? "";
      else if (type === "inlineStr") text = richText(body);
      else if (type === "str" || type === "e" || type === "b") text = decode(v ?? "");
      else if (v !== undefined) {
        const num = Number(v);
        text = dates.has(style) && Number.isFinite(num) ? serialToText(num) : decode(v);
      }
      const col = ref ? columnIndex(ref) : row.length;
      while (row.length < col) row.push("");
      row[col] = text;
    }
    rows.push(row);
  }
  return rows.filter((r) => r.some((c) => c.trim() !== ""));
}
