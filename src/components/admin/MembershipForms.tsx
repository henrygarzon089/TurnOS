"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ErrorText } from "@/components/auth/LoginForm";
import type { PaymentMethod } from "@/lib/actions/cash";
import {
  addFamilyMember,
  createFamily,
  payMembershipFee,
  removeFamilyMember,
  saveMembershipPlan,
  type MembershipFormState,
  type MembershipsView,
} from "@/lib/actions/memberships";
import type { FamilyRow } from "@/lib/domain/membership";
import { formatCOP } from "@/lib/domain/money";
import { formatPhoneCO } from "@/lib/domain/phone";
import { formatDayCO } from "@/lib/domain/time";
import { buildRenewalLink } from "@/lib/notifications/reminder";

const METHODS: { id: PaymentMethod; label: string }[] = [
  { id: "cash", label: "Efectivo" },
  { id: "nequi", label: "Nequi" },
  { id: "transfer", label: "Transferencia" },
  { id: "card", label: "Tarjeta" },
];

type FormAction = (prev: MembershipFormState, fd: FormData) => Promise<MembershipFormState>;

/**
 * Acción de formulario que, si termina bien, refresca la página (y avisa con onOk). Se envía con
 * onSubmit y no con `action`: React limpia el formulario al terminar una `action`, aunque falle,
 * y el dueño perdería lo que escribió. `reset` limpia solo cuando termina bien.
 */
function useRefreshingAction(fn: FormAction, opts: { onOk?: () => void; reset?: boolean } = {}) {
  const router = useRouter();
  const [state, setState] = useState<MembershipFormState>(undefined);
  const [pending, startTransition] = useTransition();
  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    startTransition(async () => {
      const r = await fn(state, new FormData(form));
      setState(r);
      if (r?.ok) {
        if (opts.reset) form.reset();
        opts.onOk?.();
        router.refresh();
      }
    });
  }
  return [state, onSubmit, pending] as const;
}

// ------------------------------------------------------------------ plan ----

/** REQ-044.1–044.3: el plan, apagado por defecto; no se enciende incompleto. */
export function MembershipPlanForm({
  plan,
  services,
}: {
  plan: MembershipsView["plan"];
  services: MembershipsView["services"];
}) {
  const [state, onSubmit, pending] = useRefreshingAction(saveMembershipPlan);
  const [enabled, setEnabled] = useState(plan.enabled);

  return (
    <form onSubmit={onSubmit} className="mt-3 flex flex-col gap-4">
      <label className="border-line bg-card flex min-h-14 items-center gap-3 rounded-xl border px-4">
        <input
          type="checkbox"
          name="enabled"
          checked={enabled}
          onChange={(e) => setEnabled(e.target.checked)}
          className="h-5 w-5"
        />
        <span className="font-semibold">Membresía activa</span>
      </label>

      <label className="flex flex-col gap-1 text-sm font-medium">
        Precio de la cuota
        <input
          name="price"
          inputMode="numeric"
          defaultValue={plan.price ? formatCOP(plan.price).replace("$ ", "") : ""}
          placeholder="80.000"
          className="input"
        />
      </label>
      <div className="grid grid-cols-2 gap-3">
        <label className="flex flex-col gap-1 text-sm font-medium">
          Cortes por periodo
          <input
            name="cuts"
            type="number"
            inputMode="numeric"
            min={1}
            max={100}
            defaultValue={plan.cuts ?? ""}
            className="input"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium">
          Descuento al agotarlos (%)
          <input
            name="discount_pct"
            type="number"
            inputMode="numeric"
            min={0}
            max={100}
            defaultValue={plan.discountPct ?? ""}
            className="input"
          />
        </label>
      </div>

      <fieldset className="border-line bg-card flex flex-col gap-1 rounded-xl border p-4">
        <legend className="px-1 text-sm font-semibold">Servicios que gastan cortes</legend>
        {services.map((s) => (
          <label key={s.id} className="flex min-h-10 items-center gap-3">
            <input
              type="checkbox"
              name="services"
              value={s.id}
              defaultChecked={s.counts}
              className="h-5 w-5"
            />
            {s.name}
          </label>
        ))}
      </fieldset>

      <p className="text-muted text-xs">
        Cada periodo dura 30 días. Los cambios aplican a los periodos que se paguen después: los ya
        pagados conservan su precio, cortes y descuento.
      </p>
      {state?.error && <ErrorText>{state.error}</ErrorText>}
      {state?.ok && (
        <p role="status" className="text-ok text-sm font-medium">
          Plan guardado.
        </p>
      )}
      <button type="submit" className="btn-primary" disabled={pending}>
        {pending ? "Guardando…" : "Guardar plan"}
      </button>
    </form>
  );
}

