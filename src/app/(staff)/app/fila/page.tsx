import type { Metadata } from "next";
import Link from "next/link";
import { BarberQueue } from "@/components/queue/BarberQueue";
import { getMyQueue } from "@/lib/actions/queue";
import { getStaffSession } from "@/lib/auth/session";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Mi fila" };

/** REQ-006…REQ-010: la fila del barbero. */
export default async function BarberQueuePage() {
  const session = await getStaffSession();
  const view = session?.barberId ? await getMyQueue() : null;
  if (!view) {
    return (
      <main className="py-6">
        <h1 className="text-2xl font-bold">Mi fila</h1>
        <p className="text-muted mt-2">
          Tu cuenta no tiene una silla asignada.{" "}
          {session?.role === "owner" ? (
            <Link href="/admin/fila" className="text-accent underline">
              Ir a la fila del negocio
            </Link>
          ) : (
            "Pídele al dueño que revise tu acceso."
          )}
        </p>
      </main>
    );
  }
  return <BarberQueue initial={view} appUrl={process.env.NEXT_PUBLIC_APP_URL ?? ""} />;
}
