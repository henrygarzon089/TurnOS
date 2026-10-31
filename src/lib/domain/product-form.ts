import { parseCOP } from "@/lib/domain/money";
import { isProductPhotoPath } from "@/lib/media/paths";

export type ProductFormInput = {
  name: string;
  price: string;
  forSale: boolean;
  isCourtesy: boolean;
  /** Ruta en el bucket `media`; vacía = sin foto. */
  photoPath: string | null;
};

export type ProductRowInput = {
  name: string;
  price: number;
  for_sale: boolean;
  is_courtesy: boolean;
  photo_path: string | null;
};

/**
 * REQ-024.1 / REQ-038.1: valida el formulario de producto. Lo que es solo de cortesía no se cobra:
 * puede quedar sin precio. Sin ninguna de las dos marcas no saldría en ningún lado.
 */
export function parseProductForm(
  form: ProductFormInput,
  businessId: string,
): { ok: true; row: ProductRowInput } | { ok: false; error: string } {
  const name = form.name.trim();
  if (!name) return { ok: false, error: "El producto necesita un nombre." };
  if (name.length > 60) return { ok: false, error: "El nombre es muy largo." };
  if (!form.forSale && !form.isCourtesy) {
    return { ok: false, error: "Marca si es a la venta, de cortesía o ambas." };
  }
  const price = !form.forSale && !form.price.trim() ? 0 : parseCOP(form.price);
  if (price === null) {
    return { ok: false, error: "El precio debe ser un número entero en pesos." };
  }
  const photoPath = form.photoPath || null;
  if (photoPath && !isProductPhotoPath(businessId, photoPath)) {
    return { ok: false, error: "No se pudo guardar la foto. Vuelve a subirla." };
  }
  return {
    ok: true,
    row: {
      name,
      price,
      for_sale: form.forSale,
      is_courtesy: form.isCourtesy,
      photo_path: photoPath,
    },
  };
}
