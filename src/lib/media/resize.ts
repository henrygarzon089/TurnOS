/** El celular reduce la foto antes de subirla (design.md §11.3). */
export const MAX_PHOTO_SIDE = 1080;
/** Mismo tope del bucket `media` (0033). */
export const MAX_PHOTO_BYTES = 300 * 1024;
const QUALITIES = [0.85, 0.7, 0.55, 0.4];

export function fitWithin(
  width: number,
  height: number,
  maxSide = MAX_PHOTO_SIDE,
): { width: number; height: number } {
  const scale = Math.min(1, maxSide / Math.max(width, height));
  return { width: Math.round(width * scale), height: Math.round(height * scale) };
}

/**
 * Baja la calidad hasta quedar dentro del límite; null si no se logra. Safari no codifica WebP
 * (entrega PNG, que no baja de peso con la calidad): ahí se usa JPEG.
 */
export async function encodeUnderLimit(
  encode: (type: string, quality: number) => Promise<Blob | null>,
  maxBytes = MAX_PHOTO_BYTES,
): Promise<Blob | null> {
  const probe = await encode("image/webp", QUALITIES[0]);
  const type = probe?.type === "image/webp" ? "image/webp" : "image/jpeg";
  for (const quality of QUALITIES) {
    const blob = await encode(type, quality);
    if (blob && blob.size <= maxBytes) return blob;
  }
  return null;
}

/** Solo en el navegador. Lanza si el archivo no se puede leer como imagen. */
export async function resizePhoto(file: File): Promise<Blob | null> {
  const bitmap = await createImageBitmap(file);
  const { width, height } = fitWithin(bitmap.width, bitmap.height);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  canvas.getContext("2d")?.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();
  return encodeUnderLimit(
    (type, quality) => new Promise((resolve) => canvas.toBlob(resolve, type, quality)),
  );
}
