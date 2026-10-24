"use client";

import { useActionState, useMemo, useState } from "react";
import { ErrorText, Field } from "@/components/auth/LoginForm";
import { saveTemplates, updateBusiness, type FormState } from "@/lib/actions/admin";
import { renderTemplate } from "@/lib/notifications/render";

export type TemplateKey = "notify_2_turns" | "reminder_inactive" | "share_queue";

const TEMPLATE_META: Record<TemplateKey, { title: string; help: string }> = {
  notify_2_turns: {
    title: "Aviso: faltan 2 turnos",
    help: "Lo envía el barbero con un toque cuando al cliente le faltan 2 turnos.",
  },
  reminder_inactive: {
    title: "Recordatorio a clientes que no han vuelto",
    help: "Para la lista de clientes con más de N días sin venir.",
  },
  share_queue: {
    title: "Compartir la fila",
    help: "Mensaje con el enlace de la fila para mandar por WhatsApp.",
  },
};

const SAMPLE = {
  nombre: "Camilo",
  negocio: "Barbería La 33",
  tiempo: "≈ 25 min",
  enlace: "https://turnos.app/t/abc123",
};

export function TemplatesForm({
  templates,
  businessName,
}: {
  templates: Record<TemplateKey, string>;
  businessName: string;
}) {
  const [state, action, pending] = useActionState<FormState, FormData>(saveTemplates, undefined);
  const [values, setValues] = useState(templates);
  const sample = useMemo(() => ({ ...SAMPLE, negocio: businessName }), [businessName]);

  return (
    <form action={action} className="mt-4 flex flex-col gap-5">
      {(Object.keys(TEMPLATE_META) as TemplateKey[]).map((key) => (
        <div key={key} className="border-line bg-card flex flex-col gap-2 rounded-xl border p-3">
          <label htmlFor={key} className="font-semibold">
            {TEMPLATE_META[key].title}
          </label>
          <p className="text-muted text-xs">{TEMPLATE_META[key].help}</p>
          <textarea
            id={key}
            name={key}
            rows={3}
            maxLength={1000}
            required
            value={values[key]}
            onChange={(e) => setValues({ ...values, [key]: e.target.value })}
            className="input min-h-24 py-2"
          />
          <p className="text-muted text-xs">
            Variables: {"{nombre}"} {"{negocio}"} {"{tiempo}"} {"{enlace}"}
          </p>
          <div className="rounded-lg bg-green-50 p-2 text-sm" aria-label="Vista previa">
            {renderTemplate(values[key], sample)}
          </div>
        </div>
      ))}
      {state?.error && <ErrorText>{state.error}</ErrorText>}
      {state?.ok && <p className="text-ok text-sm font-medium">Plantillas guardadas.</p>}
      <button type="submit" className="btn-primary" disabled={pending}>
        {pending ? "Guardando…" : "Guardar plantillas"}
      </button>
    </form>
  );
}

export type BusinessSettings = {
  name: string;
  address: string | null;
  chairs_count: number;
  default_commission_pct: number;
  grace_minutes: number;
  inactive_days: number;
  reminder_cooldown_days: number;
  pwa_name: string | null;
  slug: string;
};

export function BusinessForm({ business }: { business: BusinessSettings }) {
  const [state, action, pending] = useActionState<FormState, FormData>(updateBusiness, undefined);
  const num = (name: keyof BusinessSettings, label: string, min: number, max: number) => (
    <Field label={label} htmlFor={name}>
      <input
        id={name}
        name={name}
        type="number"
        min={min}
        max={max}
        inputMode="numeric"
        defaultValue={business[name] as number}
        required
        className="input"
      />
    </Field>
  );
  return (
    <form action={action} className="mt-4 flex flex-col gap-4">
      <Field label="Nombre del negocio" htmlFor="name">
        <input
          id="name"
          name="name"
          defaultValue={business.name}
          required
          minLength={2}
          maxLength={80}
          className="input"
        />
      </Field>
      <p className="text-muted -mt-2 text-xs">
        Enlace de la fila: /{business.slug} (no se puede cambiar).
      </p>
      <Field label="Dirección" htmlFor="address">
        <input
          id="address"
          name="address"
          defaultValue={business.address ?? ""}
          maxLength={200}
          className="input"
        />
      </Field>
      <Field label="Nombre de la app en el celular del cliente" htmlFor="pwa_name">
        <input
          id="pwa_name"
          name="pwa_name"
          defaultValue={business.pwa_name ?? ""}
          maxLength={40}
          placeholder={business.name}
          className="input"
        />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        {num("chairs_count", "Sillas", 1, 50)}
        {num("default_commission_pct", "Comisión por defecto (%)", 0, 100)}
        {num("grace_minutes", "Minutos de gracia al llamar", 1, 60)}
        {num("inactive_days", "Días para 'recordar' clientes", 1, 365)}
        {num("reminder_cooldown_days", "Días entre recordatorios", 1, 90)}
      </div>
      {state?.error && <ErrorText>{state.error}</ErrorText>}
      {state?.ok && <p className="text-ok text-sm font-medium">Guardado.</p>}
      <button type="submit" className="btn-primary" disabled={pending}>
        {pending ? "Guardando…" : "Guardar"}
      </button>
    </form>
  );
}
