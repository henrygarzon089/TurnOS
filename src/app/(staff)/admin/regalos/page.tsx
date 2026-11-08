import type { Metadata } from "next";
import { ModuleHeader, Panel } from "@/components/admin/ModulePage";
import { GiftCardList, SellGiftCardForm } from "@/components/admin/GiftCardForms";
import { getGiftCardsView } from "@/lib/actions/giftCards";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Tarjetas de regalo" };

/**
 * REQ-055.1 vender, REQ-056.1/056.4 enviar por WhatsApp y REQ-059.3 lista con "Saldo por usar"
 * (design.md §15.5). Solo el dueño: lo asegura el layout de /admin.
 */
export default async function GiftCardsPage() {
  const view = (await getGiftCardsView())!;
  return (
    <main data-wide className="pb-6">
      <ModuleHeader title="Tarjetas de regalo" subtitle="Vender, enviar y ver el saldo" />
      <p className="text-muted mt-3 text-sm">
        Se paga hoy y quien la recibe la usa como medio de pago, en una o varias visitas, durante un
        año.
      </p>
      <SellGiftCardForm view={view} />
      <Panel title="Tarjetas" className="mt-4">
        <p className="text-muted border-line border-b px-4 py-2 text-sm">
          El mensaje de WhatsApp se edita en Mensajes.
        </p>
        <GiftCardList view={view} />
      </Panel>
    </main>
  );
}
