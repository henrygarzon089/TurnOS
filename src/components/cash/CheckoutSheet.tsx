"use client";

import Image from "next/image";
import { useEffect, useMemo, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { ErrorText } from "@/components/auth/LoginForm";
import {
  findCheckoutCustomer,
  getCheckout,
  lookupGiftCard,
  markUnpaid,
  registerSale,
  type CheckoutCustomer,
  type CheckoutView,
  type PaymentMethod,
} from "@/lib/actions/cash";
import { ProductShowcase } from "@/components/cash/ProductShowcase";
import { Icon } from "@/components/ui/Icon";
import { Sheet } from "@/components/ui/Sheet";
import { computeSale, productCommission, staffDiscount } from "@/lib/domain/commission";
import { giftCardSplit, normalizeGiftCardCode } from "@/lib/domain/giftCard";
import { membershipCheckoutLine, membershipLineKey } from "@/lib/domain/membership";
import { formatCOP, parseCOP } from "@/lib/domain/money";
import { saleParties, type Seller } from "@/lib/domain/showcase";
import { formatTimeBogota } from "@/lib/domain/time";
import { mediaUrl } from "@/lib/media/paths";

/**
 * Interruptor del cobro (tablero Barbero-Cobro): sigue siendo una casilla para el lector de
 * pantalla y las pruebas; se ve como interruptor y se mueve en 150 ms (REQ-078.13).
 */
const SWITCH =
  "relative h-7 w-12 shrink-0 cursor-pointer appearance-none rounded-full bg-line-strong transition-colors duration-150 checked:bg-brand before:absolute before:top-0.5 before:left-0.5 before:size-6 before:rounded-full before:bg-card before:transition-transform before:duration-150 checked:before:translate-x-5 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand motion-reduce:before:transition-none";
/** Fila blanca de ancho completo del tablero (56 px). */
const ROW = "border-line bg-card flex min-h-14 items-center gap-3 border-b px-4";
/** Enlace de texto de 48 px ("+ Agregar producto", "Cobrar después"). */
const LINK = "text-ink min-h-12 text-base font-semibold underline underline-offset-4";
const CHOICE = (on: boolean) =>
  `min-h-12 rounded-md border px-2 font-semibold ${
    on ? "border-brand bg-brand-soft text-ink border-2" : "border-line-strong bg-card"
  }`;

/** "Transf." en el cuadro (3 columnas); el nombre accesible sigue completo. */
const METHODS: { id: PaymentMethod; label: string; name: string }[] = [
  { id: "cash", label: "Efectivo", name: "Efectivo" },
  { id: "nequi", label: "Nequi", name: "Nequi" },
  { id: "daviplata", label: "Daviplata", name: "Daviplata" },
  { id: "transfer", label: "Transf.", name: "Transferencia" },
  { id: "card", label: "Tarjeta", name: "Tarjeta" },
];

/** Error al guardar sin respuesta del servidor (tablero Barbero-Cobro, tercer cuadro). */
const NO_SIGNAL =
  "Se fue la señal antes de guardar. No hay nada registrado: puedes intentar sin miedo a cobrar doble.";

type ServiceLine = {
  key: number;
  serviceId: string;
  /** La línea del servicio del turno usa el precio congelado (REQ-023.1). */
  fromTicket: boolean;
  discount: number;
  reason: string;
  isReward: boolean;
};

/**
 * REQ-023.1–23.3, REQ-019.4, REQ-023.6, REQ-047.1, REQ-047.5, REQ-078.19: el cobro a pantalla
 * completa del tablero Barbero-Cobro (T-170). Con turno: "Cobrar a <nombre>", prellenado con su
 * servicio y precio. Sin turno ("Nueva venta", T-044): el dueño escoge quién vendió (REQ-066.3) y
 * puede registrar la compra de un barbero (REQ-068.2); el barbero vende a su nombre (REQ-066.4).
 * Los productos se escogen en la vitrina con "+ Agregar producto" y quedan en lista
 * (REQ-066.1, REQ-066.5). La tarjeta de regalo va en "Pago con" (REQ-057).
 */
export function CheckoutSheet({
  ticketId,
  onClose,
  onDone,
}: {
  ticketId: string | null;
  onClose: () => void;
  onDone: (message: string) => void;
}) {
  const [view, setView] = useState<CheckoutView | null | undefined>(undefined);
  const [services, setServices] = useState<ServiceLine[]>([]);
  const [products, setProducts] = useState<Record<string, number>>({});
  const [picker, setPicker] = useState(false);
  /** REQ-066.3 "¿Quién vendió?" sin opción por defecto; con turno, el barbero del turno. */
  const [seller, setSeller] = useState<Seller>(null);
  /** REQ-068.2 "Compra de un barbero" (solo el dueño, sin turno). */
  const [staffPurchase, setStaffPurchase] = useState(false);
  const [method, setMethod] = useState<PaymentMethod | null>(null);
  /** REQ-057: tarjeta de regalo buscada por código; el medio de pago cubre lo que falta. */
  const [giftOpen, setGiftOpen] = useState(false);
  const [giftCode, setGiftCode] = useState("");
  const [gift, setGift] = useState<{ code: string; balance: number; label: string } | null>(null);
  /** Lo que falta para cobrar (texto rojo) y, aparte, que no se pudo guardar (recuadro). */
  const [error, setError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [unpaidOpen, setUnpaidOpen] = useState(false);
  const [unpaidReason, setUnpaidReason] = useState("");
  const [pending, startTransition] = useTransition();
  const [nextKey, setNextKey] = useState(1);
  /**
   * "Usar membresía" (una sola línea, REQ-047.5): "auto" = la primera que gasta cortes (marcada por
   * defecto, REQ-047.1); un número = la línea que eligió quien cobra; null = la desmarcó.
   */
  const [memberChoice, setMemberChoice] = useState<number | null | "auto">("auto");
  /** "Nueva venta": cliente buscado por celular (REQ-047.1). */
  const [customer, setCustomer] = useState<CheckoutCustomer | null>(null);
  const [phone, setPhone] = useState("");

  useEffect(() => {
    let alive = true;
    void getCheckout(ticketId).then((v) => {
      if (!alive) return;
      setView(v);
      if (v && !v.ticket && !v.isOwner && v.barbers[0])
        setSeller({ kind: "barber", id: v.barbers[0].id });
      if (v?.ticket) {
        setServices([
          {
            key: 0,
            serviceId: v.ticket.serviceId,
            fromTicket: true,
            discount: 0,
            reason: "",
            isReward: false,
          },
        ]);
        if (v.ticket.barberId) setSeller({ kind: "barber", id: v.ticket.barberId });
      }
    });
    return () => {
      alive = false;
    };
  }, [ticketId]);

  const priceOf = (l: ServiceLine) =>
    l.fromTicket && view?.ticket
      ? view.ticket.servicePrice
      : (view?.services.find((s) => s.id === l.serviceId)?.price ?? 0);
  const nameOf = (l: ServiceLine) =>
    l.fromTicket && view?.ticket
      ? view.ticket.serviceName
      : (view?.services.find((s) => s.id === l.serviceId)?.name ?? "");
  const membership = view?.membership ?? customer?.membership ?? null;
  const countsFor = (l: ServiceLine) => !!view?.membershipServiceIds.includes(l.serviceId);
  const memberKey = !membership
    ? null
    : memberChoice === "auto"
      ? membershipLineKey(services.map((l) => ({ key: l.key, countsForMembership: countsFor(l) })))
      : services.some((l) => l.key === memberChoice && countsFor(l))
        ? memberChoice
        : null;
  /** REQ-047.5: con la membresía en uso no hay premio en la venta. */
  const rewardOn = (l: ServiceLine) => memberKey === null && l.isReward;
  const memberLine = (l: ServiceLine) =>
    membership && l.key === memberKey ? membershipCheckoutLine(membership, priceOf(l)) : null;
  const rewardValue = (l: ServiceLine) =>
    view?.loyalty?.rewardType === "discount"
      ? Math.min(view.loyalty.rewardAmount ?? 0, priceOf(l))
      : priceOf(l);
  const lineDiscount = (l: ServiceLine) => {
    const m = memberLine(l);
    return m ? m.discount : rewardOn(l) ? rewardValue(l) : l.discount;
  };

  const amounts = useMemo(() => {
    if (!view) return null;
    try {
      return computeSale({
        services: services.map((l) => {
          const m = memberLine(l);
          return {
            unitPrice: priceOf(l),
            qty: 1,
            discount: lineDiscount(l),
            isReward: !m && rewardOn(l),
            membership: m?.benefit ?? null,
          };
        }),
        products: Object.entries(products)
          .filter(([, qty]) => qty > 0)
          .map(([id, qty]) => ({
            unitPrice: view.products.find((p) => p.id === id)?.price ?? 0,
            qty,
          })),
        commissionPct: 0,
      });
    } catch {
      return null;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, services, products, memberKey, membership]);

  /** Con turno: "Cobrar a <nombre>". Sin turno (REQ-023.4, REQ-024.2): "Nueva venta". */
  const title = !ticketId
    ? "Nueva venta"
    : view?.ticket
      ? `Cobrar a ${view.ticket.customerName}`
      : "Cobrar";

  if (view === undefined) {
    return (
      <Screen onClose={onClose} title={title}>
        <div aria-busy="true" className="flex flex-col gap-px pt-8">
          {[0, 1, 2].map((i) => (
            <span key={i} className="bg-skeleton block h-14" />
          ))}
        </div>
      </Screen>
    );
  }
  if (view === null) {
    return (
      <Screen onClose={onClose} title={title}>
        <div className="flex flex-col gap-4 p-4">
          <p className="py-6 text-center">Este turno ya no tiene cobro pendiente.</p>
          <button type="button" className="btn-secondary" onClick={onClose}>
            Cerrar
          </button>
        </div>
      </Screen>
    );
  }

  const subtitle = view.ticket
    ? [
        view.ticket.displayNumber,
        view.ticket.finishedAt
          ? `terminó ${formatTimeBogota(new Date(view.ticket.finishedAt))}`
          : null,
      ]
        .filter(Boolean)
        .join(" · ")
    : !view.isOwner
      ? "Venta a tu nombre"
      : undefined;

  const loyalty = view.loyalty;
  const rewardApplied = services.some(rewardOn);
  const rewardLine = services.find((l) =>
    loyalty?.rewardType === "discount" ? true : l.serviceId === view.rewardServiceId,
  );
  const rewardName = view.services.find((s) => s.id === view.rewardServiceId)?.name ?? "el premio";
  const rewardTitle =
    loyalty?.rewardType === "discount"
      ? `Premio de ${formatCOP(loyalty.rewardAmount ?? 0)}`
      : "Corte gratis";
  const productLines = Object.entries(products)
    .filter(([, qty]) => qty > 0)
    .map(([id, qty]) => {
      const p = view.products.find((x) => x.id === id);
      return { unitPrice: p?.price ?? 0, qty, commissionable: !!p?.commissionable };
    });
  /** REQ-068.3 descuento de empleado por línea. */
  const staffDiscountTotal = staffPurchase
    ? productLines.reduce((sum, l) => sum + staffDiscount(l, view.staffDiscountPct), 0)
    : 0;
  const total = (amounts?.total ?? 0) - staffDiscountTotal;
  const hasLines = services.length > 0 || productLines.length > 0;
  const parties = saleParties({ seller, hasServices: services.length > 0, staffPurchase });
  const sellerName =
    seller?.kind === "barber" ? (view.barbers.find((b) => b.id === seller.id)?.name ?? "") : "";
  /** REQ-067.1 lo que gana el barbero por los productos de esta venta (vista previa). */
  const productCut = productCommission({
    products: productLines,
    pct: view.productCommissionPct,
    hasBarber: seller?.kind === "barber",
    staffPurchase,
  }).amount;
  /** REQ-057.3: la tarjeta paga hasta su saldo; el resto con el medio de pago. */
  const giftSplit = giftCardSplit(total, gift?.balance ?? 0);
  const toPay = gift ? giftSplit.rest : total;
  const chosenProducts = view.products.filter((p) => (products[p.id] ?? 0) > 0);

  function update(key: number, patch: Partial<ServiceLine>) {
    setServices((ls) => ls.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  }

  function lookupCustomer() {
    setError(null);
    startTransition(async () => {
      const r = await findCheckoutCustomer(phone);
      setMemberChoice("auto");
      if (!r.ok) {
        setCustomer(null);
        setError(r.error);
        return;
      }
      setCustomer(r.customer);
    });
  }

  function lookupGift() {
    setError(null);
    startTransition(async () => {
      const r = await lookupGiftCard(giftCode);
      if (!r.ok) {
        setGift(null);
        setError(r.error);
        return;
      }
      setGift({ code: r.card.code, balance: r.card.balance, label: r.label });
    });
  }

  function removeGift() {
    setGift(null);
    setGiftCode("");
    setGiftOpen(false);
    setError(null);
  }

  function submit() {
    if (!amounts) return;
    if (!parties.ok) {
      setError(parties.error);
      return;
    }
    if (giftOpen && !gift && total > 0) {
      setError("Escribe el código de la tarjeta de regalo y búscalo.");
      return;
    }
    if (toPay > 0 && !method) {
      setError(gift ? "Elige con qué se paga lo que falta." : "Elige el medio de pago.");
      return;
    }
    setError(null);
    setSaveError(null);
    startTransition(async () => {
      try {
        const r = await registerSale({
          ticketId: view?.ticket?.id ?? null,
          barberId: parties.barberId,
          staffBuyerId: parties.staffBuyerId,
          customerId: view?.ticket || staffPurchase ? null : (customer?.id ?? null),
          items: [
            ...services.map((l) => {
              const m = !!memberLine(l);
              return {
                kind: "service" as const,
                refId: l.serviceId,
                qty: 1,
                discount: m || rewardOn(l) ? 0 : l.discount,
                discountReason: m ? undefined : l.reason || undefined,
                isReward: !m && rewardOn(l),
                membership: m,
              };
            }),
            ...Object.entries(products)
              .filter(([, qty]) => qty > 0)
              .map(([id, qty]) => ({ kind: "product" as const, refId: id, qty })),
          ],
          method: method ?? "cash",
          giftCard:
            gift && giftSplit.card > 0 ? { code: gift.code, amount: giftSplit.card } : undefined,
          total,
        });
        if (!r.ok) setSaveError(r.error);
        else
          onDone(
            view?.ticket
              ? `Cobrado · ${formatCOP(total)}`
              : `Venta registrada · ${formatCOP(total)}`,
          );
      } catch {
        setSaveError(NO_SIGNAL);
      }
    });
  }

  function saveUnpaid() {
    if (!view?.ticket) return;
    setError(null);
    startTransition(async () => {
      const r = await markUnpaid(view.ticket!.id, unpaidReason);
      if (!r.ok) setError(r.error);
      else onDone("Marcado como no cobrado.");
    });
  }

  return (
    <Screen
      onClose={onClose}
      title={title}
      subtitle={subtitle}
      footer={
        <>
          <p className="flex flex-wrap items-baseline justify-between gap-x-3">
            <span className="text-muted">Total</span>
            <span
              className="text-[clamp(1.75rem,11vw,2.5rem)] leading-tight font-bold tabular-nums"
              aria-live="polite"
              data-testid="checkout-total"
            >
              {formatCOP(total)}
            </span>
          </p>
          <button
            type="button"
            className="btn-primary mt-2"
            disabled={pending || !hasLines || !parties.ok || !amounts}
            onClick={submit}
          >
            {pending ? "Guardando…" : `Cobrar ${formatCOP(total)}`}
          </button>
        </>
      }
    >
      {!view.ticket && view.isOwner && (
        <Section label={staffPurchase ? "¿Qué barbero compra?" : "¿Quién vendió?"}>
          {view.staffDiscountPct > 0 && (
            <label className={`${ROW} justify-between text-base`}>
              Compra de un barbero (−{view.staffDiscountPct} %)
              <input
                type="checkbox"
                className={SWITCH}
                checked={staffPurchase}
                onChange={(e) => {
                  setStaffPurchase(e.target.checked);
                  setSeller(null);
                  setServices([]);
                  setCustomer(null);
                  setPhone("");
                }}
              />
            </label>
          )}
          <div
            role="radiogroup"
            aria-label={staffPurchase ? "¿Qué barbero compra?" : "¿Quién vendió?"}
            className="border-line bg-card grid grid-cols-[repeat(auto-fit,minmax(8rem,1fr))] gap-2 border-b px-4 py-3"
          >
            {[
              ...view.barbers.map((b) => ({
                key: b.id,
                label: b.name,
                value: { kind: "barber", id: b.id } as const,
              })),
              ...(staffPurchase
                ? []
                : [{ key: "none", label: "Nadie (el negocio)", value: { kind: "none" } as const }]),
            ].map((o) => {
              const on =
                seller !== null &&
                seller.kind === o.value.kind &&
                (seller.kind === "none" || (o.value.kind === "barber" && seller.id === o.value.id));
              return (
                <button
                  key={o.key}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  onClick={() => setSeller(o.value)}
                  className={CHOICE(on)}
                >
                  {o.label}
                </button>
              );
            })}
          </div>
        </Section>
      )}

      {!view.ticket && !staffPurchase && (
        <Section label="Cliente">
          <div className="border-line bg-card flex flex-col gap-1 border-b px-4 py-3">
            <label className="flex flex-col gap-1 text-sm font-medium">
              Celular del cliente (opcional)
              <span className="flex flex-wrap gap-2">
                <input
                  className="input min-w-0 flex-[1_1_10rem]"
                  inputMode="tel"
                  autoComplete="off"
                  placeholder="300 123 4567"
                  value={phone}
                  onChange={(e) => {
                    setPhone(e.target.value);
                    if (customer) setCustomer(null);
                  }}
                />
                <button
                  type="button"
                  className="btn-secondary w-auto shrink-0 px-4"
                  disabled={pending || phone.trim() === ""}
                  onClick={lookupCustomer}
                >
                  Buscar
                </button>
              </span>
            </label>
            {customer && (
              <p className="text-muted text-sm" data-testid="checkout-customer">
                {customer.name}
                {customer.membership ? " · Membresía familiar" : ""}
              </p>
            )}
          </div>
        </Section>
      )}

      {!staffPurchase && (
        // Región "Servicios": "Servicio" a secas es el nombre del selector de cada línea
        <Section label={services.length > 1 ? "Servicios" : "Servicio"} name="Servicios">
          {services.map((l) => {
            const m = memberLine(l);
            const off = lineDiscount(l);
            return (
              <div key={l.key}>
                <div className={ROW}>
                  {/* Tocar la fila cambia el servicio: el selector nativo va encima, invisible */}
                  <div className="focus-within:outline-brand relative flex min-h-12 min-w-0 flex-1 items-center gap-3 rounded-sm focus-within:outline-2">
                    <span className="min-w-0 flex-1 font-semibold break-words">{nameOf(l)}</span>
                    <span className="shrink-0 font-semibold tabular-nums">
                      {off > 0 && (m || rewardOn(l)) ? (
                        <>
                          <s className="text-muted font-normal">{formatCOP(priceOf(l))}</s>{" "}
                          {formatCOP(priceOf(l) - off)}
                        </>
                      ) : (
                        formatCOP(priceOf(l))
                      )}
                    </span>
                    <select
                      aria-label="Servicio"
                      className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                      value={l.fromTicket ? `ticket:${l.serviceId}` : l.serviceId}
                      onChange={(e) => {
                        const v = e.target.value;
                        update(l.key, {
                          serviceId: v.replace(/^ticket:/, ""),
                          fromTicket: v.startsWith("ticket:"),
                          isReward: false,
                          discount: 0,
                        });
                      }}
                    >
                      {view.ticket && l.key === 0 && (
                        <option value={`ticket:${view.ticket.serviceId}`}>
                          {view.ticket.serviceName} · {formatCOP(view.ticket.servicePrice)}
                        </option>
                      )}
                      {view.services
                        .filter(
                          (s) => !(l.key === 0 && view.ticket && s.id === view.ticket.serviceId),
                        )
                        .map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.name} · {formatCOP(s.price)}
                          </option>
                        ))}
                    </select>
                  </div>
                  {services.length > 1 && (
                    <button
                      type="button"
                      className="text-danger min-h-12 shrink-0 px-1 text-sm font-semibold"
                      onClick={() => setServices((ls) => ls.filter((x) => x.key !== l.key))}
                      aria-label={`Quitar ${nameOf(l)}`}
                    >
                      Quitar
                    </button>
                  )}
                </div>

                {view.isOwner && !rewardOn(l) && !m && (
                  <>
                    <label className={`${ROW} justify-between text-base`}>
                      Descuento
                      <input
                        className="input max-w-36 shrink-0 text-right tabular-nums"
                        inputMode="numeric"
                        placeholder="$ 0"
                        value={l.discount ? formatCOP(l.discount).replace("$ ", "") : ""}
                        onChange={(e) =>
                          update(l.key, {
                            discount: Math.min(parseCOP(e.target.value) ?? 0, priceOf(l)),
                          })
                        }
                      />
                    </label>
                    {l.discount > 0 && (
                      <label className={`${ROW} justify-between text-base`}>
                        Motivo del descuento
                        <input
                          className="input min-w-0 flex-1"
                          maxLength={120}
                          value={l.reason}
                          onChange={(e) => update(l.key, { reason: e.target.value })}
                        />
                      </label>
                    )}
                  </>
                )}

                {membership && countsFor(l) && (memberKey === null || memberKey === l.key) && (
                  <label className={`${ROW} justify-between text-base`}>
                    <span>
                      Usar membresía
                      <span className="text-muted text-sm"> · quedan {membership.cutsLeft}</span>
                    </span>
                    <input
                      type="checkbox"
                      className={SWITCH}
                      checked={memberKey === l.key}
                      onChange={(e) => {
                        setMemberChoice(e.target.checked ? l.key : null);
                        if (e.target.checked) update(l.key, { discount: 0, reason: "" });
                      }}
                    />
                  </label>
                )}
                {m && (
                  <p
                    className="text-brand border-line bg-card border-b px-4 py-2 text-sm font-semibold"
                    data-testid="membership-line"
                  >
                    {m.label}: −{formatCOP(m.discount)}
                  </p>
                )}
              </div>
            );
          })}

          {/* REQ-019.4 / REQ-047.5: el premio de fidelidad; con la membresía en uso no se ofrece */}
          {loyalty?.enabled && memberKey === null && (
            <>
              <label
                className={`${ROW} justify-between text-base ${
                  rewardApplied ? "bg-ok-soft text-ok font-semibold" : ""
                }`}
              >
                <span>
                  {rewardTitle}
                  <span className={`text-sm ${rewardApplied ? "" : "text-muted font-normal"}`}>
                    {" · "}
                    {loyalty.available
                      ? `${loyalty.required} de ${loyalty.required}`
                      : `lleva ${loyalty.stamps} de ${loyalty.required}`}
                  </span>
                </span>
                <input
                  type="checkbox"
                  className={SWITCH}
                  disabled={!loyalty.available || !rewardLine}
                  checked={rewardApplied}
                  onChange={(e) => {
                    if (!e.target.checked)
                      setServices((ls) => ls.map((x) => ({ ...x, isReward: false })));
                    else if (rewardLine)
                      update(rewardLine.key, { isReward: true, discount: 0, reason: "" });
                  }}
                />
              </label>
              {rewardApplied && rewardLine && (
                <p className="border-line bg-card text-muted border-b px-4 py-2 text-sm">
                  Tu comisión se paga sobre {formatCOP(priceOf(rewardLine))}. La asume el negocio.
                </p>
              )}
              {loyalty.available && !rewardLine && (
                <p className="border-line bg-card text-muted border-b px-4 py-2 text-sm">
                  Tiene un premio disponible: {rewardName}. Agrégalo como servicio para aplicarlo.
                </p>
              )}
            </>
          )}

          <div className={ROW}>
            <button
              type="button"
              className={LINK}
              onClick={() => {
                const first = view.services[0];
                if (!first) return;
                setServices((ls) => [
                  ...ls,
                  {
                    key: nextKey,
                    serviceId: first.id,
                    fromTicket: false,
                    discount: 0,
                    reason: "",
                    isReward: false,
                  },
                ]);
                setNextKey((k) => k + 1);
              }}
            >
              + Agregar servicio
            </button>
          </div>
        </Section>
      )}

      {(total > 0 || gift) && (
        <Section label="Pago con">
          <div className={ROW}>
            <span className="min-w-0 flex-1">
              Tarjeta de regalo
              {gift && (
                <span className="text-muted block text-sm" data-testid="gift-card-balance">
                  {gift.label}
                </span>
              )}
            </span>
            {gift ? (
              <>
                <span className="font-semibold tabular-nums">−{formatCOP(giftSplit.card)}</span>
                <button
                  type="button"
                  className="text-danger min-h-12 px-1 text-sm font-semibold"
                  aria-label="Quitar tarjeta de regalo"
                  onClick={removeGift}
                >
                  Quitar
                </button>
              </>
            ) : giftOpen ? (
              <button
                type="button"
                className="text-muted min-h-12 px-1 text-sm font-semibold"
                aria-label="Cerrar tarjeta de regalo"
                onClick={removeGift}
              >
                Cancelar
              </button>
            ) : (
              <button
                type="button"
                className={LINK}
                aria-label="Agregar tarjeta de regalo"
                onClick={() => setGiftOpen(true)}
              >
                Agregar
              </button>
            )}
          </div>
          {giftOpen && !gift && (
            <div className="border-line bg-card flex flex-wrap items-end gap-2 border-b px-4 py-3">
              <label className="flex min-w-0 flex-[1_1_10rem] flex-col gap-1 text-sm font-medium">
                Código
                <input
                  className="input font-mono uppercase"
                  autoCapitalize="characters"
                  autoComplete="off"
                  maxLength={12}
                  value={giftCode}
                  onChange={(e) => setGiftCode(e.target.value)}
                />
              </label>
              <button
                type="button"
                className="btn-secondary min-h-12 w-auto px-4"
                aria-label="Buscar tarjeta de regalo"
                disabled={pending || normalizeGiftCardCode(giftCode).length !== 8}
                onClick={lookupGift}
              >
                Buscar
              </button>
            </div>
          )}
          {gift && giftSplit.rest > 0 && (
            <p className="border-line bg-card border-b px-4 py-2 text-sm">
              Faltan <strong>{formatCOP(giftSplit.rest)}</strong>: escoge con qué se pagan.
            </p>
          )}
        </Section>
      )}

      {view.products.length > 0 && (
        <Section label="De la vitrina">
          <ul>
            {chosenProducts.map((p) => {
              const n = products[p.id] ?? 0;
              const set = (q: number) => setProducts((m) => ({ ...m, [p.id]: Math.max(0, q) }));
              return (
                <li key={p.id} className={`${ROW} flex-wrap py-1`}>
                  {p.photoPath ? (
                    <Image
                      src={mediaUrl(p.photoPath)}
                      alt=""
                      width={40}
                      height={40}
                      unoptimized
                      className="size-10 shrink-0 rounded-sm object-cover"
                    />
                  ) : (
                    <span
                      aria-hidden="true"
                      className="bg-skeleton text-muted flex size-10 shrink-0 items-center justify-center rounded-sm font-bold"
                    >
                      {p.name.slice(0, 1).toUpperCase()}
                    </span>
                  )}
                  <span className="min-w-0 flex-1 break-words">{p.name}</span>
                  <span className="border-line-strong flex shrink-0 items-center rounded-md border">
                    <button
                      type="button"
                      className="grid h-12 w-10 place-items-center"
                      aria-label={`Quitar un ${p.name}`}
                      onClick={() => set(n - 1)}
                    >
                      <Icon name="minus" className="size-4" />
                    </button>
                    <span
                      className="w-5 text-center font-semibold tabular-nums"
                      aria-label={`${p.name}: ${n}`}
                    >
                      {n}
                    </span>
                    <button
                      type="button"
                      className="grid h-12 w-10 place-items-center"
                      aria-label={`Agregar un ${p.name}`}
                      onClick={() => set(n + 1)}
                    >
                      <Icon name="plus" className="size-4" />
                    </button>
                  </span>
                  <span className="w-20 shrink-0 text-right font-semibold tabular-nums">
                    {formatCOP(p.price * n)}
                  </span>
                </li>
              );
            })}
          </ul>
          <div className={`${ROW} flex-wrap justify-between`}>
            <button type="button" className={LINK} onClick={() => setPicker(true)}>
              + Agregar producto
            </button>
            {sellerName && (view.ticket || !view.isOwner) && (
              <span className="text-muted text-sm">¿Quién vendió? {sellerName}</span>
            )}
          </div>
          {productCut > 0 && (
            <p
              className="border-line bg-card text-muted border-b px-4 py-2 text-sm"
              data-testid="product-commission"
            >
              Comisión de productos para {sellerName}: {formatCOP(productCut)}
            </p>
          )}
          {staffDiscountTotal > 0 && (
            <p
              className="border-line bg-card text-muted border-b px-4 py-2 text-sm"
              data-testid="staff-discount"
            >
              Descuento de empleado: −{formatCOP(staffDiscountTotal)}
            </p>
          )}
        </Section>
      )}

      {toPay > 0 && (
        <Section label="Medio de pago">
          <div
            role="radiogroup"
            aria-label="Medio de pago"
            className="grid grid-cols-[repeat(auto-fit,minmax(6.5rem,1fr))] gap-2 px-4 pt-1 pb-3 sm:grid-cols-3"
          >
            {METHODS.map((m) => (
              <button
                key={m.id}
                type="button"
                role="radio"
                aria-label={m.name}
                aria-checked={method === m.id}
                onClick={() => setMethod(m.id)}
                className={CHOICE(method === m.id)}
              >
                {m.label}
              </button>
            ))}
          </div>
        </Section>
      )}

      {saveError && (
        <div
          role="alert"
          // Queda a la vista del pulgar, encima del total
          ref={(el) => el?.scrollIntoView({ block: "nearest" })}
          className="border-danger bg-card mx-4 my-3 flex gap-2 rounded-md border-2 p-4"
        >
          <Icon name="error" className="text-danger mt-0.5 size-5 shrink-0" />
          <p className="text-base">
            <strong className="text-danger">No quedó cobrado.</strong> {saveError}
          </p>
        </div>
      )}
      {error && (
        <div className="px-4 py-3">
          <ErrorText>{error}</ErrorText>
        </div>
      )}

      {view.ticket &&
        (unpaidOpen ? (
          <div className="flex flex-col gap-2 px-4 py-4">
            <label className="flex flex-col gap-1 text-sm font-medium">
              ¿Por qué no se cobró?
              <input
                className="input"
                maxLength={120}
                value={unpaidReason}
                onChange={(e) => setUnpaidReason(e.target.value)}
              />
            </label>
            <button type="button" className="btn-danger" disabled={pending} onClick={saveUnpaid}>
              Guardar &quot;No se cobró&quot;
            </button>
          </div>
        ) : (
          <div className="flex flex-wrap justify-between gap-x-6 px-4 py-3">
            <button type="button" className={LINK} onClick={onClose}>
              Cobrar después
            </button>
            <button type="button" className={LINK} onClick={() => setUnpaidOpen(true)}>
              No se cobró
            </button>
          </div>
        ))}

      <Sheet open={picker} onClose={() => setPicker(false)} title="Agregar producto">
        <ProductShowcase
          products={view.products}
          qty={products}
          onChange={(id, qty) => setProducts((m) => ({ ...m, [id]: qty }))}
          discountPct={staffPurchase ? view.staffDiscountPct : 0}
        />
        <button type="button" className="btn-primary" onClick={() => setPicker(false)}>
          Listo
        </button>
      </Sheet>
    </Screen>
  );
}

/** Encabezado gris de sección ("SERVICIO", "MEDIO DE PAGO") con sus filas blancas. */
function Section({
  label,
  name = label,
  children,
}: {
  label: string;
  name?: string;
  children: React.ReactNode;
}) {
  return (
    <section aria-label={name}>
      <h3 className="text-muted px-4 pt-5 pb-2 text-xs font-semibold tracking-wide uppercase">
        {label}
      </h3>
      <div className="border-line border-t">{children}</div>
    </section>
  );
}

/**
 * Cobro a pantalla completa en el celular y hoja centrada desde 640 px (design §22.6, T-170): flecha
 * "Volver", "Cobrar a <nombre>" con número y hora, el contenido se desplaza y el total con "Cobrar"
 * quedan fijos abajo (`footer`), siempre a la vista del pulgar.
 */
function Screen({
  children,
  onClose,
  title,
  subtitle,
  footer,
}: {
  children: React.ReactNode;
  onClose: () => void;
  title: string;
  subtitle?: string;
  footer?: React.ReactNode;
}) {
  // En `body`: abierta desde una barra fija (caja, "Hoy") quedaría bajo el menú del dueño
  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      className="bg-surface sm:bg-ink/60 fixed inset-0 z-30 flex flex-col sm:items-center sm:justify-center sm:p-4"
      // Esc dentro de la vitrina (`<dialog>`) cierra solo la vitrina
      onKeyDown={(e) =>
        e.key === "Escape" && !(e.target as HTMLElement).closest("dialog") && onClose()
      }
    >
      <div className="bg-surface flex h-full w-full flex-col sm:h-auto sm:max-h-[92dvh] sm:max-w-lg sm:overflow-hidden sm:rounded-lg">
        <header className="border-line bg-card flex min-h-16 shrink-0 items-center gap-1 border-b px-2 pt-[env(safe-area-inset-top)]">
          <button
            type="button"
            aria-label="Volver"
            className="grid size-12 shrink-0 place-items-center"
            onClick={onClose}
          >
            <Icon name="back" className="size-6" />
          </button>
          <div className="min-w-0">
            <h2 className="text-lg leading-tight font-bold break-words">{title}</h2>
            {subtitle && <p className="text-muted text-sm">{subtitle}</p>}
          </div>
        </header>
        <div className="flex-1 overflow-y-auto pb-4">{children}</div>
        {footer && (
          <div className="border-line bg-card shrink-0 border-t px-4 pt-3 pb-[calc(1rem+env(safe-area-inset-bottom))]">
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}
