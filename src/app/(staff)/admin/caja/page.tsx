import type { Metadata } from "next";
import Link from "next/link";
import { CashDay } from "@/components/cash/CashDay";
import { CashDayPicker } from "@/components/cash/CashDayPicker";
import { getCashDay, getClosures } from "@/lib/actions/cash";
import { getStaffSession } from "@/lib/auth/session";
import { formatCOP } from "@/lib/domain/money";
import { formatDayCO } from "@/lib/domain/time";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Caja" };

/** REQ-027.1 Caja de hoy · REQ-026.1 anular · REQ-027.2–27.4 cierre y cierres pasados. */
export default async function CashPage() {
  const session = (await getStaffSession())!;
  const [summary, closures] = await Promise.all([getCashDay(), getClosures()]);
  const past = closures.filter((c) => c.day !== summary!.day);
  return (
    <main data-tablet className="pb-6">
      <CashDay
        businessId={session.business.id}
        businessName={session.business.name}
        initial={summary!}
        isToday
        heading={
          <>
            <h1 className="text-[28px] leading-tight font-bold">Caja de hoy</h1>
            {/* REQ-078.31: la fecha y "Cierres anteriores" junto al título */}
            <CashDayPicker day={summary!.day} today={summary!.day} />
            <a
              href="#cierres"
              className="text-brand flex min-h-12 items-center font-semibold underline underline-offset-4"
            >
              Cierres anteriores
            </a>
          </>
        }
      />
      <section id="cierres" aria-label="Cierres anteriores" className="mt-6 scroll-mt-4">
        <h2 className="mb-2 font-bold">Cierres anteriores</h2>
        {past.length === 0 ? (
          <p className="text-muted text-base">Todavía no hay cierres anteriores.</p>
        ) : (
          <ul className="border-line bg-card divide-line divide-y rounded-md border">
            {past.map((c) => (
              <li key={c.day}>
                <Link
                  href={`/admin/caja/${c.day}`}
                  className="flex min-h-12 flex-wrap items-center justify-between gap-x-3 px-4 py-2 text-base"
                >
                  <span className="font-semibold">{formatDayCO(c.day)}</span>
                  <span className="text-muted text-sm tabular-nums">
                    {formatCOP(c.total)} · diferencia {formatCOP(c.difference)}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
