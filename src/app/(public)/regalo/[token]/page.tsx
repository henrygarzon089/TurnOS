import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { isModuleEnabled } from "@/lib/domain/modules";
import { getGiftCardByToken } from "@/lib/actions/public";
import {
  formatGiftCardCode,
  giftCardConditions,
  giftCardDayLabel,
  giftCardStatusLabel,
  giftCardUsedText,
} from "@/lib/domain/giftCard";
import { formatCOP } from "@/lib/domain/money";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Tarjeta de regalo", robots: { index: false } };

/**
 * REQ-056.2 la tarjeta de regalo, sin cuenta: negocio, "Para", código, saldo, vencimiento y
 * condiciones. REQ-056.3 sin quien la compró ni en qué se gastó. REQ-058.4 "Vencida".
 * REQ-078.24 como el tablero Cliente-Cita (design §22.7): tarjeta `brand` de 218 px con borde
 * derecho `accent`, "Vale por" y el valor original; debajo las filas Saldo y Vence.
 * No se construye: "De parte de", "Mensaje" (no hay esos datos), "Compartir por WhatsApp".
 */
export default async function GiftCardPage({ params }: { params: Promise<{ token: string }> }) {
  // REQ-079.6: con el módulo apagado, a la portada (sin consultar la tarjeta)
  if (!isModuleEnabled("giftCards")) redirect("/");
  const { token } = await params;
  const card = await getGiftCardByToken(token);
  if (!card) notFound();
  const usable = card.status === "active";
  const used = usable ? giftCardUsedText(card) : null;

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col px-4 py-4">
      <section
        aria-label="Tarjeta de regalo"
        className="bg-brand text-brand-ink border-accent flex h-[218px] flex-col justify-between rounded-lg border-r-4 p-5"
      >
        <div className="flex items-baseline justify-between gap-3">
          <p className="truncate font-bold tracking-wide uppercase">{card.businessName}</p>
          <p className="shrink-0 text-xs tracking-widest uppercase opacity-80">Tarjeta de regalo</p>
        </div>
        <div>
          <p className="text-sm opacity-80">Vale por</p>
          <p className="text-5xl leading-tight font-bold tabular-nums">{formatCOP(card.amount)}</p>
        </div>
        <div className="flex items-end justify-between gap-3 text-sm">
          <p className="min-w-0 truncate">
            {card.recipientName && (
              <>
                Para <strong>{card.recipientName}</strong>
              </>
            )}
          </p>
          <p
            className={`shrink-0 font-mono text-base tracking-widest ${usable ? "" : "line-through"}`}
          >
            {formatGiftCardCode(card.code)}
          </p>
        </div>
      </section>

      <dl className="border-line mt-4 border-t">
        <div
          data-testid="row-saldo"
          className="border-line flex min-h-14 items-center gap-3 border-b py-3"
        >
          <dt className="text-muted w-24 shrink-0">Saldo</dt>
          <dd className="flex-1 text-xl font-bold tabular-nums">
            {usable ? formatCOP(card.balance) : giftCardStatusLabel(card.status)}
          </dd>
          {used && <dd className="text-muted text-sm tabular-nums">{used}</dd>}
        </div>
        <div
          data-testid="row-vence"
          className="border-line flex min-h-14 items-center gap-3 border-b py-3"
        >
          <dt className="text-muted w-24 shrink-0">Vence</dt>
          <dd className="flex-1">{giftCardDayLabel(card.expiresOn)}</dd>
        </div>
      </dl>

      {usable && (
        <p className="text-muted mt-4 text-sm">
          Se usa al pagar en el local: dile al barbero el código de la tarjeta.
        </p>
      )}
      <section aria-labelledby="conditions-title" className="mt-4 text-sm">
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
