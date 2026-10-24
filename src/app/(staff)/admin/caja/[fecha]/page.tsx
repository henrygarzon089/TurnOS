import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { AdminNav } from "@/components/admin/AdminNav";
import { CashDay } from "@/components/cash/CashDay";
import { getCashDay } from "@/lib/actions/cash";
import { getStaffSession } from "@/lib/auth/session";
import { businessDayBogota, formatDayCO } from "@/lib/domain/time";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Cierre de caja" };

/** REQ-027.4 caja de un día pasado (cierre en modo lectura, compartir, reabrir). */
export default async function PastCashPage({ params }: { params: Promise<{ fecha: string }> }) {
  const { fecha } = await params;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) notFound();
  if (fecha === businessDayBogota()) redirect("/admin/caja");
  const session = (await getStaffSession())!;
  const summary = await getCashDay(fecha);
  if (!summary) notFound();
  return (
    <main className="pb-6">
      <AdminNav current="/admin/caja" />
      <Link href="/admin/caja" className="text-accent min-h-10 text-sm font-medium">
        ← Caja de hoy
      </Link>
      <h1 className="text-2xl font-bold">Caja del {formatDayCO(fecha)}</h1>
      <CashDay
        businessId={session.business.id}
        businessName={session.business.name}
        initial={summary}
        isToday={false}
      />
    </main>
  );
}
