import { deflateRawSync } from "node:zlib";
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
import { readXlsxRows, XlsxError } from "@/lib/import/xlsx";

/** Zip mínimo (sin CRC: el lector no lo revisa) para armar un .xlsx de prueba. */
function zip(files: Record<string, string>, deflate = true): Buffer {
  const locals: Buffer[] = [];
  const centrals: Buffer[] = [];
  let offset = 0;
  for (const [name, text] of Object.entries(files)) {
    const raw = Buffer.from(text, "utf8");
    const data = deflate ? deflateRawSync(raw) : raw;
    const nameBuf = Buffer.from(name);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(deflate ? 8 : 0, 8);
    local.writeUInt32LE(data.length, 18);
    local.writeUInt32LE(raw.length, 22);
    local.writeUInt16LE(nameBuf.length, 26);
    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(deflate ? 8 : 0, 10);
    central.writeUInt32LE(data.length, 20);
    central.writeUInt32LE(raw.length, 24);
    central.writeUInt16LE(nameBuf.length, 28);
    central.writeUInt32LE(offset, 42);
    locals.push(local, nameBuf, data);
    centrals.push(central, nameBuf);
    offset += 30 + nameBuf.length + data.length;
  }
  const cd = Buffer.concat(centrals);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(Object.keys(files).length, 8);
  end.writeUInt16LE(Object.keys(files).length, 10);
  end.writeUInt32LE(cd.length, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, cd, end]);
}

const SHARED = `<sst><si><t>Cliente</t></si><si><t>Fecha</t></si><si><r><t>Laura </t></r><r><t>G&#243;mez &amp; Cía</t></r></si><si><t>Hora</t></si></sst>`;
const STYLES = `<styleSheet><numFmts count="1"><numFmt numFmtId="164" formatCode="d/m/yyyy\\ h:mm"/></numFmts>
<cellXfs count="3"><xf numFmtId="0"/><xf numFmtId="14"/><xf numFmtId="164"/></cellXfs></styleSheet>`;
const SHEET = `<worksheet><sheetData>
<row r="1"><c r="A1" t="s"><v>0</v></c><c r="B1" t="s"><v>1</v></c><c r="D1" t="inlineStr"><is><t>Celular</t></is></c><c r="E1" t="s"><v>3</v></c></row>
<row r="2"><c r="A2" t="s"><v>2</v></c><c r="B2" s="1"><v>46345</v></c><c r="C2"/><c r="D2"><v>3001112233</v></c><c r="E2" s="2"><v>46345.4375</v></c></row>
<row r="3"><c r="A3"/></row>
</sheetData></worksheet>`;

describe("REQ-100.1 leer el Excel de Fresha", () => {
  it("REQ-100.1 lee la primera hoja: textos compartidos, en línea, números, fechas y huecos", () => {
    const buf = zip({
      "xl/sharedStrings.xml": SHARED,
      "xl/styles.xml": STYLES,
      "xl/worksheets/sheet1.xml": SHEET,
    });
    expect(readXlsxRows(buf)).toEqual([
      ["Cliente", "Fecha", "", "Celular", "Hora"],
      ["Laura Gómez & Cía", "2026-11-19", "", "3001112233", "2026-11-19 10:30"],
    ]);
  });

  it("REQ-100.1 también sirve un .xlsx sin comprimir", () => {
    const buf = zip({ "xl/sharedStrings.xml": SHARED, "xl/worksheets/sheet1.xml": SHEET }, false);
    expect(readXlsxRows(buf)[1][1]).toBe("46345");
  });

  it("REQ-100.2 un archivo que no es Excel se rechaza", () => {
    expect(() => readXlsxRows(Buffer.from("Nombre,Celular\nAna,300"))).toThrow(XlsxError);
    expect(() => readXlsxRows(zip({ "otro.txt": "x" }))).toThrow(XlsxError);
  });
});
