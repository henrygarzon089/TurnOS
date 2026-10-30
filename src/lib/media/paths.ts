/** Rutas y URL del bucket público `media` (design.md §11.3). */
const UUID = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";

/** REQ-038.1: `<negocio>/products/<uuid>.webp`, la ruta que admiten las políticas de Storage. */
export function newProductPhotoPath(businessId: string): string {
  return `${businessId}/products/${crypto.randomUUID()}.webp`;
}

export function isProductPhotoPath(businessId: string, path: string): boolean {
  return new RegExp(`^${businessId}/products/${UUID}\\.webp$`).test(path);
}

/** Las fotos salen en páginas sin sesión: URL pública del bucket. */
export function mediaUrl(path: string): string {
  return `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/media/${path}`;
}
