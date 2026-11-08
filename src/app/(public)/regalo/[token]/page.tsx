import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getGiftCardByToken } from "@/lib/actions/public";
import { formatGiftCardCode, giftCardConditions, giftCardHeadline } from "@/lib/domain/giftCard";
import { formatCOP } from "@/lib/domain/money";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Tarjeta de regalo", robots: { index: false } };

/**
 * REQ-056.2 la tarjeta de regalo, sin cuenta: negocio, "Para", código, saldo, vencimiento y
 * condiciones. REQ-056.3 sin quien la compró ni en qué se gastó. REQ-058.4 "Vencida".
 */
export default async function GiftCardPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const card = await getGiftCardByToken(token);
  if (!card) notFound();
  const usable = card.status === "active";

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-4 px-4 py-8">
      <p className="text-muted text-center text-sm">{card.businessName}</p>
      <section
        aria-label="Tarjeta de regalo"
        className="bg-ink text-card flex flex-col gap-3 rounded-md p-6 text-center shadow"
      >
        <p className="text-sm tracking-wide uppercase">Tarjeta de regalo</p>
        {card.recipientName && <p className="text-xl font-semibold">Para {card.recipientName}</p>}
        <p className="text-3xl font-bold">{giftCardHeadline(card)}</p>
        {usable && card.balance !== card.amount && (
          <p className="text-sm">de {formatCOP(card.amount)}</p>
        )}
        <div>
          <p className="text-xs">Código</p>
          <p className={`font-mono text-2xl tracking-widest ${usable ? "" : "line-through"}`}>
            {formatGiftCardCode(card.code)}
          </p>
        </div>
      </section>
      {usable && (
        <p className="text-center">Muestra este código al pagar en {card.businessName}.</p>
      )}
      <section aria-labelledby="conditions-title" className="text-sm">
        <h2 id="conditions-title" className="font-semibold">
          Condiciones
        </h2>
        <ul className="text-muted mt-1 list-disc pl-5">
          {giftCardConditions(card.expiresOn).map((c) => (
            <li key={c}>{c}</li>
          ))}
        </ul>
      </section>
    </main>
  );
}
