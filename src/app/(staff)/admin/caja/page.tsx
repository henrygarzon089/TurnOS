import type { Metadata } from "next";
import { AdminNav } from "@/components/admin/AdminNav";
import { NewSaleButton } from "@/components/cash/NewSaleSheet";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Caja" };

/** REQ-027.1 Caja de hoy (T-045) · REQ-023.4 / REQ-024.2 Nueva venta (T-044). */
export default function CashPage() {
  return (
    <main className="pb-6">
      <AdminNav current="/admin/caja" />
      <h1 className="text-2xl font-bold">Caja de hoy</h1>
      <div className="mt-4">
        <NewSaleButton />
      </div>
    </main>
  );
}
