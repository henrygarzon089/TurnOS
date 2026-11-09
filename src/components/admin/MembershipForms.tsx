"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Tag } from "@/components/admin/ModulePage";
import { ErrorText } from "@/components/auth/LoginForm";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { OptionList } from "@/components/ui/OptionList";
import { Sheet } from "@/components/ui/Sheet";
import { EmptyState } from "@/components/ui/States";
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
import { familyQuota, familyUsed } from "@/lib/domain/owner-tables";
import { maskPhone } from "@/lib/domain/phone";
import { formatDayCO } from "@/lib/domain/time";
import { buildRenewalLink } from "@/lib/notifications/reminder";

const METHODS: { id: PaymentMethod; label: string }[] = [
  { id: "cash", label: "Efectivo" },
  { id: "nequi", label: "Nequi" },
  { id: "daviplata", label: "Daviplata" },
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
    <form onSubmit={onSubmit} className="flex flex-col gap-4 p-4">
      <label className="border-line flex min-h-14 items-center gap-3 rounded-md border px-4">
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

      <fieldset className="border-line flex flex-col gap-1 rounded-md border p-4">
        <legend className="px-1 text-sm font-semibold">Servicios que gastan cortes</legend>
        {services.map((s) => (
          <label key={s.id} className="flex min-h-12 items-center gap-3">
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
      {/* El principal de la pantalla es "Nueva familia" (REQ-078.4) */}
      <Button type="submit" variant="secondary" pending={pending}>
        Guardar plan
      </Button>
    </form>
  );
}

// ------------------------------------------------------ vencen esta semana ----

/** REQ-048.4: las que vencen en los próximos 7 días, con recordatorio por WhatsApp. */
export function ExpiringList({ view }: { view: MembershipsView }) {
  if (view.expiring.length === 0) {
    return (
      <p className="text-muted px-4 py-4 text-sm">
        Ninguna membresía vence esta semana. Cuando falten 7 días, sale aquí para recordarle a la
        familia.
      </p>
    );
  }
  return (
    <ul aria-label="Vencen esta semana" className="divide-line divide-y">
      {view.expiring.map((m) => (
        <li
          key={m.membershipId}
          className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
        >
          <div className="min-w-0">
            <p className="font-bold">{m.name}</p>
            <p className="text-warn text-sm font-semibold">
              {m.endsOn === view.today ? "Vence hoy" : `Vence el ${formatDayCO(m.endsOn)}`}
            </p>
          </div>
          <a
            className="btn-secondary w-full shrink-0 text-base sm:w-auto"
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
            Recordar por WhatsApp
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

/**
 * REQ-046.1 / REQ-046.2: nueva familia con su titular. Es el principal de la pantalla y abre la
 * hoja con el formulario (tablero Dueno-Clientes, T-166).
 */
export function NewFamilyForm() {
  const [open, setOpen] = useState(false);
  const [state, onSubmit, pending] = useRefreshingAction(createFamily, {
    reset: true,
    onOk: () => setOpen(false),
  });

  return (
    <>
      <Button className="text-base" onClick={() => setOpen(true)}>
        <Icon name="plus" />
        Nueva familia
      </Button>
      <Sheet
        open={open}
        onClose={() => setOpen(false)}
        title="Nueva familia"
        description="El titular paga la cuota. Si el celular no tiene ficha, se crea con el nombre."
      >
        <form onSubmit={onSubmit} aria-label="Nueva familia" className="flex flex-col gap-3">
          <PersonFields prefix="holder" />
          {state?.error && <ErrorText>{state.error}</ErrorText>}
          <Button type="submit" pending={pending}>
            Crear familia
          </Button>
          <Button variant="text" className="mx-auto" onClick={() => setOpen(false)}>
            Cerrar
          </Button>
        </form>
      </Sheet>
    </>
  );
}

function AddMemberForm({ membershipId }: { membershipId: string }) {
  const [open, setOpen] = useState(false);
  const [state, onSubmit, pending] = useRefreshingAction(addFamilyMember, {
    onOk: () => setOpen(false),
  });

  return (
    <>
      <Button variant="secondary" className="text-base" onClick={() => setOpen(true)}>
        Agregar persona
      </Button>
      <Sheet open={open} onClose={() => setOpen(false)} title="Agregar persona">
        <form onSubmit={onSubmit} aria-label="Agregar persona" className="flex flex-col gap-3">
          <input type="hidden" name="membership_id" value={membershipId} />
          <PersonFields prefix={`add-${membershipId}`} />
          {state?.error && <ErrorText>{state.error}</ErrorText>}
          <Button type="submit" pending={pending}>
            Agregar
          </Button>
          <Button variant="text" className="mx-auto" onClick={() => setOpen(false)}>
            Cancelar
          </Button>
        </form>
      </Sheet>
    </>
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

  return (
    <>
      {done && (
        <p role="status" className="text-ok text-sm font-medium">
          Cuota cobrada. Quedó en la caja de hoy.
        </p>
      )}
      <Button
        variant="secondary"
        className="text-base"
        onClick={() => {
          setDone(false);
          setOpen(true);
        }}
      >
        Cobrar cuota
      </Button>
      <Sheet
        open={open}
        onClose={() => setOpen(false)}
        title="Cobrar cuota"
        description={`Familia de ${family.holderName ?? "sin titular"} · ${formatCOP(price)}`}
      >
        <OptionList
          name={`method-${family.id}`}
          legend="Medio de pago"
          layout="grid"
          options={METHODS.map((m) => ({ value: m.id, label: m.label }))}
          value={method}
          onChange={(v) => setMethod(v as PaymentMethod)}
        />
        {error && <ErrorText>{error}</ErrorText>}
        <Button pending={pending} onClick={pay}>
          {`Cobrar ${formatCOP(price)}`}
        </Button>
        <Button variant="text" className="mx-auto" onClick={() => setOpen(false)}>
          Cancelar
        </Button>
      </Sheet>
    </>
  );
}

/**
 * REQ-046.1, REQ-046.4, REQ-045.1: una familia con su periodo, sus miembros (celular enmascarado,
 * REQ-078.6) y la cuota. Quitar a alguien pide confirmación en una hoja (REQ-078.3).
 */
export function FamilyCard({ family, plan }: { family: FamilyRow; plan: MembershipsView["plan"] }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [removing, setRemoving] = useState<{ id: string; name: string } | null>(null);
  const [pending, startTransition] = useTransition();

  function remove() {
    const target = removing!;
    setError(null);
    startTransition(async () => {
      const r = await removeFamilyMember(target.id);
      setRemoving(null);
      if (!r.ok) setError(r.error);
      else router.refresh();
    });
  }

  const title = family.holderName ?? "Familia sin titular";
  return (
    <div role="group" aria-label={`Familia de ${title}`} className="flex flex-col gap-3 px-4 py-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-bold">Familia de {title}</p>
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
        {family.current ? <Tag tone="ok">Al día</Tag> : <Tag>Sin periodo</Tag>}
      </div>

      <ul aria-label="Miembros" className="border-line divide-line divide-y rounded-md border">
        {family.members.map((m) => (
          <li key={m.id} className="flex min-h-12 items-center justify-between gap-2 pl-3">
            <div className="min-w-0">
              <p className="flex items-center gap-2 font-medium">
                <span className="truncate">{m.name}</span>
                {m.isHolder && <Tag tone="outline">Titular</Tag>}
              </p>
              <p className="text-muted text-xs tabular-nums">{maskPhone(m.phone)}</p>
            </div>
            <button
              type="button"
              className="text-danger min-h-12 shrink-0 px-3 text-sm font-semibold underline underline-offset-4 disabled:opacity-50"
              disabled={pending}
              onClick={() => setRemoving({ id: m.id, name: m.name })}
              aria-label={`Quitar a ${m.name}`}
            >
              Quitar
            </button>
          </li>
        ))}
      </ul>
      {error && <ErrorText>{error}</ErrorText>}

      <div className="flex flex-wrap items-center gap-2">
        {family.members.length < 5 ? (
          <AddMemberForm membershipId={family.id} />
        ) : (
          <p className="text-muted text-xs">La familia está completa: 5 personas.</p>
        )}
        {plan.enabled && plan.price ? <PayFee family={family} price={plan.price} /> : null}
      </div>

      <Sheet
        open={removing !== null}
        onClose={() => setRemoving(null)}
        title={removing ? `¿Quitar a ${removing.name} de la familia?` : ""}
        description="Los cortes no se devuelven."
      >
        <Button variant="danger" className="w-full" pending={pending} onClick={remove}>
          Sí, quitar
        </Button>
        <Button variant="text" className="mx-auto" onClick={() => setRemoving(null)}>
          No, dejarlo
        </Button>
      </Sheet>
    </div>
  );
}

/**
 * REQ-078.33 (T-180) familias como la tabla del tablero Dueno-Clientes: Familia · Usó · Cuota.
 * Tocar la familia despliega debajo su ficha (miembros, agregar, quitar, cobrar cuota); o qué
 * hacer si no hay ninguna (REQ-078.11).
 */
export function FamilyList({ view }: { view: MembershipsView }) {
  const [openId, setOpenId] = useState<string | null>(null);
  if (view.families.length === 0) {
    return (
      <EmptyState
        icon="users"
        title="Todavía no hay familias."
        text='Toca "Nueva familia" y escribe el nombre y el celular de quien paga la cuota.'
      />
    );
  }
  // Rejilla con roles de tabla y no <table>: la ficha abre hojas (<dialog>) que dentro de un <td>
  // se arman mal en el celular.
  const cols = "grid grid-cols-[minmax(0,1fr)_3.5rem_auto] items-center";
  return (
    <div role="table" aria-label="Familias" className="text-sm">
      <div role="rowgroup" className="bg-brand text-brand-ink text-xs">
        <div role="row" className={cols}>
          <span role="columnheader" className="px-4 py-2 font-bold">
            Familia
          </span>
          <span role="columnheader" className="px-3 py-2 text-right font-bold">
            Usó
          </span>
          <span role="columnheader" className="px-4 py-2 font-bold">
            Cuota
          </span>
        </div>
      </div>
      <div role="rowgroup" className="divide-line divide-y">
        {view.families.map((f) => {
          const quota = familyQuota(f.current, view.today);
          const open = openId === f.id;
          const title = f.holderName ?? "Familia sin titular";
          return (
            <div key={f.id} className={open ? "bg-surface" : ""}>
              <div role="row" className={cols}>
                <span role="cell" className="min-w-0 px-2">
                  <button
                    type="button"
                    aria-expanded={open}
                    aria-label={`Ver la familia de ${title}`}
                    onClick={() => setOpenId(open ? null : f.id)}
                    className="flex min-h-12 w-full min-w-0 items-center gap-2 px-2 text-left"
                  >
                    <Icon
                      name="next"
                      className={`text-muted size-4 transition-transform ${open ? "rotate-90" : ""}`}
                    />
                    <span className="min-w-0 truncate">
                      <strong>{title}</strong>
                      <span className="text-muted">
                        {" "}
                        · {f.members.length} {f.members.length === 1 ? "persona" : "personas"}
                      </span>
                    </span>
                  </button>
                </span>
                <span role="cell" className="px-3 py-2 text-right tabular-nums">
                  {familyUsed(f.current)}
                </span>
                <span role="cell" className="px-4 py-2">
                  <Tag tone={quota.tone}>{quota.label}</Tag>
                </span>
              </div>
              {open && <FamilyCard family={f} plan={view.plan} />}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** REQ-078.33 "Editar plan" abre el formulario del plan en una hoja (design §22.8). */
export function EditPlanButton({
  plan,
  services,
}: {
  plan: MembershipsView["plan"];
  services: MembershipsView["services"];
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="secondary" className="text-base" onClick={() => setOpen(true)}>
        Editar plan
      </Button>
      <Sheet open={open} onClose={() => setOpen(false)} title="Plan familiar">
        <MembershipPlanForm plan={plan} services={services} />
        <Button variant="text" className="mx-auto" onClick={() => setOpen(false)}>
          Cerrar
        </Button>
      </Sheet>
    </>
  );
}
