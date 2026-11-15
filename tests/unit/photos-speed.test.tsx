import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { Avatar } from "@/components/media/Avatar";
import { BarberCard, ServiceCard } from "@/components/public/JoinSteps";
import { PublicHero } from "@/components/public/PublicHero";
import { BRAND_SIZES, checkReducedFile, newBrandPath } from "@/lib/media/brand";
import { encodeUnderLimit } from "@/lib/media/resize";

/**
 * T-227 · fotos rápidas (REQ-090.1) y colores de los tokens (REQ-087.3, hoy REQ-091). Lighthouse móvil de la
 * portada (≥ 80, NFR-001) lo mide `scripts/lighthouse.ts` en el CI.
 */
const biz = "0f0e0d0c-0b0a-4908-8706-050403020100";
const photo = `${biz}/barbers/a/1f0e0d0c-0b0a-4908-8706-050403020100.webp`;

describe("REQ-090.1 fotos públicas reducidas, en WebP y diferidas", () => {
  it("REQ-090.1 toda foto llega reducida a un tamaño de pantalla de celular y ≤ 300 KB", () => {
    for (const kind of ["barber", "service", "logo", "cover"] as const) {
      expect(newBrandPath(kind, biz, kind === "barber" ? "a" : null)).toMatch(/\.webp$/);
      expect(BRAND_SIZES[kind].width).toBeLessThanOrEqual(1200);
    }
    // Lo que no llegó reducido no se sube
    expect(checkReducedFile({ type: "image/webp", size: 50_000 })).toBeNull();
    expect(checkReducedFile({ type: "image/webp", size: 2_000_000 })).not.toBeNull();
  });

  it("REQ-090.1 se codifica en WebP; JPEG solo si el navegador no sabe hacer WebP (Safari)", async () => {
    const blob = (type: string) => new Blob([new Uint8Array(1000)], { type });
    const webp = await encodeUnderLimit(async (type) => blob(type));
    expect(webp!.type).toBe("image/webp");
    // Safari entrega PNG cuando se le pide WebP
    const safari = await encodeUnderLimit(async (type) =>
      blob(type === "image/webp" ? "image/png" : type),
    );
    expect(safari!.type).toBe("image/jpeg");
  });

  it("REQ-090.1 las fotos de barberos y servicios cargan diferidas; la portada no", () => {
    const cards = renderToStaticMarkup(
      <>
        <Avatar name="Juan" photoPath={photo} />
        <BarberCard name="Juan" photoPath={photo} text="Libre" checked={false} onPick={() => {}} />
        <ServiceCard
          name="Corte"
          price={25000}
          durationMin={30}
          photoPath={photo}
          checked={false}
          onPick={() => {}}
        />
      </>,
    );
    const imgs = cards.match(/<img[^>]*>/g) ?? [];
    expect(imgs.length).toBe(3);
    for (const img of imgs) expect(img).toContain('loading="lazy"');

    // La portada es lo grande del primer pantallazo: se pide primero, sin esperar
    const hero = renderToStaticMarkup(
      <PublicHero name="Gamma Club" logoPath={null} coverPath={photo} />,
    );
    expect(hero.match(/<img[^>]*>/)![0]).not.toContain('loading="lazy"');
  });
});

describe("REQ-087.3 colores de la app, no del negocio", () => {
  it("REQ-087.3 sin portada, la marca va en el navy de los tokens y sin colores sueltos (hoy los del manual de Gamma Club, REQ-091.1)", () => {
    const hero = renderToStaticMarkup(
      <PublicHero name="Gamma Club" logoPath={null} coverPath={null} />,
    );
    expect(hero).toContain("bg-brand");
    expect(hero).not.toMatch(/style="[^"]*(color|background)/);
    expect(hero).not.toMatch(/#[0-9a-f]{3,8}\b/i);
  });
});
