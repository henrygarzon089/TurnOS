import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { CashDay } from "@/components/cash/CashDay";
import { CashDayPicker } from "@/components/cash/CashDayPicker";
import { getCashDay } from "@/lib/actions/cash";
import { getStaffSession } from "@/lib/auth/session";
import { businessDayBogota, formatDayCO } from "@/lib/domain/time";
import { cashFeatures } from "@/lib/domain/modules";

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
    <main data-tablet className="pb-6">
      <CashDay
        features={cashFeatures()}
        businessId={session.business.id}
        businessName={session.business.name}
        initial={summary}
        isToday={false}
        heading={
          <>
            <h1 className="text-[28px] leading-tight font-bold">Caja del {formatDayCO(fecha)}</h1>
            {/* REQ-078.31: la fecha y "Cierres anteriores" junto al título */}
            <CashDayPicker day={fecha} today={businessDayBogota()} />
            <Link
              href="/admin/caja#cierres"
              className="text-brand flex min-h-12 items-center font-semibold underline underline-offset-4"
            >
              Cierres anteriores
            </Link>
            <Link
              href="/admin/caja"
              className="text-brand flex min-h-12 items-center font-semibold underline underline-offset-4"
            >
              Caja de hoy
            </Link>
          </>
        }
      />
    </main>
  );
}
