import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ModuleHeader } from "@/components/admin/ModulePage";
import { WeekSummary } from "@/components/cash/WeekSummary";
import { getWeekSummary } from "@/lib/actions/cash";
import { bogotaWeekStart } from "@/lib/domain/time";
import { cashFeatures } from "@/lib/domain/modules";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Semana" };

/**
 * REQ-028 resumen semanal (lunes a domingo, PA-21), por defecto la semana actual; REQ-078.32
 * liquidación como el tablero Dueno-Operacion (T-180).
 */
export default async function WeekPage({
  searchParams,
}: {
  searchParams: Promise<{ semana?: string }>;
}) {
  const { semana } = await searchParams;
  const data = await getWeekSummary(semana);
  if (!data) notFound();
  return (
    <main className="pb-6">
      <ModuleHeader title="Semana" subtitle="Resumen y liquidación de comisiones" />
      <WeekSummary
        features={cashFeatures()}
        current={data.current}
        previous={data.previous}
        pcts={data.pcts}
        purchases={data.purchases}
        thisWeek={bogotaWeekStart()}
      />
    </main>
  );
}
