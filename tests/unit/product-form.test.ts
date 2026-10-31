import { describe, expect, it } from "vitest";
import { parseProductForm } from "@/lib/domain/product-form";
import { isProductPhotoPath, mediaUrl, newProductPhotoPath } from "@/lib/media/paths";

const BIZ = "11111111-2222-4333-8444-555555555555";
const PHOTO = `${BIZ}/products/aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee.webp`;
const form = (over = {}) => ({
  name: " Gaseosa ",
  price: "4.000",
  forSale: true,
  isCourtesy: false,
  photoPath: null,
  ...over,
});

describe("REQ-038.1 formulario de producto", () => {
  it("REQ-038.1 a la venta, de cortesía o ambas", () => {
    expect(parseProductForm(form(), BIZ)).toEqual({
      ok: true,
      row: { name: "Gaseosa", price: 4000, for_sale: true, is_courtesy: false, photo_path: null },
    });
    expect(parseProductForm(form({ forSale: false, isCourtesy: true }), BIZ)).toMatchObject({
      ok: true,
      row: { price: 4000, for_sale: false, is_courtesy: true },
    });
    expect(parseProductForm(form({ isCourtesy: true }), BIZ)).toMatchObject({
      ok: true,
      row: { for_sale: true, is_courtesy: true },
    });
  });

  it("REQ-038.1 sin ninguna de las dos el producto no saldría en ningún lado: se rechaza", () => {
    expect(parseProductForm(form({ forSale: false }), BIZ)).toEqual({
      ok: false,
      error: "Marca si es a la venta, de cortesía o ambas.",
    });
  });

  it("REQ-038.1 solo de cortesía no necesita precio; a la venta sí", () => {
    expect(
      parseProductForm(form({ price: "", forSale: false, isCourtesy: true }), BIZ),
    ).toMatchObject({ ok: true, row: { price: 0 } });
    expect(parseProductForm(form({ price: "" }), BIZ)).toEqual({
      ok: false,
      error: "El precio debe ser un número entero en pesos.",
    });
    expect(parseProductForm(form({ price: "abc", isCourtesy: true }), BIZ)).toEqual({
      ok: false,
      error: "El precio debe ser un número entero en pesos.",
    });
  });

  it("REQ-024.1 el producto necesita nombre", () => {
    expect(parseProductForm(form({ name: "  " }), BIZ)).toEqual({
      ok: false,
      error: "El producto necesita un nombre.",
    });
    expect(parseProductForm(form({ name: "x".repeat(61) }), BIZ)).toEqual({
      ok: false,
      error: "El nombre es muy largo.",
    });
  });

  it("REQ-038.1 la foto es opcional y debe ser del mismo negocio", () => {
    expect(parseProductForm(form({ photoPath: PHOTO }), BIZ)).toMatchObject({
      ok: true,
      row: { photo_path: PHOTO },
    });
    expect(parseProductForm(form({ photoPath: "" }), BIZ)).toMatchObject({
      ok: true,
      row: { photo_path: null },
    });
    const ajena = PHOTO.replace(BIZ, "99999999-2222-4333-8444-555555555555");
    expect(parseProductForm(form({ photoPath: ajena }), BIZ)).toEqual({
      ok: false,
      error: "No se pudo guardar la foto. Vuelve a subirla.",
    });
  });
});

describe("REQ-038.1 rutas del bucket media (design.md §11.3)", () => {
  it("REQ-038.1 la ruta nueva cumple el patrón de las políticas de Storage", () => {
    const path = newProductPhotoPath(BIZ);
    expect(path).toMatch(
      new RegExp(
        `^${BIZ}/products/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\\.webp$`,
      ),
    );
    expect(isProductPhotoPath(BIZ, path)).toBe(true);
  });

  it("REQ-038.1 rechaza rutas de barberos, sin extensión o con otro formato", () => {
    for (const bad of [
      `${BIZ}/barbers/aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee/aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee.webp`,
      `${BIZ}/products/foto.webp`,
      `${BIZ}/products/aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee.png`,
      `../${PHOTO}`,
    ]) {
      expect(isProductPhotoPath(BIZ, bad)).toBe(false);
    }
  });

  it("REQ-038.2 arma la URL pública del bucket", () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://x.supabase.co";
    expect(mediaUrl(PHOTO)).toBe(`https://x.supabase.co/storage/v1/object/public/media/${PHOTO}`);
  });
});
