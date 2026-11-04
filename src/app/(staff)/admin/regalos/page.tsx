import type { Metadata } from "next";
import { AdminNav } from "@/components/admin/AdminNav";
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
    <main className="pb-6">
      <AdminNav current="/admin/regalos" />
      <h1 className="text-2xl font-bold">Tarjetas de regalo</h1>
      <p className="text-muted mt-1 text-sm">
        Se paga hoy y quien la recibe la usa como medio de pago, en una o varias visitas, durante un
        año.
      </p>
      <SellGiftCardForm view={view} />
      <section className="mt-6" aria-labelledby="cards-title">
        <h2 id="cards-title" className="text-lg font-semibold">
          Tarjetas
        </h2>
        <p className="text-muted mt-1 text-sm">El mensaje de WhatsApp se edita en Mensajes.</p>
        <GiftCardList view={view} />
      </section>
    </main>
  );
}
