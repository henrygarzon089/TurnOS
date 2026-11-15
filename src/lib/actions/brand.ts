"use server";

import { z } from "zod";
import { getStaffSession } from "@/lib/auth/session";
import {
  BRAND_FORBIDDEN,
  BRAND_UPLOAD_FAILED,
  canEditBrand,
  checkReducedFile,
  newBrandPath,
  type BrandKind,
} from "@/lib/media/brand";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * Hito 20 (REQ-085…087, REQ-090.2, design.md §26.2): sube la foto ya reducida en el celular al
 * bucket `media` con la sesión del usuario (políticas de 0074), guarda la ruta y borra la anterior.
 */
export type BrandResult = { ok: true; path: string | null } | { ok: false; error: string };

const kindSchema = z.enum(["barber", "service", "logo", "cover"]);
const SESSION_ENDED = "Tu sesión terminó. Entra de nuevo.";

type Supabase = Awaited<ReturnType<typeof createSupabaseServerClient>>;

/** Lee la ruta actual y guarda la nueva (RLS: dueño, o el barbero en su propia fila). */
async function swapPath(
  supabase: Supabase,
  kind: BrandKind,
  businessId: string,
  id: string | null,
  path: string | null,
): Promise<{ ok: true; old: string | null } | { ok: false }> {
  if (kind === "barber" || kind === "service") {
    const table = kind === "barber" ? "barbers" : "services";
    const { data } = await supabase
      .from(table)
      .select("photo_path")
      .eq("id", id!)
      .eq("business_id", businessId)
      .maybeSingle();
    if (!data) return { ok: false };
    const { error } = await supabase
      .from(table)
      .update({ photo_path: path })
      .eq("id", id!)
      .eq("business_id", businessId);
    return error ? { ok: false } : { ok: true, old: (data.photo_path as string | null) ?? null };
  }
  const column = kind === "logo" ? "logo_path" : "cover_path";
  const { data } = await supabase
    .from("businesses")
    .select(column)
    .eq("id", businessId)
    .maybeSingle();
  if (!data) return { ok: false };
  const { error } = await supabase
    .from("businesses")
    .update({ [column]: path })
    .eq("id", businessId);
  const old = (data as Record<string, string | null>)[column] ?? null;
  return error ? { ok: false } : { ok: true, old };
}

async function target(formOrArgs: { kind: unknown; id: unknown }) {
  const session = await getStaffSession();
  if (!session) return { error: SESSION_ENDED } as const;
  const kind = kindSchema.safeParse(formOrArgs.kind);
  if (!kind.success) return { error: BRAND_UPLOAD_FAILED } as const;
  const needsId = kind.data === "barber" || kind.data === "service";
  const id = needsId ? formOrArgs.id : null;
  if (needsId && !z.uuid().safeParse(id).success) return { error: BRAND_UPLOAD_FAILED } as const;
  if (!canEditBrand(session, kind.data, id as string | null)) {
    return { error: BRAND_FORBIDDEN } as const;
  }
  return { session, kind: kind.data, id: id as string | null } as const;
}

/** REQ-085.1/085.2, REQ-086.1, REQ-087.1: `kind`, `id` (barbero o servicio) y `photo`. */
export async function uploadBrandImage(formData: FormData): Promise<BrandResult> {
  const t = await target({ kind: formData.get("kind"), id: formData.get("id") });
  if ("error" in t) return { ok: false, error: t.error! };
  const file = formData.get("photo");
  if (!(file instanceof Blob)) return { ok: false, error: BRAND_UPLOAD_FAILED };
  const invalid = checkReducedFile({ type: file.type, size: file.size });
  if (invalid) return { ok: false, error: invalid };

  const supabase = await createSupabaseServerClient();
  const businessId = t.session.business.id;
  const path = newBrandPath(t.kind, businessId, t.id);
  const up = await supabase.storage.from("media").upload(path, file, { contentType: file.type });
  if (up.error) return { ok: false, error: BRAND_UPLOAD_FAILED };
  const saved = await swapPath(supabase, t.kind, businessId, t.id, path);
  if (!saved.ok) {
    await supabase.storage.from("media").remove([path]);
    return { ok: false, error: BRAND_UPLOAD_FAILED };
  }
  // REQ-090.2: la foto anterior no queda huérfana
  if (saved.old) await supabase.storage.from("media").remove([saved.old]);
  return { ok: true, path };
}

/** REQ-085.1/085.2, REQ-090.2: quita la foto y borra el archivo. */
export async function removeBrandImage(kind: BrandKind, id: string | null): Promise<BrandResult> {
  const t = await target({ kind, id });
  if ("error" in t) return { ok: false, error: t.error! };
  const supabase = await createSupabaseServerClient();
  const saved = await swapPath(supabase, t.kind, t.session.business.id, t.id, null);
  if (!saved.ok) return { ok: false, error: BRAND_UPLOAD_FAILED };
  if (saved.old) await supabase.storage.from("media").remove([saved.old]);
  return { ok: true, path: null };
}
