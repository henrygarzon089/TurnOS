import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { BarberPhotos } from "@/components/photos/BarberPhotos";
import { getStaffSession } from "@/lib/auth/session";
import { MAX_BARBER_PHOTOS, type BarberPhoto } from "@/lib/media/barber-photos";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Mis fotos" };

/** REQ-039.1: el barbero sube y borra las fotos de sus cortes (T-171, tablero Barbero-Otros). */
export default async function MyPhotosPage() {
  const session = (await getStaffSession())!;
  if (!session.barberId) redirect("/admin/barberos");
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("barber_photos")
    .select("id, path")
    .eq("barber_id", session.barberId)
    .order("created_at", { ascending: false })
    .order("id");
  const photos = (data ?? []) as BarberPhoto[];

  return (
    <main className="flex flex-col gap-3 pt-4">
      <header>
        <h1 className="text-2xl font-bold">Mis fotos</h1>
        <p className="text-muted text-sm">
          Salen en tu perfil al tomar turno.{" "}
          <span>
            {photos.length} de {MAX_BARBER_PHOTOS}.
          </span>
        </p>
      </header>
      <BarberPhotos
        fixed
        barberId={session.barberId}
        barberName={session.barberName ?? "barbero"}
        photos={photos}
      />
    </main>
  );
}
