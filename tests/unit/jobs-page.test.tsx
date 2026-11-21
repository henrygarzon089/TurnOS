import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/actions/jobs", () => ({ applyForJob: vi.fn() }));

import { JobsPage } from "@/components/site/JobsPage";
import type { PublicBusiness } from "@/lib/queue/public-queue";

const business = {
  id: "b1",
  name: "Gamma Club",
  slug: "gamma-club",
  address: "Cl. 78 Sur, Sabaneta",
  privacyVersion: 2,
  coverPath: "b1/brand/cover.webp",
  logoPath: null,
  services: [
    { id: "s1", name: "Corte", durationMin: 40, price: 30000, photoPath: "b1/s/corte.webp", description: null },
    { id: "s2", name: "Barba", durationMin: 20, price: 15000, photoPath: null, description: null },
  ],
  queue: { waiting: [], inService: [], barbers: [] },
} as unknown as PublicBusiness;

const html = () => renderToStaticMarkup(<JobsPage business={business} />);
const text = () =>
  html()
    .replace(/<script[\s\S]*?<\/script>/g, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ");

describe("REQ-102 página Trabaja con nosotros", () => {
  it("REQ-102.1 lleva el aviso: oportunidad laboral, barberos y estilistas, para él y para ella, San Remo", () => {
    const t = text();
    expect(t).toContain("Oportunidad laboral");
    expect(t).toContain("Barberos & Estilistas");
    expect(t).toContain("Barbería premium para él · Blower, corte y estilo para ella");
    expect(t).toContain("San Remo, Sabaneta");
    expect(html()).toContain('data-testid="jobs-hero"');
  });

  it("REQ-102.1 beneficios del aviso y el pago solo como % negociable, sin cifras", () => {
    const t = text();
    for (const b of ["Horario flexible", "% negociable", "Únete al club"]) expect(t).toContain(b);
    expect(t).not.toMatch(/\$\s?\d|\d+\s?%/);
  });

  it("REQ-102.2 qué buscamos, proceso en cuatro pasos y preguntas frecuentes", () => {
    const t = text();
    expect(t).toContain("Qué buscamos");
    expect(t).toContain("Cómo es el proceso");
    for (const s of ["Te postulas aquí", "Te escribimos", "Nos conocemos", "Acordamos"]) expect(t).toContain(s);
    expect(t).toContain("3 días hábiles");
    expect(html().match(/<details/g)?.length).toBeGreaterThanOrEqual(4);
  });

  it("REQ-102.2 botones Postularme y WhatsApp al 320 714 5752 con mensaje listo", () => {
    const h = html();
    expect(h).toContain('href="#postular"');
    expect(h).toContain("https://wa.me/573207145752?text=");
    expect(h).toContain('id="postular"');
    expect(text()).toContain("320 714 5752");
  });

  it("REQ-102.3 el formulario pide los datos, la autorización y lleva la trampa oculta", () => {
    const h = html();
    for (const n of ["name", "phone", "role", "years", "portfolio", "availability", "message", "privacyAccepted"])
      expect(h).toContain(`name="${n}"`);
    expect(h).toMatch(/<input[^>]*tabindex="-1"[^>]*name="website"/i);
    expect(h).toContain('href="/gamma-club/privacidad"');
    expect(h).toContain('name="privacyVersion" value="2"');
    for (const l of ["Barbero", "Estilista", "Barbero y estilista", "Tiempo completo", "Medio tiempo", "Fines de semana"])
      expect(text()).toContain(l);
  });

  it("REQ-102.8 datos estructurados JobPosting sin salario", () => {
    const m = html().match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/);
    const ld = JSON.parse(m![1]);
    expect(ld["@type"]).toBe("JobPosting");
    expect(ld.url).toBe("https://www.gammaclub.co/trabaja-con-nosotros");
    expect(m![1]).not.toMatch(/salary/i);
  });

  it("REQ-102.9 botones de 48 px y sin textos en inglés", () => {
    const h = html();
    const english =
      /(?<!\p{L})(Submit|Cancel|Loading|Apply|Jobs|Careers|Name|Phone|Send|Message|Email|Hiring)(?!\p{L})/u;
    expect(text().split(" ").filter((w) => english.test(w))).toEqual([]);
    expect(h.match(/min-h-12/g)?.length).toBeGreaterThanOrEqual(6);
  });

  it("REQ-102.1 la ruta existe y respeta el módulo", () => {
    const page = readFileSync("src/app/trabaja-con-nosotros/page.tsx", "utf8");
    expect(page).toContain('isModuleEnabled("jobs")');
  });
});
