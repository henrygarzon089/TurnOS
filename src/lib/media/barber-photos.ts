import { MAX_PHOTO_BYTES } from "@/lib/media/resize";

/** REQ-039: mismos tope y textos en el navegador y en el servidor. */
export const MAX_BARBER_PHOTOS = 12;
export const PHOTO_CONSENT_LABEL = "El cliente me dio permiso de publicar esta foto";
export const PHOTO_LIMIT_ERROR = "Ya tienes 12 fotos. Borra una para subir otra";
export const NOT_A_PHOTO_ERROR = "Ese archivo no es una foto";
export const PHOTO_CONSENT_ERROR = "Confirma que el cliente te dio permiso.";
export const PHOTO_TOO_BIG_ERROR = "Esa foto pesa mucho. Prueba con otra.";

export type BarberPhoto = { id: string; path: string };

/** REQ-039.3 / REQ-039.4. Devuelve el error o null si la foto se puede guardar. */
export function checkPhotoUpload(p: {
  consent: boolean;
  type: string;
  size: number;
}): string | null {
  if (!p.consent) return PHOTO_CONSENT_ERROR;
  if (!p.type.startsWith("image/") || p.size === 0) return NOT_A_PHOTO_ERROR;
  if (p.size > MAX_PHOTO_BYTES) return PHOTO_TOO_BIG_ERROR;
  return null;
}