// ------------------------------------------------------ vencen esta semana ----

/** REQ-048.4: las que vencen en los próximos 7 días, con recordatorio por WhatsApp. */
export function ExpiringList({ view }: { view: MembershipsView }) {
  if (view.expiring.length === 0) {
    return <p className="text-muted mt-2">Ninguna membresía vence esta semana.</p>;
  }
  return (
    <ul aria-label="Vencen esta semana" className="mt-2 flex flex-col gap-2">
      {view.expiring.map((m) => (
        <li
          key={m.membershipId}
          className="border-line bg-card flex flex-col gap-2 rounded-xl border p-3"
        >
          <div>
            <p className="font-semibold">{m.name}</p>
            <p className="text-muted text-sm">
              {m.endsOn === view.today ? "Vence hoy" : `Vence el ${formatDayCO(m.endsOn)}`}
            </p>
          </div>
          <a
            className="btn-primary"
            href={buildRenewalLink({
              phoneE164: m.phone,
              template: view.template,
              customerName: m.name,
              businessName: view.businessName,
              endsOn: m.endsOn,
            })}
            target="_blank"
            rel="noopener"
          >
            📲 Recordar por WhatsApp
          </a>
        </li>
      ))}
    </ul>
  );
}

// ------------------------------------------------------------- familias ----

function PersonFields({ prefix }: { prefix: string }) {
  return (
    <>
      <label className="flex flex-col gap-1 text-sm font-medium">
        Nombre
        <input
          id={`${prefix}-name`}
          name="name"
          required
          minLength={2}
          maxLength={80}
          autoComplete="off"
          className="input"
        />
      </label>
      <label className="flex flex-col gap-1 text-sm font-medium">
        Celular
        <input
          id={`${prefix}-phone`}
          name="phone"
          type="tel"
          inputMode="tel"
          required
          placeholder="300 123 4567"
          autoComplete="off"
          className="input"
        />
      </label>
    </>
  );
}

/** REQ-046.1 / REQ-046.2: nueva familia con su titular. */
export function NewFamilyForm() {
  const [state, onSubmit, pending] = useRefreshingAction(createFamily, { reset: true });

  return (
    <form
      onSubmit={onSubmit}
      aria-label="Nueva familia"
      className="border-line bg-card mt-3 flex flex-col gap-3 rounded-xl border p-4"
    >
      <p className="font-semibold">Nueva familia</p>
      <p className="text-muted -mt-2 text-xs">
        El titular paga la cuota. Si el celular no tiene ficha, se crea con el nombre.
      </p>
      <PersonFields prefix="holder" />
      {state?.error && <ErrorText>{state.error}</ErrorText>}
      <button type="submit" className="btn-primary" disabled={pending}>
        {pending ? "Creando…" : "Crear familia"}
      </button>
    </form>
  );
}

function AddMemberForm({ membershipId }: { membershipId: string }) {
  const [open, setOpen] = useState(false);
  const [state, onSubmit, pending] = useRefreshingAction(addFamilyMember, {
    onOk: () => setOpen(false),
  });

  if (!open) {
    return (
      <button type="button" className="btn-secondary" onClick={() => setOpen(true)}>
        Agregar persona
      </button>
    );
  }
  return (
    <form onSubmit={onSubmit} aria-label="Agregar persona" className="flex flex-col gap-3">
      <input type="hidden" name="membership_id" value={membershipId} />
      <PersonFields prefix={`add-${membershipId}`} />
      {state?.error && <ErrorText>{state.error}</ErrorText>}
      <div className="flex gap-2">
        <button type="submit" className="btn-primary flex-1" disabled={pending}>
          {pending ? "Agregando…" : "Agregar"}
        </button>
        <button type="button" className="btn-secondary" onClick={() => setOpen(false)}>
          Cancelar
        </button>
      </div>
    </form>
  );
}

