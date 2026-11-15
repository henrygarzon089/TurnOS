import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((e) => {
    const full = join(dir, e);
    return statSync(full).isDirectory() ? files(full) : /\.(tsx|css)$/.test(e) ? [full] : [];
  });
}

const src = files("src").map((f) => [f, readFileSync(f, "utf8")] as const);

describe("REQ-091.3 Azul Gamma en el foco y los enlaces", () => {
  it("REQ-091.3 el anillo de foco usa el token link, no el navy", () => {
    const bad = src.flatMap(([f, t]) =>
      t
        .split("\n")
        .map((l, i) => [i + 1, l] as const)
        .filter(([, l]) =>
          /(?:focus|focus-visible|focus-within|has-focus-visible):(?:outline|ring|border)-brand(?![\w-])|focus:ring-brand-soft/.test(
            l,
          ),
        )
        .map(([i]) => `${f}:${i}`),
    );
    expect(bad).toEqual([]);
  });

  it("REQ-091.3 los enlaces subrayados en navy pasan al Azul Gamma", () => {
    const bad = src.flatMap(([f, t]) =>
      t
        .split("\n")
        .map((l, i) => [i + 1, l] as const)
        .filter(([, l]) => /text-brand(?![\w-])/.test(l) && /(?<![\w-])underline(?![\w-])/.test(l))
        .map(([i]) => `${f}:${i}`),
    );
    expect(bad).toEqual([]);
  });

  it("REQ-091.3 el campo de texto marca el foco en Azul Gamma", () => {
    const css = readFileSync("src/app/globals.css", "utf8");
    expect(css).toMatch(/\.input \{[^}]*focus:border-link/);
    expect(readFileSync("src/components/ui/Field.tsx", "utf8")).toMatch(/focus:border-link/);
  });
});
