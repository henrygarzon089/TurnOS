import type { Metadata } from "next";
import Link from "next/link";
import { CleaningBanner } from "@/components/cleaning/CleaningBanner";
import { BarberQueue } from "@/components/queue/BarberQueue";
import { getCleaningToday } from "@/lib/actions/cleaning";
import { getMyQueue } from "@/lib/actions/queue";
import { getStaffSession } from "@/lib/auth/session";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Mi fila" };

/** REQ-006…REQ-010: la fila del barbero. REQ-062.1/062.6: arriba, la limpieza si está encendida. */
export default async function BarberQueuePage() {
  const session = await getStaffSession();
  const [view, cleaning] = await Promise.all([
    session?.barberId ? getMyQueue() : null,
    session ? getCleaningToday() : null,
  ]);
  const banner = cleaning?.enabled ? (
    <CleaningBanner openingPending={cleaning.openingPending} />
  ) : null;
  if (!view) {
    return (
      <main className="py-6">
        {banner}
        <h1 className="mt-4 text-2xl font-bold">Mi fila</h1>
        <p className="text-muted mt-2">
          Tu cuenta no tiene una silla asignada.{" "}
          {session?.role === "owner" ? (
            <Link href="/admin/fila" className="text-brand underline">
              Ir a la fila del negocio
            </Link>
          ) : (
            "Pídele al dueño que revise tu acceso."
          )}
        </p>
      </main>
    );
  }
  return (
    <>
      {banner}
      <BarberQueue initial={view} appUrl={process.env.NEXT_PUBLIC_APP_URL ?? ""} />
    </>
  );
}
