import type { Metadata } from "next";
import Link from "next/link";
import { AdminNav } from "@/components/admin/AdminNav";
import { CashDay } from "@/components/cash/CashDay";
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
    <main className="pb-6">
      <AdminNav current="/admin/caja" />
      <h1 className="text-2xl font-bold">Caja de hoy</h1>
      <p className="text-muted text-sm">{formatDayCO(summary!.day)}</p>
      <CashDay
        businessId={session.business.id}
        businessName={session.business.name}
        initial={summary!}
        isToday
      />
      {past.length > 0 && (
        <section aria-label="Cierres anteriores" className="mt-6">
          <h2 className="mb-2 font-semibold">Cierres anteriores</h2>
          <ul className="border-line bg-card divide-line divide-y rounded-xl border">
            {past.map((c) => (
              <li key={c.day}>
                <Link
                  href={`/admin/caja/${c.day}`}
                  className="flex min-h-12 items-center justify-between px-4 text-sm"
                >
                  <span className="font-medium">{formatDayCO(c.day)}</span>
                  <span className="text-muted">
                    {formatCOP(c.total)} · diferencia {formatCOP(c.difference)}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}
