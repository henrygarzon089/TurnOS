/**
 * Íconos de la app y PNG de la marca Gamma Club (REQ-091.8, design §27.4, T-240).
 *
 * Se corre una vez a mano (`pnpm tsx scripts/brand-icons.ts`) y los PNG quedan en el repo; el build
 * no lo usa. Fuente: el símbolo del manual de marca (`docs/marca/logos/`).
 */
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import sharp from "sharp";

const NAVY = "#14254A";
const CREAM = "#F3F0EA";
const RED_ON_NAVY = "#F0394A";

/** Las cuatro piezas del símbolo en su caja de 100 × 100 (docs/marca/logos/simbolo-*.svg). */
function symbol(fill: string, screw: string, stroke = 7, screwR = 5): string {
  return [
    `<polygon points="12,10 55,57 46,63" fill="${fill}"/>`,
    `<polygon points="88,10 45,57 54,63" fill="${fill}"/>`,
    `<path d="M50 62 C36 78 40 96 50 96 C60 96 64 78 50 62" fill="none" stroke="${fill}" stroke-width="${stroke}" stroke-linejoin="round"/>`,
    `<circle cx="50" cy="60" r="${screwR}" fill="${screw}"/>`,
  ].join("");
}

/** Ícono en cuadro navy del manual (esquinas 24/100). */
export const ICON_SQUARE_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect width="100" height="100" rx="24" fill="${NAVY}"/><g transform="translate(15,12) scale(0.7)">${symbol(CREAM, RED_ON_NAVY, 9, 7)}</g></svg>`;

/**
 * Centro del símbolo y radio que lo encierra, en unidades de la caja de 100: las puntas de las
 * hojas (12,10) y (88,10) son lo más lejano a (50,55).
 */
export const SYMBOL_CENTER = { x: 50, y: 55 };
export const SYMBOL_RADIUS = Math.hypot(38, 45) + 3.5; // + medio trazo del anillo

/**
 * Fondo navy a sangre (las esquinas las pone el sistema) y símbolo dentro del círculo de la zona
 * segura: 80 % central, con un margen para que nada roce el borde.
 */
export function fullBleedSvg(size: number, safeFraction = 0.74): string {
  const scale = ((size * safeFraction) / 2 / SYMBOL_RADIUS).toFixed(4);
  const tx = (size / 2 - SYMBOL_CENTER.x * Number(scale)).toFixed(2);
  const ty = (size / 2 - SYMBOL_CENTER.y * Number(scale)).toFixed(2);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}"><rect width="${size}" height="${size}" fill="${NAVY}"/><g transform="translate(${tx},${ty}) scale(${scale})">${symbol(CREAM, RED_ON_NAVY)}</g></svg>`;
}

/** Ícono simplificado (≤ 40 px) en cuadro navy, para el favicon. */
const FAVICON_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect width="100" height="100" rx="20" fill="${NAVY}"/><g transform="translate(10,8) scale(0.8)"><polygon points="8,6 60,57 42,68" fill="${CREAM}"/><polygon points="92,6 40,57 58,68" fill="${CREAM}"/><circle cx="50" cy="82" r="13" fill="none" stroke="${RED_ON_NAVY}" stroke-width="12"/></g></svg>`;

async function png(svg: string, size: number): Promise<Buffer> {
  return sharp(Buffer.from(svg), { density: 72 * Math.max(1, size / 100) })
    .resize(size, size)
    .png()
    .toBuffer();
}

/** ICO con entradas PNG (las aceptan todos los navegadores actuales). */
function ico(images: { size: number; data: Buffer }[]): Buffer {
  const header = Buffer.alloc(6 + 16 * images.length);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(images.length, 4);
  let offset = header.length;
  images.forEach(({ size, data }, i) => {
    const e = 6 + 16 * i;
    header.writeUInt8(size >= 256 ? 0 : size, e);
    header.writeUInt8(size >= 256 ? 0 : size, e + 1);
    header.writeUInt8(0, e + 2);
    header.writeUInt8(0, e + 3);
    header.writeUInt16LE(1, e + 4);
    header.writeUInt16LE(32, e + 6);
    header.writeUInt32LE(data.length, e + 8);
    header.writeUInt32LE(offset, e + 12);
    offset += data.length;
  });
  return Buffer.concat([header, ...images.map((i) => i.data)]);
}

async function main() {
  const root = process.cwd();
  const icons = join(root, "public/icons");
  const out: [string, Buffer][] = [
    [join(icons, "icon-192.png"), await png(ICON_SQUARE_SVG, 192)],
    [join(icons, "icon-512.png"), await png(ICON_SQUARE_SVG, 512)],
    [join(icons, "icon-512-maskable.png"), await png(fullBleedSvg(512), 512)],
    // iPhone redondea las esquinas y no acepta transparencia: fondo a sangre
    [join(icons, "apple-touch-icon.png"), await png(fullBleedSvg(180, 0.8), 180)],
    [join(root, "docs/marca/logos/logo-negocio-256.png"), await png(ICON_SQUARE_SVG, 256)],
    [
      join(root, "src/app/favicon.ico"),
      ico([
        { size: 16, data: await png(FAVICON_SVG, 16) },
        { size: 32, data: await png(FAVICON_SVG, 32) },
        { size: 48, data: await png(ICON_SQUARE_SVG, 48) },
      ]),
    ],
  ];
  for (const [path, data] of out) {
    writeFileSync(path, data);
    console.log(`brand-icons: ${path.replace(root + "/", "")} (${data.length} bytes)`);
  }
}

if (process.argv[1]?.endsWith("brand-icons.ts")) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
