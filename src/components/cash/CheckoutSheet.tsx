"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { ErrorText } from "@/components/auth/LoginForm";
import {
  getCheckout,
  markUnpaid,
  registerSale,
  type CheckoutView,
  type PaymentMethod,
} from "@/lib/actions/cash";
import { computeSale } from "@/lib/domain/commission";
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
 * REQ-023.1–23.3, REQ-019.4, REQ-023.6: panel "Registrar cobro". Con turno: prellenado con su
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
  const [method, setMethod] = useState<PaymentMethod | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [unpaidOpen, setUnpaidOpen] = useState(false);
  const [unpaidReason, setUnpaidReason] = useState("");
  const [pending, startTransition] = useTransition();
  const [nextKey, setNextKey] = useState(1);
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
  const rewardValue = (l: ServiceLine) =>
    view?.loyalty?.rewardType === "discount"
      ? Math.min(view.loyalty.rewardAmount ?? 0, priceOf(l))
      : priceOf(l);

  const amounts = useMemo(() => {
    if (!view) return null;
    try {
      return computeSale({
        services: services.map((l) => ({
          unitPrice: priceOf(l),
          qty: 1,
          discount: l.isReward ? rewardValue(l) : l.discount,
          isReward: l.isReward,
        })),
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
  }, [view, services, products]);

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

  const rewardAvailable = !!view.loyalty?.available;
  const rewardApplied = services.some((l) => l.isReward);
  const rewardLine = services.find((l) =>
    view.loyalty?.rewardType === "discount" ? true : l.serviceId === view.rewardServiceId,
  );
  const rewardName = view.services.find((s) => s.id === view.rewardServiceId)?.name ?? "el premio";
  const total = amounts?.total ?? 0;
  const hasLines = services.length > 0 || Object.values(products).some((q) => q > 0);
  const needsBarber = services.length > 0 && !barberId;

  function update(key: number, patch: Partial<ServiceLine>) {
    setServices((ls) => ls.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  }

  function submit() {
    if (!amounts) return;
    if (total > 0 && !method) {
      setError("Elige el medio de pago.");
      return;
    }
    setError(null);
    startTransition(async () => {
      const r = await registerSale({
        ticketId: view?.ticket?.id ?? null,
        barberId: barberId || null,
        items: [
          ...services.map((l) => ({
            kind: "service" as const,
            refId: l.serviceId,
            qty: 1,
            discount: l.isReward ? 0 : l.discount,
            discountReason: l.reason || undefined,
            isReward: l.isReward,
          })),
          ...Object.entries(products)
            .filter(([, qty]) => qty > 0)
            .map(([id, qty]) => ({ kind: "product" as const, refId: id, qty })),
        ],
        method: method ?? "cash",
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
            {l.isReward && (
              <p className="text-ok mt-1 text-sm font-semibold">
                🎁 Premio aplicado: −{formatCOP(rewardValue(l))}
              </p>
            )}
            {view.isOwner && !l.isReward && (
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
          {METHODS.map((m) => (
            <button
              key={m.id}
              type="button"
              role="radio"
              aria-checked={method === m.id}
              onClick={() => setMethod(m.id)}
              className={`min-h-12 rounded-xl border font-semibold ${
                method === m.id ? "bg-accent text-accent-ink border-accent" : "border-line bg-card"
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>
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
