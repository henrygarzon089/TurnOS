import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AdminNav } from "@/components/admin/AdminNav";
import { WeekSummary } from "@/components/cash/WeekSummary";
import { getWeekSummary } from "@/lib/actions/cash";
import { bogotaWeekStart, formatDayCO } from "@/lib/domain/time";
import { shiftWeek } from "@/lib/domain/week";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Semana" };

/** REQ-028 resumen semanal (lunes a domingo, PA-21), por defecto la semana actual. */
export default async function WeekPage({
  searchParams,
}: {
  searchParams: Promise<{ semana?: string }>;
}) {
  const { semana } = await searchParams;
  const data = await getWeekSummary(semana);
  if (!data) notFound();
  const w = data.current;
  const thisWeek = bogotaWeekStart();
  return (
    <main className="pb-6">
      <AdminNav current="/admin/semana" />
      <h1 className="text-2xl font-bold">Semana</h1>
      <nav aria-label="Elegir semana" className="mt-2 flex items-center justify-between gap-2">
        <Link
          href={`/admin/semana?semana=${shiftWeek(w.weekStart, -1)}`}
          className="btn-secondary w-auto shrink-0 px-3 text-base"
        >
          ← Anterior
        </Link>
        <p className="text-center text-sm font-semibold" data-testid="week-label">
          {formatDayCO(w.weekStart)} – {formatDayCO(w.weekEnd)}
        </p>
        {w.weekStart < thisWeek ? (
          <Link
            href={`/admin/semana?semana=${shiftWeek(w.weekStart, 1)}`}
            className="btn-secondary w-auto shrink-0 px-3 text-base"
          >
            Siguiente →
          </Link>
        ) : (
          <span className="w-24" aria-hidden />
        )}
      </nav>
      <WeekSummary current={w} previous={data.previous} />
    </main>
  );
}
