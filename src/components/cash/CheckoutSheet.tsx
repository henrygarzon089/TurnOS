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
import { computeSale } from "@/lib/domain/commission";
import { giftCardSplit, normalizeGiftCardCode } from "@/lib/domain/giftCard";
import { membershipCheckoutLine, membershipLineKey } from "@/lib/domain/membership";
import { formatCOP, parseCOP } from "@/lib/domain/money";

const METHODS: { id: PaymentMethod; label: string }[] = [
  { id: "cash", label: "Efectivo" },
  { id: "nequi", label: "Nequi" },
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
 * servicio y precio. Sin turno ("Nueva venta", T-044): se elige barbero (si hay servicios).
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
  const [barberId, setBarberId] = useState<string>("");
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
      if (v && !v.ticket && !v.isOwner && v.barbers[0]) setBarberId(v.barbers[0].id);
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
        setBarberId(v.ticket.barberId);
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
  const total = amounts?.total ?? 0;
  const hasLines = services.length > 0 || Object.values(products).some((q) => q > 0);
  const needsBarber = services.length > 0 && !barberId;
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
        barberId: barberId || null,
        customerId: view?.ticket ? null : (customer?.id ?? null),
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
    <Sheet onClose={onClose} title={title}>
      <p className="text-lg font-bold">{title}</p>
      {view.ticket && (
        <p className="text-muted -mt-2 text-sm">
          {view.ticket.customerName} · {view.ticket.barberName}
        </p>
      )}

      {!view.ticket && (
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

      {!view.ticket && services.length > 0 && view.isOwner && (
        <label className="flex flex-col gap-1 text-sm font-medium">
          Barbero
          <select className="input" value={barberId} onChange={(e) => setBarberId(e.target.value)}>
            <option value="">Elige el barbero</option>
            {view.barbers.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        </label>
      )}

      <section aria-label="Servicios" className="flex flex-col gap-2">
        {services.map((l) => (
          <div key={l.key} className="border-line rounded-xl border p-3">
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
              <p className="mt-1 text-sm font-semibold text-blue-800" data-testid="membership-line">
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

      {rewardAvailable && (
        <div className="rounded-xl bg-green-50 p-3">
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
              className="btn-primary"
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
        <section aria-label="Productos" className="flex flex-col gap-1">
          <p className="text-sm font-semibold">Productos</p>
          {view.products.map((p) => {
            const qty = products[p.id] ?? 0;
            return (
              <div key={p.id} className="flex min-h-12 items-center justify-between gap-2">
                <span className="text-sm">
                  {p.name} · {formatCOP(p.price)}
                </span>
                <span className="flex items-center gap-2">
                  <button
                    type="button"
                    className="btn-secondary h-12 w-12 px-0"
                    aria-label={`Quitar un ${p.name}`}
                    disabled={qty === 0}
                    onClick={() => setProducts((m) => ({ ...m, [p.id]: Math.max(0, qty - 1) }))}
                  >
                    −
                  </button>
                  <span className="w-6 text-center font-semibold" aria-label={`${p.name}: ${qty}`}>
                    {qty}
                  </span>
                  <button
                    type="button"
                    className="btn-secondary h-12 w-12 px-0"
                    aria-label={`Agregar un ${p.name}`}
                    onClick={() => setProducts((m) => ({ ...m, [p.id]: qty + 1 }))}
                  >
                    +
                  </button>
                </span>
              </div>
            );
          })}
        </section>
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
              className={`min-h-12 rounded-xl border font-semibold ${
                m.id === "gift_card" ? "col-span-2" : ""
              } ${method === m.id ? "bg-accent text-accent-ink border-accent" : "border-line bg-card"}`}
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
                        className={`min-h-12 rounded-xl border font-semibold ${
                          restMethod === m.id
                            ? "bg-accent text-accent-ink border-accent"
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
        </section>
      )}

      {error && <ErrorText>{error}</ErrorText>}

      <button
        type="button"
        className="btn-primary"
        disabled={pending || !hasLines || needsBarber || !amounts}
        onClick={submit}
      >
        {pending ? "Registrando…" : `Registrar ${formatCOP(total)}`}
      </button>

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

function Sheet({
  children,
  onClose,
  title,
}: {
  children: React.ReactNode;
  onClose: () => void;
  title: string;
}) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      className="fixed inset-0 z-30 flex items-end bg-black/40"
      onKeyDown={(e) => e.key === "Escape" && onClose()}
    >
      <div className="bg-card flex max-h-[92dvh] w-full flex-col gap-3 overflow-y-auto rounded-t-2xl p-5">
        {children}
      </div>
    </div>
  );
}
