import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ModuleHeader } from "@/components/admin/ModulePage";
import { WeekSummary } from "@/components/cash/WeekSummary";
import { Icon } from "@/components/ui/Icon";
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
  const arrow =
    "border-line-strong text-ink inline-flex size-12 shrink-0 items-center justify-center rounded-md border";
  return (
    <main className="pb-6">
      <ModuleHeader title="Semana" subtitle="Resumen y liquidación de comisiones" />
      <nav
        aria-label="Elegir semana"
        className="border-line bg-card mt-4 flex items-center justify-between gap-2 rounded-md border p-2 sm:justify-start"
      >
        <Link
          href={`/admin/semana?semana=${shiftWeek(w.weekStart, -1)}`}
          aria-label="Semana anterior"
          className={arrow}
        >
          <Icon name="back" />
        </Link>
        <p className="text-center font-bold" data-testid="week-label">
          {formatDayCO(w.weekStart)} – {formatDayCO(w.weekEnd)}
        </p>
        {w.weekStart < thisWeek ? (
          <Link
            href={`/admin/semana?semana=${shiftWeek(w.weekStart, 1)}`}
            aria-label="Semana siguiente"
            className={arrow}
          >
            <Icon name="next" />
          </Link>
        ) : (
          <span className="size-12 shrink-0" aria-hidden />
        )}
      </nav>
      <WeekSummary current={w} previous={data.previous} />
    </main>
  );
}
