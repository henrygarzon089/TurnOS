import { describe, expect, it } from "vitest";
import { businessManifest, businessPwaMetadata } from "@/lib/pwa";

const b = { name: "Barbería La 33", pwaName: "La 33", slug: "la-33" };

describe("REQ-032.1 app instalable por negocio (PA-22: marca blanca)", () => {
  it("REQ-032.1 el manifest usa el nombre de la app del negocio y abre su fila", () => {
    const m = businessManifest(b);
    expect(m).toMatchObject({
      name: "La 33",
      short_name: "La 33",
      start_url: "/la-33",
      scope: "/",
      display: "standalone",
      lang: "es-CO",
    });
    expect(m.icons?.map((i) => i.sizes)).toEqual(["192x192", "512x512", "512x512"]);
  });

  it("REQ-032.1 sin nombre de app configurado usa el nombre del negocio", () => {
    expect(businessManifest({ ...b, pwaName: "" }).name).toBe("Barbería La 33");
  });

  it("REQ-032.1 short_name cabe bajo el ícono (≤ 12 caracteres)", () => {
    expect(businessManifest({ ...b, pwaName: "" }).short_name).toBe("Barbería La…");
  });

  it("REQ-032.1 iOS: manifest del negocio y título de la app", () => {
    const meta = businessPwaMetadata(b);
    expect(meta.manifest).toBe("/la-33/manifest.webmanifest");
    expect(meta.appleWebApp).toMatchObject({ capable: true, title: "La 33" });
    expect(meta.icons).toBeUndefined(); // el apple-touch-icon viene del layout raíz
  });
});
