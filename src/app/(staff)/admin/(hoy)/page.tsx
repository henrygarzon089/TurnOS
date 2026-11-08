import type { Metadata } from "next";
import { Suspense } from "react";
import { TodayCardSkeleton } from "@/components/admin/today/TodayCard";
import { TodayCash } from "@/components/admin/today/TodayCash";
import { TodayQueue } from "@/components/admin/today/TodayQueue";
import { LiveRefresh } from "@/components/queue/LiveRefresh";
import { getStaffSession } from "@/lib/auth/session";
import { businessDayBogota, formatDayCO, weekdayName } from "@/lib/domain/time";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Hoy" };

/**
 * REQ-076 "Hoy" del dueño (design §21.1). Cada bloque es un Server Component en su propio
 * Suspense: llega cuando termina, sin esperar a los demás (REQ-076.10). Una sola columna en el
 * celular en el orden de REQ-076.11; rejilla de 12 columnas desde 1024 px. Se relee con cada
 * cambio de la fila o de la caja (REQ-076.3, `LiveRefresh`). El rol lo controla admin/layout.tsx.
 */
export default async function TodayPage() {
  const session = (await getStaffSession())!;
  const day = businessDayBogota();
  return (
    <main data-wide className="pb-6">
      <LiveRefresh businessId={session.business.id} />
      <div className="flex items-baseline gap-3">
        <h1 className="text-3xl font-bold">Hoy</h1>
        <p className="text-muted">
          {weekdayName(day)} {formatDayCO(day)}
        </p>
      </div>
      <div className="mt-4 grid gap-4 lg:grid-cols-12 lg:items-start">
        <div className="lg:col-span-8">
          <Suspense fallback={<TodayCardSkeleton rows={5} />}>
            <TodayQueue />
          </Suspense>
        </div>
        <div className="lg:col-span-4">
          <Suspense fallback={<TodayCardSkeleton rows={6} />}>
            <TodayCash />
          </Suspense>
        </div>
      </div>
    </main>
  );
}
