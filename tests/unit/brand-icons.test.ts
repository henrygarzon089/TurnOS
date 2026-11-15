import { readFileSync } from "node:fs";
import { join } from "node:path";
import sharp from "sharp";
import { describe, expect, it } from "vitest";

const root = join(__dirname, "../..");
const NAVY = [0x14, 0x25, 0x4a];

async function pixels(file: string) {
  const { data, info } = await sharp(join(root, file))
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  return { data, w: info.width, h: info.height };
}

function isNavy(d: Buffer, i: number) {
  return (
    Math.abs(d[i] - NAVY[0]) <= 2 &&
    Math.abs(d[i + 1] - NAVY[1]) <= 2 &&
    Math.abs(d[i + 2] - NAVY[2]) <= 2 &&
    d[i + 3] === 255
  );
}

describe("íconos de la marca (T-240)", () => {
  it("REQ-091.8 el ícono enmascarable deja el símbolo dentro del 80 % central", async () => {
    const { data, w, h } = await pixels("public/icons/icon-512-maskable.png");
    expect([w, h]).toEqual([512, 512]);
    const r = 0.4 * w;
    let outside = 0;
    let inside = 0;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = (y * w + x) * 4;
        const inSafe = Math.hypot(x + 0.5 - w / 2, y + 0.5 - h / 2) <= r;
        if (!isNavy(data, i)) {
          if (inSafe) inside++;
          else outside++;
        }
      }
    }
    expect(outside).toBe(0); // fuera de la zona segura solo hay fondo navy
    expect(inside).toBeGreaterThan(1000); // y el símbolo sí está
  });

  it("REQ-091.8 los íconos de la app tienen el tamaño del manifest y el de Apple no es transparente", async () => {
    for (const [file, size] of [
      ["public/icons/icon-192.png", 192],
      ["public/icons/icon-512.png", 512],
      ["public/icons/apple-touch-icon.png", 180],
    ] as const) {
      const meta = await sharp(join(root, file)).metadata();
      expect([file, meta.width, meta.height]).toEqual([file, size, size]);
    }
    const apple = await pixels("public/icons/apple-touch-icon.png");
    expect(isNavy(apple.data, 0)).toBe(true); // esquina a sangre, sin transparencia
  });

  it("REQ-091.8 el centro del ícono es navy con el símbolo crema y el tornillo rojo", async () => {
    const { data, w } = await pixels("public/icons/icon-512.png");
    const colors = new Set<string>();
    for (let i = 0; i < data.length; i += 4) {
      if (data[i + 3] === 255) colors.add(`${data[i]},${data[i + 1]},${data[i + 2]}`);
    }
    expect(colors.has("20,37,74")).toBe(true); // #14254A
    expect(colors.has("243,240,234")).toBe(true); // #F3F0EA
    expect(colors.has("240,57,74")).toBe(true); // #F0394A
    expect(w).toBe(512);
  });

  it("REQ-091.8 el favicon trae 16, 32 y 48 px", () => {
    const buf = readFileSync(join(root, "src/app/favicon.ico"));
    expect(buf.readUInt16LE(2)).toBe(1);
    const n = buf.readUInt16LE(4);
    const sizes = Array.from({ length: n }, (_, i) => buf.readUInt8(6 + 16 * i));
    expect(sizes).toEqual([16, 32, 48]);
  });
});
