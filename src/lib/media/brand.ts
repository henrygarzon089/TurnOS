/**
 * Hito 20 (REQ-085…087, REQ-090.2, ADR-063, design.md §26): fotos del barbero, de los servicios,
 * logo y portada en el bucket público `media`. Lógica pura: rutas, tamaños, permisos y mensajes.
 */
import { MAX_PHOTO_BYTES } from "@/lib/media/resize";

export type BrandKind = "barber" | "service" | "logo" | "cover";

/** Tamaño final de cada foto (REQ-085.3, REQ-086.1, REQ-087.1). */
export const BRAND_SIZES: Record<BrandKind, { width: number; height: number }> = {
  barber: { width: 400, height: 400 },
  service: { width: 600, height: 400 },
  logo: { width: 256, height: 256 },
  cover: { width: 1200, height: 600 },
};

/** Lo que se puede escoger en el celular antes de reducirla (REQ-085.3). */
export const MAX_PICKED_BYTES = 10 * 1024 * 1024;
export const PICK_ERROR = "Sube una foto de hasta 10 MB.";
export const BRAND_UPLOAD_FAILED = "No se pudo subir la foto. Revisa tu conexión.";
export const BRAND_FORBIDDEN = "No puedes cambiar esta foto.";

/** REQ-085.3: error para el archivo escogido, o null si se puede reducir y subir. */
export function checkPickedFile(f: { type: string; size: number }): string | null {
  if (!f.type.startsWith("image/") || f.size === 0 || f.size > MAX_PICKED_BYTES) return PICK_ERROR;
  return null;
}

/** Lo que llega al servidor ya reducido: imagen de hasta 300 KB (tope del bucket `media`). */
export function checkReducedFile(f: { type: string; size: number }): string | null {
  if (!f.type.startsWith("image/") || f.size === 0 || f.size > MAX_PHOTO_BYTES) return PICK_ERROR;
  return null;
}

/** Ruta nueva en `media` que admiten `media_can_write` y los `check` de 0074. */
export function newBrandPath(kind: BrandKind, businessId: string, id: string | null): string {
  const file = `${crypto.randomUUID()}.webp`;
  if (kind === "barber") return `${businessId}/barbers/${id}/${file}`;
  if (kind === "service") return `${businessId}/services/${file}`;
  return `${businessId}/brand/${file}`;
}

/** REQ-085.1/085.2, REQ-090.2: el dueño cambia todas; el barbero solo su propia foto. */
export function canEditBrand(
  session: { role: string; barberId: string | null },
  kind: BrandKind,
  id: string | null,
): boolean {
  if (session.role === "owner") return true;
  return kind === "barber" && id !== null && session.barberId === id;
}
