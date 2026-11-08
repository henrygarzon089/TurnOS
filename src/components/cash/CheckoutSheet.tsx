"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
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
import { computeSale, productCommission, staffDiscount } from "@/lib/domain/commission";
import { giftCardSplit, normalizeGiftCardCode } from "@/lib/domain/giftCard";
import { membershipCheckoutLine, membershipLineKey } from "@/lib/domain/membership";
import { formatCOP, parseCOP } from "@/lib/domain/money";
import { saleParties, type Seller } from "@/lib/domain/showcase";

const METHODS: { id: PaymentMethod; label: string }[] = [
  { id: "cash", label: "Efectivo" },
  { id: "nequi", label: "Nequi" },
  { id: "daviplata", label: "Daviplata" },
  { id: "transfer", label: "Transferencia" },
  { id: "card", label: "Tarjeta" },
];

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
 * REQ-023.1–23.3, REQ-019.4, REQ-023.6, REQ-047.1, REQ-047.5: panel "Registrar cobro". Con turno: prellenado con su
 * servicio y precio. Sin turno ("Nueva venta", T-044): el dueño escoge quién vendió (REQ-066.3) y
 * puede registrar la compra de un barbero (REQ-068.2); el barbero vende a su nombre (REQ-066.4).
 * Los productos se escogen en la vitrina (REQ-066.1, REQ-066.5).
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
  /** REQ-066.3 "¿Quién vendió?" sin opción por defecto; con turno, el barbero del turno. */
  const [seller, setSeller] = useState<Seller>(null);
  /** REQ-068.2 "Compra de un barbero" (solo el dueño, sin turno). */
  const [staffPurchase, setStaffPurchase] = useState(false);
  const [method, setMethod] = useState<PaymentMethod | "gift_card" | null>(null);
  /** REQ-057: tarjeta de regalo encontrada por código y medio de lo que falta. */
  const [giftCode, setGiftCode] = useState("");
  const [gift, setGift] = useState<{ code: string; balance: number; label: string } | null>(null);
  const [restMethod, setRestMethod] = useState<PaymentMethod | null>(null);
  const [error, setError] = useState<string | null>(null);
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
  /** Con turno: "Registrar cobro". Sin turno (REQ-023.4, REQ-024.2): "Nueva venta". */
  const title = ticketId ? "Registrar cobro" : "Nueva venta";

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

  const amounts = useMemo(() => {
    if (!view) return null;
    try {
      return computeSale({
        services: services.map((l) => {
          const m = memberLine(l);
          return {
            unitPrice: priceOf(l),
            qty: 1,
            discount: m ? m.discount : rewardOn(l) ? rewardValue(l) : l.discount,
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

  if (view === undefined) {
    return (
      <Sheet onClose={onClose} title={title}>
        <p className="text-muted py-6 text-center">Cargando…</p>
      </Sheet>
    );
  }
  if (view === null) {
    return (
      <Sheet onClose={onClose} title={title}>
        <p className="py-6 text-center">Este turno ya no tiene cobro pendiente.</p>
        <button type="button" className="btn-secondary" onClick={onClose}>
          Cerrar
        </button>
      </Sheet>
    );
  }

  // REQ-047.5: con la membresía en uso, el premio no se ofrece y queda disponible
  const rewardAvailable = !!view.loyalty?.available && memberKey === null;
  const rewardApplied = services.some(rewardOn);
  const rewardLine = services.find((l) =>
    view.loyalty?.rewardType === "discount" ? true : l.serviceId === view.rewardServiceId,
  );
  const rewardName = view.services.find((s) => s.id === view.rewardServiceId)?.name ?? "el premio";
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
  /** REQ-057.3: la tarjeta paga hasta su saldo; el resto con otro medio. */
  const giftSplit = giftCardSplit(total, gift?.balance ?? 0);

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

  function submit() {
    if (!amounts) return;
    if (!parties.ok) {
      setError(parties.error);
      return;
    }
    if (total > 0 && !method) {
      setError("Elige el medio de pago.");
      return;
    }
    if (method === "gift_card" && total > 0) {
      if (!gift) {
        setError("Escribe el código de la tarjeta de regalo y búscalo.");
        return;
      }
      if (giftSplit.rest > 0 && !restMethod) {
        setError("Elige con qué se paga lo que falta.");
        return;
      }
    }
    setError(null);
    startTransition(async () => {
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
        method: (method === "gift_card" ? restMethod : method) ?? "cash",
        giftCard:
          method === "gift_card" && gift && giftSplit.card > 0
            ? { code: gift.code, amount: giftSplit.card }
            : undefined,
        total,
      });
      if (!r.ok) setError(r.error);
      else onDone(`Cobro registrado: ${formatCOP(total)}`);
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
    <Sheet
      onClose={onClose}
      title={title}
      footer={
        <>
          <p className="flex items-baseline justify-between gap-3">
            <span className="text-muted">Total</span>
            <span className="text-3xl font-bold tabular-nums">{formatCOP(total)}</span>
          </p>
          <button
            type="button"
            className="btn-primary mt-2"
            disabled={pending || !hasLines || !parties.ok || !amounts}
            onClick={submit}
          >
            {pending ? "Guardando…" : `Registrar ${formatCOP(total)}`}
          </button>
        </>
      }
    >
      <p className="text-lg font-bold">{title}</p>
      {view.ticket && (
        <p className="text-muted -mt-2 text-sm">
          {view.ticket.customerName} · {view.ticket.barberName}
        </p>
      )}

      {!view.ticket && view.isOwner && view.staffDiscountPct > 0 && (
        <label className="flex min-h-12 items-center gap-2 text-sm font-semibold">
          <input
            type="checkbox"
            className="h-5 w-5"
            checked={staffPurchase}
            onChange={(e) => {
              setStaffPurchase(e.target.checked);
              setSeller(null);
              setServices([]);
              setCustomer(null);
              setPhone("");
            }}
          />
          Compra de un barbero (−{view.staffDiscountPct} %)
        </label>
      )}

      {!view.ticket && view.isOwner && (
        <div
          role="radiogroup"
          aria-label={staffPurchase ? "¿Qué barbero compra?" : "¿Quién vendió?"}
          className="flex flex-col gap-2"
        >
          <p className="text-sm font-semibold">
            {staffPurchase ? "¿Qué barbero compra?" : "¿Quién vendió?"}
          </p>
          <div className="grid grid-cols-2 gap-2">
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
                  className={`min-h-12 rounded-md border px-2 font-semibold ${
                    on ? "border-brand bg-brand-soft text-ink border-2" : "border-line bg-card"
                  }`}
                >
                  {o.label}
                </button>
              );
            })}
          </div>
        </div>
      )}
      {!view.ticket && !view.isOwner && (
        <p className="text-muted -mt-2 text-sm">Venta a tu nombre</p>
      )}

      {!view.ticket && !staffPurchase && (
        <div className="flex flex-col gap-1">
          <label className="flex flex-col gap-1 text-sm font-medium">
            Celular del cliente (opcional)
            <span className="flex gap-2">
              <input
                className="input min-w-0 flex-1"
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
      )}

      {!staffPurchase && (
        <section aria-label="Servicios" className="flex flex-col gap-2">
          {services.map((l) => (
            <div key={l.key} className="border-line rounded-md border p-3">
              <div className="flex items-center justify-between gap-2">
                <select
                  aria-label="Servicio"
                  className="input min-w-0 flex-1"
                  value={l.fromTicket ? `ticket:${l.serviceId}` : l.serviceId}
                  onChange={(e) => {
                    const v = e.target.value;
                    const serviceId = v.replace(/^ticket:/, "");
                    update(l.key, {
                      serviceId,
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
                    .filter((s) => !(l.key === 0 && view.ticket && s.id === view.ticket.serviceId))
                    .map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name} · {formatCOP(s.price)}
                      </option>
                    ))}
                </select>
                {services.length > 1 && (
                  <button
                    type="button"
                    className="text-danger min-h-12 px-2 text-sm font-semibold"
                    onClick={() => setServices((ls) => ls.filter((x) => x.key !== l.key))}
                    aria-label={`Quitar ${nameOf(l)}`}
                  >
                    Quitar
                  </button>
                )}
              </div>
              {membership && countsFor(l) && (memberKey === null || memberKey === l.key) && (
                <label className="mt-2 flex min-h-12 items-center gap-2 text-sm font-semibold">
                  <input
                    type="checkbox"
                    className="h-5 w-5"
                    checked={memberKey === l.key}
                    onChange={(e) => {
                      setMemberChoice(e.target.checked ? l.key : null);
                      if (e.target.checked) update(l.key, { discount: 0, reason: "" });
                    }}
                  />
                  Usar membresía
                </label>
              )}
              {memberLine(l) && (
                <p className="text-brand mt-1 text-sm font-semibold" data-testid="membership-line">
                  {memberLine(l)!.label}: −{formatCOP(memberLine(l)!.discount)}
                </p>
              )}
              {rewardOn(l) && (
                <p className="text-ok mt-1 text-sm font-semibold">
                  🎁 Premio aplicado: −{formatCOP(rewardValue(l))}
                </p>
              )}
              {view.isOwner && !rewardOn(l) && !memberLine(l) && (
                <div className="mt-2 grid grid-cols-[110px_1fr] gap-2">
                  <label className="flex flex-col text-xs">
                    Descuento
                    <input
                      className="input"
                      inputMode="numeric"
                      placeholder="0"
                      value={l.discount ? formatCOP(l.discount).replace("$ ", "") : ""}
                      onChange={(e) =>
                        update(l.key, {
                          discount: Math.min(parseCOP(e.target.value) ?? 0, priceOf(l)),
                        })
                      }
                    />
                  </label>
                  {l.discount > 0 && (
                    <label className="flex flex-col text-xs">
                      Motivo del descuento
                      <input
                        className="input"
                        maxLength={120}
                        value={l.reason}
                        onChange={(e) => update(l.key, { reason: e.target.value })}
                      />
                    </label>
                  )}
                </div>
              )}
            </div>
          ))}
          <button
            type="button"
            className="btn-secondary"
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
        </section>
      )}

      {rewardAvailable && (
        <div className="bg-ok-soft rounded-md p-3">
          {rewardApplied ? (
            <button
              type="button"
              className="btn-secondary"
              onClick={() => setServices((ls) => ls.map((l) => ({ ...l, isReward: false })))}
            >
              Quitar premio
            </button>
          ) : rewardLine ? (
            <button
              type="button"
              className="btn-secondary"
              onClick={() => update(rewardLine.key, { isReward: true, discount: 0, reason: "" })}
            >
              🎁 Aplicar premio
            </button>
          ) : (
            <p className="text-sm">
              Tiene un premio disponible: {rewardName}. Agrégalo como servicio para aplicarlo.
            </p>
          )}
        </div>
      )}

      {view.products.length > 0 && (
        <ProductShowcase
          products={view.products}
          qty={products}
          onChange={(id, qty) => setProducts((m) => ({ ...m, [id]: qty }))}
          discountPct={staffPurchase ? view.staffDiscountPct : 0}
        />
      )}
      {productCut > 0 && (
        <p className="text-muted text-center text-sm" data-testid="product-commission">
          Comisión de productos para {sellerName}: {formatCOP(productCut)}
        </p>
      )}
      {staffDiscountTotal > 0 && (
        <p className="text-muted text-center text-sm" data-testid="staff-discount">
          Descuento de empleado: −{formatCOP(staffDiscountTotal)}
        </p>
      )}

      <p className="text-center text-3xl font-bold" aria-live="polite" data-testid="checkout-total">
        {formatCOP(total)}
      </p>

      {total > 0 && (
        <div role="radiogroup" aria-label="Medio de pago" className="grid grid-cols-2 gap-2">
          {[...METHODS, { id: "gift_card" as const, label: "Tarjeta de regalo" }].map((m) => (
            <button
              key={m.id}
              type="button"
              role="radio"
              aria-checked={method === m.id}
              onClick={() => setMethod(m.id)}
              className={`min-h-12 rounded-md border font-semibold ${
                m.id === "gift_card" ? "col-span-2" : ""
              } ${method === m.id ? "border-brand bg-brand-soft text-ink border-2" : "border-line bg-card"}`}
            >
              {m.label}
            </button>
          ))}
        </div>
      )}

      {total > 0 && method === "gift_card" && (
        <section aria-label="Tarjeta de regalo" className="flex flex-col gap-2">
          <div className="flex items-end gap-2">
            <label className="flex flex-1 flex-col gap-1 text-sm font-medium">
              Código
              <input
                className="input font-mono uppercase"
                autoCapitalize="characters"
                autoComplete="off"
                maxLength={12}
                value={giftCode}
                onChange={(e) => {
                  setGiftCode(e.target.value);
                  if (gift && normalizeGiftCardCode(e.target.value) !== gift.code) setGift(null);
                }}
              />
            </label>
            <button
              type="button"
              className="btn-secondary min-h-12"
              aria-label="Buscar tarjeta de regalo"
              disabled={pending || normalizeGiftCardCode(giftCode).length !== 8}
              onClick={lookupGift}
            >
              Buscar
            </button>
          </div>
          {gift && (
            <>
              <p className="text-sm font-semibold" data-testid="gift-card-balance">
                {gift.label}
              </p>
              <p className="text-sm">
                Con la tarjeta: <strong>{formatCOP(giftSplit.card)}</strong>
              </p>
              {giftSplit.rest > 0 && (
                <>
                  <p className="text-sm">
                    Faltan <strong>{formatCOP(giftSplit.rest)}</strong>. ¿Con qué se pagan?
                  </p>
                  <div
                    role="radiogroup"
                    aria-label="Medio para lo que falta"
                    className="grid grid-cols-2 gap-2"
                  >
                    {METHODS.map((m) => (
                      <button
                        key={m.id}
                        type="button"
                        role="radio"
                        aria-checked={restMethod === m.id}
                        onClick={() => setRestMethod(m.id)}
                        className={`min-h-12 rounded-md border font-semibold ${
                          restMethod === m.id
                            ? "border-brand bg-brand-soft text-ink border-2"
                            : "border-line bg-card"
                        }`}
                      >
                        {m.label}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </>
          )}
          {/* REQ-057.1 si se tocó por error: volver a escoger el medio */}
          <button
            type="button"
            className="min-h-12 text-sm font-semibold underline"
            onClick={() => {
              setMethod(null);
              setGift(null);
              setGiftCode("");
              setRestMethod(null);
              setError(null);
            }}
          >
            Usar otro medio de pago
          </button>
        </section>
      )}

      {error && <ErrorText>{error}</ErrorText>}

      {view.ticket &&
        (unpaidOpen ? (
          <div className="flex flex-col gap-2">
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
          <div className="flex gap-2">
            <button type="button" className="btn-secondary flex-1" onClick={onClose}>
              Cobrar después
            </button>
            <button
              type="button"
              className="btn-secondary flex-1"
              onClick={() => setUnpaidOpen(true)}
            >
              No se cobró
            </button>
          </div>
        ))}
      {!view.ticket && (
        <button type="button" className="btn-secondary" onClick={onClose}>
          Cancelar
        </button>
      )}
    </Sheet>
  );
}

/**
 * Hoja del cobro (tablero Barbero-Cobro): el contenido se desplaza y el total con "Registrar"
 * quedan fijos abajo (`footer`), siempre a la vista del pulgar.
 */
function Sheet({
  children,
  onClose,
  title,
  footer,
}: {
  children: React.ReactNode;
  onClose: () => void;
  title: string;
  footer?: React.ReactNode;
}) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      className="bg-ink/60 fixed inset-0 z-30 flex items-end"
      onKeyDown={(e) => e.key === "Escape" && onClose()}
    >
      <div className="bg-card flex max-h-[92dvh] w-full flex-col rounded-t-lg sm:mx-auto sm:max-w-lg">
        <div className="flex flex-col gap-3 overflow-y-auto p-5">{children}</div>
        {footer && (
          <div className="border-line border-t px-5 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
