import { describe, expect, it } from "vitest";
import {
  barberShopJsonLd,
  heroCtas,
  loyaltyLine,
  mapsUrl,
  priceRange,
  shouldTrackPath,
  weekHoursLines,
  whatsappLink,
  type SiteHours,
} from "@/lib/domain/site";
import { homeSlug, HOME_SLUG } from "@/lib/domain/modules";

const HOURS: SiteHours = [
  { weekday: 0, opensAt: "10:00", closesAt: "16:00", isClosed: true },
  { weekday: 1, opensAt: "09:00", closesAt: "20:00", isClosed: false },
  { weekday: 2, opensAt: "09:00", closesAt: "20:00", isClosed: false },
  { weekday: 3, opensAt: "09:00", closesAt: "20:00", isClosed: false },
  { weekday: 4, opensAt: "09:00", closesAt: "20:00", isClosed: false },
  { weekday: 5, opensAt: "09:00", closesAt: "20:30", isClosed: false },
  { weekday: 6, opensAt: "08:00", closesAt: "18:00", isClosed: false },
];

describe("web del negocio · lógica pura (design §33.2)", () => {
  it("REQ-101.1 homeSlug usa TURNOS_HOME_SLUG y si no, Gamma Club", () => {
    expect(homeSlug(undefined)).toBe(HOME_SLUG);
    expect(homeSlug("  ")).toBe(HOME_SLUG);
    expect(homeSlug("la-33")).toBe("la-33");
  });

  it("REQ-101.2 con citas: Reservar una cita primero y Tomar turno después", () => {
    expect(heroCtas({ canBook: true, slug: "gamma-club" })).toEqual([
      { href: "/gamma-club/cita", label: "Reservar una cita", primary: true },
      { href: "/gamma-club", label: "Tomar turno", primary: false },
    ]);
  });

  it("REQ-101.2 sin citas: Tomar turno es el único botón principal", () => {
    expect(heroCtas({ canBook: false, slug: "gamma-club" })).toEqual([
      { href: "/gamma-club", label: "Tomar turno", primary: true },
    ]);
  });

  it("REQ-101.3 el horario empieza el lunes y marca los días cerrados", () => {
    const lines = weekHoursLines(HOURS);
    expect(lines).toHaveLength(7);
    expect(lines[0]).toEqual({ day: "Lunes", text: "9:00 a. m. – 8:00 p. m." });
    expect(lines[5]).toEqual({ day: "Sábado", text: "8:00 a. m. – 6:00 p. m." });
    expect(lines[6]).toEqual({ day: "Domingo", text: "Cerrado" });
  });

  it("REQ-101.3 la regla de fidelidad en una línea, o nada si está apagada", () => {
    expect(loyaltyLine(null)).toBeNull();
    expect(
      loyaltyLine({
        visitsRequired: 10,
        rewardType: "free_service",
        rewardServiceName: "Corte",
        rewardAmount: null,
      }),
    ).toBe("Cada 10 visitas, tu corte gratis");
    expect(
      loyaltyLine({
        visitsRequired: 8,
        rewardType: "free_service",
        rewardServiceName: null,
        rewardAmount: null,
      }),
    ).toBe("Cada 8 visitas, un servicio gratis");
    expect(
      loyaltyLine({
        visitsRequired: 5,
        rewardType: "discount",
        rewardServiceName: null,
        rewardAmount: 10000,
      }),
    ).toBe("Cada 5 visitas, $ 10.000 de descuento");
  });

  it("REQ-101.3 Cómo llegar abre Google Maps con la dirección", () => {
    expect(mapsUrl("Mall San Remo, Sabaneta")).toBe(
      "https://www.google.com/maps/search/?api=1&query=Mall%20San%20Remo%2C%20Sabaneta",
    );
    expect(mapsUrl(null)).toBeNull();
  });

  it("REQ-101.3 WhatsApp del local con mensaje listo, sin datos del visitante", () => {
    expect(whatsappLink("+573001112233", "Hola")).toBe("https://wa.me/573001112233?text=Hola");
    expect(whatsappLink(null, "Hola")).toBeNull();
  });

  it("REQ-101.7 rango de precios del más barato al más caro", () => {
    expect(priceRange([{ price: 30000 }, { price: 15000 }, { price: 45000 }])).toBe(
      "$ 15.000 – $ 45.000",
    );
    expect(priceRange([{ price: 20000 }])).toBe("$ 20.000");
    expect(priceRange([])).toBeNull();
  });

  it("REQ-101.7 datos estructurados BarberShop con dirección, horario y precios", () => {
    const ld = barberShopJsonLd({
      name: "Gamma Club",
      description: "Cuidado personal premium",
      address: "Mall San Remo, local 12",
      url: "https://www.gammaclub.co/",
      imageUrl: "https://x.test/portada.webp",
      telephone: "+573001112233",
      hours: HOURS,
      services: [{ price: 15000 }, { price: 40000 }],
    });
    expect(ld["@context"]).toBe("https://schema.org");
    expect(ld["@type"]).toBe("BarberShop");
    expect(ld.address).toMatchObject({
      streetAddress: "Mall San Remo, local 12",
      addressLocality: "Sabaneta",
      addressRegion: "Antioquia",
      addressCountry: "CO",
    });
    expect(ld.priceRange).toBe("$ 15.000 – $ 40.000");
    expect(ld.telephone).toBe("+573001112233");
    // Domingo cerrado no se publica; los demás con su hora
    expect(ld.openingHoursSpecification).toHaveLength(6);
    expect(ld.openingHoursSpecification[0]).toEqual({
      "@type": "OpeningHoursSpecification",
      dayOfWeek: "https://schema.org/Monday",
      opens: "09:00",
      closes: "20:00",
    });
  });

  it("REQ-101.7 sin teléfono el JSON-LD no lleva telephone", () => {
    const ld = barberShopJsonLd({
      name: "Gamma Club",
      description: null,
      address: null,
      url: "https://www.gammaclub.co/",
      imageUrl: null,
      telephone: null,
      hours: [],
      services: [],
    });
    expect(ld).not.toHaveProperty("telephone");
    expect(ld).not.toHaveProperty("address");
    expect(ld).not.toHaveProperty("image");
  });

  it("REQ-101.8 solo se miden la portada y las páginas públicas del negocio", () => {
    expect(shouldTrackPath("/")).toBe(true);
    expect(shouldTrackPath("/gamma-club")).toBe(true);
    expect(shouldTrackPath("/gamma-club/cita")).toBe(true);
    for (const p of ["/admin", "/admin/caja", "/app", "/app/fila", "/entrar", "/diseno", "/salud"])
      expect(shouldTrackPath(p)).toBe(false);
    // Las páginas con token no se miden
    for (const p of ["/t/abc", "/c/abc", "/regalo/abc", "/invitacion/abc"])
      expect(shouldTrackPath(p)).toBe(false);
  });
});
