import type { Metadata } from "next";
import { getStaffSession } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Administración" };

/** Placeholder de T-006; la fila del dueño llega en T-025. */
export default async function AdminHomePage() {
  const session = await getStaffSession();
  return (
    <main className="py-6">
      <h1 className="text-2xl font-bold">{session?.business.name}</h1>
      <p className="text-muted mt-2">Panel del dueño (en construcción).</p>
    </main>
  );
}