/** REQ-045.1: cobrar la cuota con un medio de pago de la caja. */
function PayFee({ family, price }: { family: FamilyRow; price: number }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [method, setMethod] = useState<PaymentMethod>("cash");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [pending, startTransition] = useTransition();

  function pay() {
    setError(null);
    startTransition(async () => {
      const r = await payMembershipFee(family.id, method, price);
      if (!r.ok) setError(r.error);
      else {
        setDone(true);
        setOpen(false);
        router.refresh();
      }
    });
  }

  if (!open) {
    return (
      <>
        {done && (
          <p role="status" className="text-ok text-sm font-medium">
            Cuota cobrada. Quedó en la caja de hoy.
          </p>
        )}
        <button
          type="button"
          className="btn-primary"
          onClick={() => {
            setDone(false);
            setOpen(true);
          }}
        >
          Cobrar cuota
        </button>
      </>
    );
  }
  return (
    <div className="flex flex-col gap-3">
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
                name={`method-${family.id}`}
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
      {error && <ErrorText>{error}</ErrorText>}
      <div className="flex gap-2">
        <button type="button" className="btn-primary flex-1" disabled={pending} onClick={pay}>
          {pending ? "Cobrando…" : `Cobrar ${formatCOP(price)}`}
        </button>
        <button type="button" className="btn-secondary" onClick={() => setOpen(false)}>
          Cancelar
        </button>
      </div>
    </div>
  );
}

/** REQ-046.1, REQ-046.4, REQ-045.1: una familia con su periodo, sus miembros y la cuota. */
export function FamilyCard({ family, plan }: { family: FamilyRow; plan: MembershipsView["plan"] }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function remove(memberId: string, name: string) {
    if (!window.confirm(`¿Quitar a ${name} de la familia? Los cortes no se devuelven.`)) return;
    setError(null);
    startTransition(async () => {
      const r = await removeFamilyMember(memberId);
      if (!r.ok) setError(r.error);
      else router.refresh();
    });
  }

  const title = family.holderName ?? "Familia sin titular";
  return (
    <li
      aria-label={`Familia de ${title}`}
      className="border-line bg-card flex flex-col gap-3 rounded-xl border p-3"
    >
      <div>
        <p className="font-semibold">Familia de {title}</p>
        {family.current ? (
          <p className="text-sm">
            Quedan {family.current.cutsLeft} de {family.current.cutsTotal} cortes · vence el{" "}
            {formatDayCO(family.current.endsOn)}
          </p>
        ) : (
          <p className="text-muted text-sm">
            {plan.enabled ? "Sin periodo vigente." : "La membresía está apagada."}
          </p>
        )}
        {family.paidUntil && (
          <p className="text-muted text-sm">Pagada hasta el {formatDayCO(family.paidUntil)}</p>
        )}
      </div>

      <ul aria-label="Miembros" className="flex flex-col gap-1">
        {family.members.map((m) => (
          <li key={m.id} className="flex min-h-12 items-center justify-between gap-2">
            <div>
              <p className="font-medium">
                {m.name}
                {m.isHolder && (
                  <span className="bg-accent text-card ml-2 rounded-full px-2 py-0.5 text-xs">
                    Titular
                  </span>
                )}
              </p>
              <p className="text-muted text-xs">{formatPhoneCO(m.phone)}</p>
            </div>
            <button
              type="button"
              className="text-danger min-h-12 px-2 text-sm font-semibold"
              disabled={pending}
              onClick={() => remove(m.id, m.name)}
              aria-label={`Quitar a ${m.name}`}
            >
              Quitar
            </button>
          </li>
        ))}
      </ul>
      {error && <ErrorText>{error}</ErrorText>}

      {family.members.length < 5 ? (
        <AddMemberForm membershipId={family.id} />
      ) : (
        <p className="text-muted text-xs">La familia está completa: 5 personas.</p>
      )}
      {plan.enabled && plan.price ? <PayFee family={family} price={plan.price} /> : null}
    </li>
  );
}
