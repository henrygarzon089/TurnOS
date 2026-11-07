import type { Metadata } from "next";
import { CleaningToday } from "@/components/cleaning/CleaningToday";
import { getCleaningToday } from "@/lib/actions/cleaning";
import { getStaffSession } from "@/lib/auth/session";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Limpieza" };

/** REQ-061, REQ-062.6: la limpieza del día para el barbero (y el dueño). */
export default async function CleaningPage({
  searchParams,
}: {
  searchParams: Promise<{ abrir?: string }>;
}) {
  const [session, today, { abrir }] = await Promise.all([
    getStaffSession(),
    getCleaningToday(),
    searchParams,
  ]);
  if (!session || !today || !today.enabled) {
    return (
      <main className="py-6">
        <h1 className="text-2xl font-bold">Limpieza</h1>
        <p className="text-muted mt-2">
          La limpieza está apagada. El dueño la enciende en el panel.
        </p>
      </main>
    );
  }
  return (
    <main className="py-6">
      <h1 className="text-2xl font-bold">Limpieza</h1>
      <CleaningToday
        today={today}
        businessId={session.business.id}
        initialOpen={abrir === "apertura" && !today.opening ? "opening" : null}
      />
    </main>
  );
}
