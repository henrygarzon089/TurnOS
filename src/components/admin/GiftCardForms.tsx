"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ErrorText } from "@/components/auth/LoginForm";
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
import { formatPhoneCO } from "@/lib/domain/phone";
import { buildGiftCardLink } from "@/lib/notifications/reminder";

const METHODS: { id: GiftCardSaleMethod; label: string }[] = [
  { id: "cash", label: "Efectivo" },
  { id: "nequi", label: "Nequi" },
  { id: "transfer", label: "Transferencia" },
  { id: "card", label: "Tarjeta" },
];

type SendProps = Pick<GiftCardsView, "template" | "businessName" | "appUrl">;

/** REQ-056.1 / REQ-056.4: enviar (o reenviar) la tarjeta a quien la compró. */
function SendButton({ card, view }: { card: GiftCardRow; view: SendProps }) {
  return (
    <a
      className="btn-primary"
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
      📲 Enviar por WhatsApp
    </a>
  );
}

/** REQ-055.1–055.3: vender una tarjeta; al terminar, el código y el botón para enviarla. */
export function SellGiftCardForm({ view }: { view: SendProps }) {
  const router = useRouter();
  const [state, setState] = useState<SellGiftCardState>(undefined);
  const [method, setMethod] = useState<GiftCardSaleMethod>("cash");
  const [pending, startTransition] = useTransition();

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
        router.refresh();
      }
    });
  }

  return (
    <>
      {state?.ok && (
        <div
          role="status"
          aria-label="Tarjeta vendida"
          className="border-ok bg-card mt-3 flex flex-col gap-2 rounded-xl border-2 p-4"
        >
          <p className="text-ok text-sm font-medium">Tarjeta vendida. Quedó en la caja de hoy.</p>
          <p className="text-2xl font-bold tracking-widest">
            {formatGiftCardCode(state.card.code)}
          </p>
          <p className="text-sm">
            {formatCOP(state.card.amount)}
            {state.card.recipientName ? ` · Para ${state.card.recipientName}` : ""} · vence el{" "}
            {giftCardDayLabel(state.card.expiresOn)}
          </p>
          <SendButton card={state.card} view={view} />
        </div>
      )}
      <form
        onSubmit={onSubmit}
        aria-label="Vender tarjeta"
        className="border-line bg-card mt-3 flex flex-col gap-3 rounded-xl border p-4"
      >
        <p className="font-semibold">Vender tarjeta</p>
        <label className="flex flex-col gap-1 text-sm font-medium">
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
        <label className="flex flex-col gap-1 text-sm font-medium">
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
        <label className="flex flex-col gap-1 text-sm font-medium">
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
        <label className="flex flex-col gap-1 text-sm font-medium">
          Para (opcional)
          <input
            name="recipient"
            maxLength={40}
            placeholder="Mateo"
            autoComplete="off"
            className="input"
          />
        </label>
        <fieldset className="flex flex-col gap-1">
          <legend className="text-sm font-semibold">Medio de pago</legend>
          <div className="grid grid-cols-2 gap-2">
            {METHODS.map((m) => (
              <label
                key={m.id}
                className={`flex min-h-12 items-center justify-center rounded-xl border text-sm font-semibold ${
                  method === m.id ? "bg-ink text-card border-ink" : "border-line bg-card"
                }`}
              >
                <input
                  type="radio"
                  name="method"
                  value={m.id}
                  checked={method === m.id}
                  onChange={() => setMethod(m.id)}
                  className="sr-only"
                />
                {m.label}
              </label>
            ))}
          </div>
        </fieldset>
        {state && !state.ok && state.error && <ErrorText>{state.error}</ErrorText>}
        <button type="submit" className="btn-primary" disabled={pending}>
          {pending ? "Vendiendo…" : "Vender tarjeta"}
        </button>
      </form>
    </>
  );
}

/** REQ-059.3: tarjetas con saldo y estado, y "Saldo por usar" de las vigentes. */
export function GiftCardList({ view }: { view: GiftCardsView }) {
  if (view.cards.length === 0) {
    return <p className="text-muted mt-2">Todavía no hay tarjetas.</p>;
  }
  return (
    <>
      <p className="mt-2 text-lg" aria-label="Saldo por usar">
        Saldo por usar: <span className="font-bold">{formatCOP(balanceToUse(view.cards))}</span>
      </p>
      <ul aria-label="Tarjetas de regalo" className="mt-2 flex flex-col gap-2">
        {view.cards.map((c) => (
          <li key={c.id} className="border-line bg-card flex flex-col gap-2 rounded-xl border p-3">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="font-semibold tracking-widest">{formatGiftCardCode(c.code)}</p>
                <p className="text-muted text-sm">
                  {c.recipientName ? `Para ${c.recipientName} · ` : ""}
                  {c.buyerName} · {formatPhoneCO(c.buyerPhone)}
                </p>
              </div>
              <span className="text-sm font-medium">{giftCardStatusLabel(c.status)}</span>
            </div>
            <p className="text-sm">
              Saldo {formatCOP(c.balance)} de {formatCOP(c.amount)} · vence el{" "}
              {giftCardDayLabel(c.expiresOn)}
            </p>
            {c.status === "active" && <SendButton card={c} view={view} />}
          </li>
        ))}
      </ul>
    </>
  );
}
