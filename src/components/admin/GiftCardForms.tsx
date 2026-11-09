"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Tag } from "@/components/admin/ModulePage";
import { ErrorText } from "@/components/auth/LoginForm";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { OptionList } from "@/components/ui/OptionList";
import { Sheet } from "@/components/ui/Sheet";
import { EmptyState } from "@/components/ui/States";
import {
  sellGiftCard,
  type GiftCardRow,
  type GiftCardsView,
  type SellGiftCardState,
} from "@/lib/actions/giftCards";
import {
  balanceToUse,
  formatGiftCardCode,
  giftCardDayLabel,
  giftCardStatusLabel,
  giftCardUrl,
  type GiftCardSaleMethod,
} from "@/lib/domain/giftCard";
import { formatCOP } from "@/lib/domain/money";
import { maskPhone } from "@/lib/domain/phone";
import { buildGiftCardLink } from "@/lib/notifications/reminder";

const METHODS: { id: GiftCardSaleMethod; label: string }[] = [
  { id: "cash", label: "Efectivo" },
  { id: "nequi", label: "Nequi" },
  { id: "daviplata", label: "Daviplata" },
  { id: "transfer", label: "Transferencia" },
  { id: "card", label: "Tarjeta" },
];

type SendProps = Pick<GiftCardsView, "template" | "businessName" | "appUrl">;

/**
 * REQ-056.1 / REQ-056.4: enviar (o reenviar) la tarjeta a quien la compró. Relleno solo recién
 * vendida; en la lista va en contorno (REQ-078.4).
 */
function SendButton({
  card,
  view,
  primary = false,
  compact = false,
}: {
  card: GiftCardRow;
  view: SendProps;
  primary?: boolean;
  /** En la tabla: enlace verde "WhatsApp" de 48 px (REQ-078.33). */
  compact?: boolean;
}) {
  return (
    <a
      className={
        compact
          ? "text-ok inline-flex min-h-12 items-center font-bold whitespace-nowrap underline underline-offset-4"
          : `${primary ? "btn-primary" : "btn-secondary"} w-full text-base sm:w-auto`
      }
      aria-label={compact ? `Enviar por WhatsApp la tarjeta de ${card.buyerName}` : undefined}
      href={buildGiftCardLink({
        phoneE164: card.buyerPhone,
        template: view.template,
        buyerName: card.buyerName,
        businessName: view.businessName,
        amount: card.amount,
        url: giftCardUrl(view.appUrl, card.token),
        expiresOn: card.expiresOn,
      })}
      target="_blank"
      rel="noopener"
    >
      {compact ? "WhatsApp" : "Enviar por WhatsApp"}
    </a>
  );
}

/**
 * REQ-055.1–055.3: vender una tarjeta. "Vender tarjeta" es el principal de la pantalla y abre la
 * hoja con el formulario; al terminar, la hoja se cierra y queda el código con "Enviar por
 * WhatsApp" como principal (tablero Dueno-Clientes, T-166).
 */
export function SellGiftCardForm({ view }: { view: SendProps }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [state, setState] = useState<SellGiftCardState>(undefined);
  const [method, setMethod] = useState<GiftCardSaleMethod>("cash");
  const [pending, startTransition] = useTransition();
  const sold = state?.ok ? state.card : null;

  // onSubmit y no `action`: React limpia el formulario al terminar una `action`, aunque falle.
  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    startTransition(async () => {
      const r = await sellGiftCard(state, new FormData(form));
      setState(r);
      if (r?.ok) {
        form.reset();
        setMethod("cash");
        setOpen(false);
        router.refresh();
      }
    });
  }

  return (
    <div className="mt-4 flex flex-col gap-3">
      <Button
        variant={sold ? "secondary" : "primary"}
        className="w-full sm:w-auto sm:self-start"
        onClick={() => {
          setState(undefined);
          setOpen(true);
        }}
      >
        <Icon name="plus" />
        Vender tarjeta
      </Button>
      {sold && (
        <div
          role="status"
          aria-label="Tarjeta vendida"
          className="border-ok bg-card flex flex-col gap-2 rounded-md border-2 p-4"
        >
          <p className="text-ok text-sm font-medium">Tarjeta vendida. Quedó en la caja de hoy.</p>
          <p className="text-2xl font-bold tracking-widest">{formatGiftCardCode(sold.code)}</p>
          <p className="text-sm">
            {formatCOP(sold.amount)}
            {sold.recipientName ? ` · Para ${sold.recipientName}` : ""} · vence el{" "}
            {giftCardDayLabel(sold.expiresOn)}
          </p>
          <SendButton card={sold} view={view} primary />
        </div>
      )}
      <Sheet open={open} onClose={() => setOpen(false)} title="Vender tarjeta">
        <form onSubmit={onSubmit} aria-label="Vender tarjeta" className="flex flex-col gap-3">
          <label className="flex flex-col gap-1 text-sm font-semibold">
            Valor
            <input
              name="amount"
              inputMode="numeric"
              required
              placeholder="50.000"
              autoComplete="off"
              className="input"
            />
            <span className="text-muted text-xs font-normal">
              En miles, de $ 10.000 a $ 500.000. Vence en un año.
            </span>
          </label>
          <label className="flex flex-col gap-1 text-sm font-semibold">
            Nombre de quien compra
            <input
              name="name"
              required
              minLength={2}
              maxLength={60}
              autoComplete="off"
              className="input"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm font-semibold">
            Celular de quien compra
            <input
              name="phone"
              type="tel"
              inputMode="tel"
              required
              placeholder="300 123 4567"
              autoComplete="off"
              className="input"
            />
            <span className="text-muted text-xs font-normal">
              Ahí le llega la tarjeta por WhatsApp.
            </span>
          </label>
          <label className="flex flex-col gap-1 text-sm font-semibold">
            Para (opcional)
            <input
              name="recipient"
              maxLength={40}
              placeholder="Mateo"
              autoComplete="off"
              className="input"
            />
          </label>
          <OptionList
            name="method"
            legend="Medio de pago"
            layout="grid"
            options={METHODS.map((m) => ({ value: m.id, label: m.label }))}
            value={method}
            onChange={(v) => setMethod(v as GiftCardSaleMethod)}
          />
          {state && !state.ok && state.error && <ErrorText>{state.error}</ErrorText>}
          <Button type="submit" pending={pending}>
            Vender tarjeta
          </Button>
          <Button variant="text" className="mx-auto" onClick={() => setOpen(false)}>
            Cerrar
          </Button>
        </form>
      </Sheet>
    </div>
  );
}

