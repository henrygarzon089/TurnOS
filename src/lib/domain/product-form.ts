import { normalizeDescription, PRODUCT_DESCRIPTION_MAX } from "@/lib/domain/description";
import { parseCOP } from "@/lib/domain/money";
import { isProductPhotoPath } from "@/lib/media/paths";

export type ProductFormInput = {
  name: string;
  price: string;
  forSale: boolean;
  isCourtesy: boolean;
  /** Ruta en el bucket `media`; vacía = sin foto. */
  photoPath: string | null;
  /** REQ-065.2 "Da comisión al que vende". */
  commissionable?: boolean;
  /** REQ-065.3 categoría opcional de la vitrina. */
  category?: string;
  /** REQ-098.1 descripción del menú; sin el campo en el formulario, no se toca. */
  description?: string;
};

export type ProductRowInput = {
  name: string;
  price: number;
  for_sale: boolean;
  is_courtesy: boolean;
  photo_path: string | null;
  commissionable: boolean;
  category: string | null;
  /** Solo si el formulario trae el campo (REQ-098.2). */
  description?: string | null;
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
  const category = (form.category ?? "").trim() || null;
  if (category && category.length > 30) {
    return { ok: false, error: "La categoría tiene máximo 30 letras." };
  }
  const description =
    form.description === undefined
      ? undefined
      : normalizeDescription(form.description, PRODUCT_DESCRIPTION_MAX);
  if (description && !description.ok) return { ok: false, error: description.error };
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
      commissionable: form.commissionable ?? false,
      category,
      ...(description ? { description: description.value } : {}),
    },
  };
}
