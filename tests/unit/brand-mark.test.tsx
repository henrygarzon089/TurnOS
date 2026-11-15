import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import manifest from "@/app/manifest";
import { AuthCard } from "@/components/auth/AuthCard";
import { GammaMark } from "@/components/brand/GammaMark";
import { PublicHeader } from "@/components/public/PublicHeader";
import { PublicHero } from "@/components/public/PublicHero";
import { BRAND_NAME } from "@/lib/brand";

/** T-243 · logo y nombre Gamma Club (REQ-091.6, REQ-091.7, REQ-091.9; design §27.3). */

describe("REQ-091.7 símbolo de Gamma Club", () => {
  it("REQ-091.7 la versión positiva va en navy con el tornillo en Rojo Gamma y se anuncia como Gamma Club", () => {
    const svg = renderToStaticMarkup(<GammaMark variant="positivo" size={72} />);
    expect(svg).toContain('role="img"');
    expect(svg).toContain('aria-label="Gamma Club"');
    expect(svg).toContain("fill-brand");
    expect(svg).toMatch(/<circle[^>]*class="fill-accent"/);
    expect(svg).not.toMatch(/#[0-9a-f]{3,8}\b/i); // solo tokens (REQ-078.1)
  });

  it("REQ-091.7 la versión negativa va en crema con el tornillo rojo de navy", () => {
    const svg = renderToStaticMarkup(<GammaMark variant="negativo" size={64} />);
    expect(svg).toContain("fill-surface");
    expect(svg).toMatch(/<circle[^>]*class="fill-accent-mark"/);
  });

  it("REQ-091.7 bajo 40 px usa el ícono simplificado (anillo grueso, hojas anchas)", () => {
    const small = renderToStaticMarkup(<GammaMark variant="positivo" size={24} />);
    const big = renderToStaticMarkup(<GammaMark variant="positivo" size={40} />);
    expect(small).toContain('data-version="simplificado"');
    expect(small).toContain('r="13"');
    expect(big).toContain('data-version="completo"');
  });

  it("REQ-091.7 junto al nombre escrito el símbolo es decorativo", () => {
    const svg = renderToStaticMarkup(<GammaMark variant="positivo" size={48} decorative />);
    expect(svg).toContain('aria-hidden="true"');
    expect(svg).not.toContain('role="img"');
  });

  it("REQ-091.7 la tarjeta de Entrar e Invitación muestra el símbolo y GAMMA CLUB, no TurnOS", () => {
    const html = renderToStaticMarkup(
      <AuthCard title="Entrar">
        <p>formulario</p>
      </AuthCard>,
    );
    expect(html).toContain("data-gamma-mark");
    expect(html).toMatch(/>GAMMA CLUB</);
    expect(html).toContain("tracking-[0.3em]");
    expect(html).not.toContain("TurnOS");
  });
});

describe("REQ-091.9 portada sin logo", () => {
  it("REQ-091.9 sin logo subido, la portada muestra el símbolo negativo sobre navy y el nombre en mayúsculas espaciadas", () => {
    const html = renderToStaticMarkup(
      <PublicHero name="Gamma Club" logoPath={null} coverPath={null} />,
    );
    expect(html).toMatch(/bg-brand[^"]*"[^>]*>\s*<svg[^>]*data-variant="negativo"/);
    expect(html).not.toMatch(/>GC</); // ya no van las iniciales
    const h1 = html.match(/<h1[^>]*>Gamma Club</)![0];
    expect(h1).toContain("uppercase");
    expect(h1).toContain("tracking-[0.3em]");
  });

  it("REQ-091.9 con logo subido manda el logo", () => {
    const html = renderToStaticMarkup(
      <PublicHero
        name="Gamma Club"
        logoPath="0f0e0d0c-0b0a-4908-8706-050403020100/brand/1f0e0d0c-0b0a-4908-8706-050403020100.webp"
        coverPath={null}
      />,
    );
    expect(html).toContain('alt="Logo de Gamma Club"');
    expect(html).not.toContain("data-gamma-mark");
  });

  it("REQ-091.9 el encabezado de las otras pantallas del cliente usa el mismo símbolo", () => {
    const html = renderToStaticMarkup(<PublicHeader name="Gamma Club" />);
    expect(html).toContain('data-variant="negativo"');
    expect(html).not.toMatch(/>GC</);
  });
});

describe("REQ-091.6 la app se llama Gamma Club", () => {
  it("REQ-091.6 la app instalada del personal se llama Gamma Club", () => {
    const m = manifest();
    expect(BRAND_NAME).toBe("Gamma Club");
    expect(m.name).toBe("Gamma Club");
    expect(m.short_name).toBe("Gamma Club");
  });

  it("REQ-091.6 el título de la pestaña y el acceso de iPhone dicen Gamma Club", () => {
    const layout = readFileSync("src/app/layout.tsx", "utf8");
    expect(layout).toMatch(/default: BRAND_NAME/);
    expect(layout).toMatch(/template: `%s · \$\{BRAND_NAME\}`/);
    expect(layout).toMatch(/applicationName: BRAND_NAME/);
    expect(layout).toMatch(/title: BRAND_NAME/);
  });

  it("REQ-091.6 la invitación, su WhatsApp y la portada ya no dicen TurnOS", () => {
    const visible = (f: string) =>
      readFileSync(f, "utf8")
        .split("\n")
        .filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l))
        .join("\n");
    for (const f of [
      "src/app/layout.tsx",
      "src/app/manifest.ts",
      "src/app/(auth)/invitacion/[token]/page.tsx",
      "src/components/admin/BarberForms.tsx",
      "src/components/queue/JoinForm.tsx",
      "src/components/auth/AuthCard.tsx",
    ])
      expect([f, visible(f).includes("TurnOS")]).toEqual([f, false]);
    expect(readFileSync("src/app/(auth)/invitacion/[token]/page.tsx", "utf8")).toContain(
      "te invitó a su app",
    );
    expect(readFileSync("src/components/admin/BarberForms.tsx", "utf8")).toContain(
      "Te invito a la app de ${BRAND_NAME}",
    );
  });
});

describe("REQ-087.2 el logo va encima de la foto del local", () => {
  const cover =
    "0f0e0d0c-0b0a-4908-8706-050403020100/brand/2f0e0d0c-0b0a-4908-8706-050403020100.webp";
  const logo =
    "0f0e0d0c-0b0a-4908-8706-050403020100/brand/1f0e0d0c-0b0a-4908-8706-050403020100.webp";

  // La foto es `relative`: un logo sin posición queda debajo y se ve cortado arriba (2026-11-15)
  it("REQ-087.2 con foto, el logo subido sube sobre ella y queda por encima, no tapado", () => {
    const html = renderToStaticMarkup(
      <PublicHero name="Gamma Club" logoPath={logo} coverPath={cover} />,
    );
    const img = html.match(/<img[^>]*alt="Logo de Gamma Club"[^>]*>/)![0];
    expect(img).toContain("-mt-10");
    expect(img).toMatch(/\brelative\b/);
    expect(img).toMatch(/\bz-10\b/);
  });

  it("REQ-087.2 REQ-091.9 con foto y sin logo, el símbolo también queda por encima", () => {
    const html = renderToStaticMarkup(
      <PublicHero name="Gamma Club" logoPath={null} coverPath={cover} />,
    );
    const box = html.match(/<span[^>]*class="[^"]*-mt-10[^"]*"/)![0];
    expect(box).toMatch(/\brelative\b/);
    expect(box).toMatch(/\bz-10\b/);
  });
});
