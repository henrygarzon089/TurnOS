import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { BarberPhotos } from "@/components/photos/BarberPhotos";
import { getStaffSession } from "@/lib/auth/session";
import type { BarberPhoto } from "@/lib/media/barber-photos";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Mis fotos" };

/** REQ-039.1: el barbero sube y borra las fotos de sus cortes. */
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

  return (
    <main className="py-6">
      <h1 className="text-2xl font-bold">Mis fotos</h1>
      <p className="text-muted mt-1 mb-4 text-sm">
        Los clientes las ven al tomar turno, para escoger con quién se cortan.
      </p>
      <BarberPhotos
        barberId={session.barberId}
        barberName={session.barberName ?? "barbero"}
        photos={(data ?? []) as BarberPhoto[]}
      />
    </main>
  );
}
