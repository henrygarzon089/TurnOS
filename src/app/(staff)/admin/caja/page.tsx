import type { Metadata } from "next";
import { AdminNav } from "@/components/admin/AdminNav";
import { CashDay } from "@/components/cash/CashDay";
import { getCashDay } from "@/lib/actions/cash";
import { getStaffSession } from "@/lib/auth/session";
import { formatDayCO } from "@/lib/domain/time";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Caja" };

/** REQ-027.1 Caja de hoy · REQ-026.1 anular · REQ-023.4 / REQ-024.2 Nueva venta. */
export default async function CashPage() {
  const session = (await getStaffSession())!;
  const summary = (await getCashDay())!;
  return (
    <main className="pb-6">
      <AdminNav current="/admin/caja" />
      <h1 className="text-2xl font-bold">Caja de hoy</h1>
      <p className="text-muted text-sm">{formatDayCO(summary.day)}</p>
      <CashDay businessId={session.business.id} initial={summary} />
    </main>
  );
}
