import { spawnSync } from "node:child_process";
import { describe, expect, it } from "vitest";
import { designViolations } from "@/lib/design/lint-rules";

const tsx = (line: string) => designViolations("src/components/X.tsx", line);

describe("REQ-078.1 solo colores de los tokens", () => {
  it("REQ-078.1 marca clases de la paleta de Tailwind", () => {
    expect(tsx(`<p className="bg-amber-50 p-3">`)).toHaveLength(1);
    expect(tsx(`<p className="focus:ring-blue-200">`)).toHaveLength(1);
    expect(tsx(`<p className="hover:text-gray-700/50">`)).toHaveLength(1);
  });

  it("REQ-078.1 no marca los tokens ni blanco/negro", () => {
    expect(
      tsx(`<p className="bg-warn-soft text-warn border-line bg-white/10 text-black">`),
    ).toEqual([]);
  });

  it("REQ-078.1 marca hexadecimales sueltos en .tsx pero no en .ts ni en un id de ancla", () => {
    expect(tsx(`<div style={{ color: "#1d4ed8" }}>`)).toHaveLength(1);
    expect(designViolations("src/lib/pwa.ts", `export const X = "#0e1e3d";`)).toEqual([]);
    expect(tsx(`<a href="#cobro">`)).toEqual([]);
  });
});

describe("REQ-078.14 sin degradados, desenfoque ni fuentes descargadas", () => {
  it("REQ-078.14 marca degradados, desenfoque de fondo y fuentes externas", () => {
    expect(tsx(`<div className="bg-gradient-to-r">`)).toHaveLength(1);
    expect(tsx(`<div className="backdrop-blur-sm">`)).toHaveLength(1);
    expect(designViolations("src/app/x.css", `.a { backdrop-filter: blur(4px) }`)).toHaveLength(1);
    expect(
      designViolations("src/app/layout.tsx", `import { Inter } from "next/font/google";`),
    ).toHaveLength(1);
    expect(tsx(`<link href="https://fonts.googleapis.com/css2" />`)).toHaveLength(1);
  });
});

describe("REQ-078.3 rojo relleno solo donde se permite", () => {
  it("REQ-078.3 marca bg-accent fuera de los archivos permitidos", () => {
    expect(tsx(`<button className="bg-accent text-accent-ink">`)).toHaveLength(1);
    expect(
      designViolations("src/components/X.tsx", `<span className="bg-accent">`, [
        "src/components/X.tsx",
      ]),
    ).toEqual([]);
  });

  it("REQ-078.3 no confunde bg-accent-soft con el rojo relleno", () => {
    expect(tsx(`<p className="bg-accent-soft text-danger">`)).toEqual([]);
  });
});

describe("REQ-078.1 REQ-078.14 el código de la app cumple", () => {
  it("REQ-078.1 REQ-078.14 pnpm lint:design pasa sobre src/", () => {
    const res = spawnSync("node_modules/.bin/tsx", ["scripts/lint-design.ts"], {
      encoding: "utf8",
    });
    expect(res.stderr).toBe("");
    expect(res.status).toBe(0);
  }, 30_000);
});
