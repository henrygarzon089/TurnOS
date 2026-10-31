"use server";

import { z } from "zod";
import { getStaffSession } from "@/lib/auth/session";
import { checkPhotoUpload, MAX_BARBER_PHOTOS, PHOTO_LIMIT_ERROR } from "@/lib/media/barber-photos";
import { newBarberPhotoPath } from "@/lib/media/paths";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type PhotoResult = { ok: true } | { ok: false; error: string };

const UPLOAD_FAILED = "No se pudo subir la foto. Revisa tu conexión.";
const isUuid = (v: unknown): v is string => z.string().uuid().safeParse(v).success;

/**
 * REQ-039.1–039.4: guarda el objeto y la fila con la sesión del usuario (políticas de `media` y
 * RLS de `barber_photos`). El navegador ya redujo la foto; acá se revisa de nuevo lo que importa.
 */
export async function uploadBarberPhoto(formData: FormData): Promise<PhotoResult> {
  const session = await getStaffSession();
  if (!session) return { ok: false, error: "Tu sesión terminó. Entra de nuevo." };
  const barberId = formData.get("barber_id");
  const file = formData.get("photo");
  if (!isUuid(barberId) || !(file instanceof File)) return { ok: false, error: UPLOAD_FAILED };
  if (session.role !== "owner" && session.barberId !== barberId) {
    return { ok: false, error: "Solo puedes subir tus propias fotos." };
  }
  const invalid = checkPhotoUpload({
    consent: formData.get("consent") === "on",
    type: file.type,
    size: file.size,
  });
  if (invalid) return { ok: false, error: invalid };

  const supabase = await createSupabaseServerClient();
  // El trigger de la base es el límite real; esto evita subir un archivo que se va a rechazar
  const { count } = await supabase
    .from("barber_photos")
    .select("id", { count: "exact", head: true })
    .eq("barber_id", barberId);
  if ((count ?? 0) >= MAX_BARBER_PHOTOS) return { ok: false, error: PHOTO_LIMIT_ERROR };

  const path = newBarberPhotoPath(session.business.id, barberId);
  const uploaded = await supabase.storage
    .from("media")
    .upload(path, file, { contentType: file.type });
  if (uploaded.error) return { ok: false, error: UPLOAD_FAILED };

  const { error } = await supabase
    .from("barber_photos")
    .insert({ business_id: session.business.id, barber_id: barberId, path });
  if (!error) return { ok: true };
  await supabase.storage.from("media").remove([path]);
  return { ok: false, error: error.code === "P0013" ? PHOTO_LIMIT_ERROR : UPLOAD_FAILED };
}

/** REQ-039.1: RLS decide quién borra; §11.3: si falla el objeto queda un huérfano inofensivo. */
export async function deleteBarberPhoto(id: string): Promise<PhotoResult> {
  const failed: PhotoResult = { ok: false, error: "No se pudo borrar la foto." };
  const session = await getStaffSession();
  if (!session || !isUuid(id)) return failed;
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("barber_photos")
    .delete()
    .eq("id", id)
    .select("path")
    .maybeSingle();
  if (error || !data) return failed;
  await supabase.storage.from("media").remove([data.path as string]);
  return { ok: true };
}
