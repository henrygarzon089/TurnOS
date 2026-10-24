import type { Metadata } from "next";
import { getStaffSession } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Mi fila" };

/** Placeholder de T-006; la fila real llega en T-021. */
export default async function BarberQueuePage() {
  const session = await getStaffSession();
  return (
    <main className="py-6">
      <h1 className="text-2xl font-bold">Mi fila</h1>
      <p className="text-muted mt-2">
        Hola, {session?.barberName ?? "barbero"}. Aquí verás tus turnos (próximamente).
      </p>
    </main>
  );
}