const STATUS_TONE: Record<GiftCardRow["status"], "ok" | "warn" | "muted"> = {
  active: "ok",
  exhausted: "muted",
  expired: "warn",
  voided: "muted",
};

/**
 * REQ-059.3: tarjetas con saldo y estado, y "Saldo por usar" de las vigentes. Quien compra sale
 * con el celular enmascarado (REQ-078.6); el enlace de WhatsApp sí lleva el número. REQ-078.33
 * (T-180): tabla N.º · Para · Valor · Saldo como el tablero Dueno-Clientes; anulada tachada.
 * `limit` la deja corta, sin envío, para ponerla junto a Membresías.
 */
export function GiftCardList({ view, limit }: { view: GiftCardsView; limit?: number }) {
  if (view.cards.length === 0) {
    return (
      <EmptyState
        icon="cash"
        title="Todavía no hay tarjetas."
        text='Toca "Vender tarjeta": se cobra hoy y quien la recibe la usa como medio de pago.'
      />
    );
  }
  const cards = limit ? view.cards.slice(0, limit) : view.cards;
  return (
    <>
      <p className="border-line border-b px-4 py-3 text-base" aria-label="Saldo por usar">
        Saldo por usar:{" "}
        <span className="font-bold tabular-nums">{formatCOP(balanceToUse(view.cards))}</span>
      </p>
      <table className="w-full text-sm" aria-label="Tarjetas de regalo">
        <thead className="bg-brand text-brand-ink text-left text-xs">
          <tr>
            <th className="px-3 py-2 font-bold sm:px-4">N.º</th>
            <th className="px-3 py-2 font-bold">Para</th>
            <th className="hidden px-3 py-2 text-right font-bold sm:table-cell">Valor</th>
            <th className="px-3 py-2 text-right font-bold">Saldo</th>
            <th className="px-4 py-2 font-bold">
              <span className="sr-only">Estado</span>
            </th>
          </tr>
        </thead>
        <tbody className="divide-line divide-y tabular-nums">
          {cards.map((c) => {
            const voided = c.status === "voided";
            return (
              <tr key={c.id} className={c.status === "active" ? "" : "text-muted"}>
                <td className="px-3 py-2 font-bold whitespace-nowrap sm:px-4 sm:tracking-wide">
                  {formatGiftCardCode(c.code)}
                </td>
                <td className="min-w-0 px-3 py-2">
                  <p className={voided ? "line-through" : ""}>{c.recipientName ?? c.buyerName}</p>
                  {!limit && (
                    <p className="text-muted text-xs">
                      {c.buyerName} · {maskPhone(c.buyerPhone)} · vence el{" "}
                      {giftCardDayLabel(c.expiresOn)}
                    </p>
                  )}
                </td>
                <td
                  className={`hidden px-3 py-2 text-right sm:table-cell ${voided ? "line-through" : ""}`}
                >
                  {formatCOP(c.amount)}
                </td>
                <td className="px-3 py-2 text-right">{voided ? "—" : formatCOP(c.balance)}</td>
                <td className="px-3 py-1 text-right sm:px-4">
                  {c.status === "active" && !limit ? (
                    <SendButton card={c} view={view} compact />
                  ) : (
                    <Tag tone={STATUS_TONE[c.status]}>{giftCardStatusLabel(c.status)}</Tag>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {limit && view.cards.length > limit && (
        <Link
          href="/admin/regalos"
          className="border-line text-ink flex min-h-12 items-center justify-center border-t text-sm font-semibold underline underline-offset-4"
        >
          Ver las {view.cards.length}
        </Link>
      )}
    </>
  );
}
