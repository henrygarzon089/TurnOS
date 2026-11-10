import type { Metadata } from "next";
import { GiftCardList, SellGiftCardForm } from "@/components/admin/GiftCardForms";
import { MembershipsMini } from "@/components/admin/MembershipsMini";
import { ModuleHeader, Panel } from "@/components/admin/ModulePage";
import { getGiftCardsView } from "@/lib/actions/giftCards";
import { getMembershipsView } from "@/lib/actions/memberships";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Tarjetas de regalo" };

/**
 * REQ-055.1 vender, REQ-056.1/056.4 enviar por WhatsApp y REQ-059.3 lista con "Saldo por usar"
 * (design.md §15.5). Solo el dueño: lo asegura el layout de /admin. REQ-078.33 (T-180): tabla
 * N.º · Para · Valor · Saldo con Membresías al lado (tablero Dueno-Clientes). "Anular" no se
 * construye aquí: se anula la venta desde la caja (REQ-026).
 */
export default async function GiftCardsPage() {
  const [view, memberships] = await Promise.all([getGiftCardsView(), getMembershipsView()]);
  return (
    <main className="pb-6">
      <ModuleHeader title="Tarjetas de regalo" subtitle="Vender, enviar y ver el saldo" />
      <p className="text-muted mt-3 text-sm">
        Se paga hoy y quien la recibe la usa como medio de pago, en una o varias visitas, durante un
        año.
      </p>
      <SellGiftCardForm view={view!} />
      <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] lg:items-start">
        <Panel title="Tarjetas de regalo">
          <p className="text-muted border-line border-b px-4 py-2 text-sm">
            El mensaje de WhatsApp se edita en Mensajes.
          </p>
          <GiftCardList view={view!} />
        </Panel>
        <MembershipsMini view={memberships!} />
      </div>
    </main>
  );
}
