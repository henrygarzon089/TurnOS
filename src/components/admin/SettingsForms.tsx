"use client";

import { useActionState, useMemo, useState } from "react";
import { ErrorText, Field } from "@/components/auth/LoginForm";
import { keepValuesOnSubmit } from "@/components/ui/form";
import {
  saveGoogleReviewUrl,
  saveTemplates,
  saveWhatsAppSettings,
  updateBusiness,
  type FormState,
} from "@/lib/actions/admin";
import { formatPhoneCO } from "@/lib/domain/phone";
import { renderTemplate } from "@/lib/notifications/render";

export type TemplateKey =
  | "notify_2_turns"
  | "reminder_inactive"
  | "share_queue"
  | "birthday"
  | "membership_renewal"
  | "gift_card"
  | "appointment_confirm"
  | "appointment_reminder"
  | "appointment_cancelled";

const APPOINTMENT_VARS = "{nombre} {negocio} {fecha} {hora} {enlace}";

const TEMPLATE_META: Record<TemplateKey, { title: string; help: string; vars?: string }> = {
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
  birthday: {
    title: "Cumpleaños",
    help: "Saludo para los clientes de la lista “Cumplen esta semana”.",
    vars: "{nombre} {negocio}",
  },
  membership_renewal: {
    title: "Membresía por vencer",
    help: "Para recordarle al titular que renueve, desde “Vencen esta semana” en Membresías.",
    vars: "{nombre} {negocio} {fecha}",
  },
  gift_card: {
    title: "Tarjeta de regalo",
    help: "Para enviarle la tarjeta a quien la compró, desde Tarjetas de regalo.",
    vars: "{nombre} {negocio} {valor} {enlace} {fecha}",
  },
  // REQ-054.5: los botones de WhatsApp de "Citas"
  appointment_confirm: {
    title: "Confirmar cita",
    help: "Al crear una cita desde “Citas”, para mandarle al cliente su enlace.",
    vars: APPOINTMENT_VARS,
  },
  appointment_reminder: {
    title: "Recordar cita",
    help: "Desde “Citas de mañana”, el día antes de la cita.",
    vars: APPOINTMENT_VARS,
  },
  appointment_cancelled: {
    title: "Cita cancelada",
    help: "Cuando el negocio cancela una cita, para avisarle al cliente.",
    vars: APPOINTMENT_VARS,
  },
};

const SAMPLE = {
  nombre: "Camilo",
  negocio: "Barbería La 33",
  tiempo: "≈ 25 min",
  enlace: "https://turnos.app/t/abc123",
  fecha: "8 de noviembre",
  hora: "10:30 a. m.",
  valor: "$ 50.000",
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
    <form
      action={action}
      onSubmit={keepValuesOnSubmit(action)}
      className="mt-4 flex flex-col gap-4"
    >
      {/* Tarjetas lado a lado desde 1024 px (tablero Dueno-Config, design §22.8) */}
      <div data-two-up className="grid items-start gap-4 lg:grid-cols-2">
        {(Object.keys(TEMPLATE_META) as TemplateKey[]).map((key) => (
          <div key={key} className="border-line bg-card flex flex-col gap-2 rounded-md border p-4">
            <label htmlFor={key} className="font-semibold">
              {TEMPLATE_META[key].title}
            </label>
            <p className="text-muted text-sm">{TEMPLATE_META[key].help}</p>
            <textarea
              id={key}
              name={key}
              rows={3}
              maxLength={1000}
              required
              value={values[key] ?? ""}
              onChange={(e) => setValues({ ...values, [key]: e.target.value })}
              className="input min-h-24 py-2"
            />
            <p className="text-muted text-sm">
              Variables: {TEMPLATE_META[key].vars ?? "{nombre} {negocio} {tiempo} {enlace}"}
            </p>
            <div
              className="bg-surface border-line rounded-sm border p-2 text-base"
              aria-label="Vista previa"
            >
              {renderTemplate(values[key], sample)}
            </div>
          </div>
        ))}
      </div>
      {state?.error && <ErrorText>{state.error}</ErrorText>}
      {state?.ok && <p className="text-ok text-sm font-medium">Plantillas guardadas.</p>}
      <button
        type="submit"
        className="btn-primary lg:w-auto lg:self-end lg:px-8"
        disabled={pending}
      >
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
  product_commission_pct: number;
  staff_discount_pct: number;
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
    <form
      action={action}
      onSubmit={keepValuesOnSubmit(action)}
      aria-label="Datos del negocio"
      className="border-line bg-card flex flex-col gap-4 rounded-md border p-4"
    >
      <h2 className="text-lg font-bold">Negocio</h2>
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
      <p className="text-muted -mt-2 text-sm">
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
      {/* REQ-078.36: items-end alinea los campos aunque una etiqueta ocupe dos líneas */}
      <div
        data-testid="business-numbers"
        className="grid grid-cols-2 items-end gap-3 lg:grid-cols-3"
      >
        {num("chairs_count", "Sillas", 1, 50)}
        {num("default_commission_pct", "Comisión por defecto (%)", 0, 100)}
        {num("grace_minutes", "Minutos de gracia al llamar", 1, 60)}
        {num("inactive_days", "Días para 'recordar' clientes", 1, 365)}
        {num("reminder_cooldown_days", "Días entre recordatorios", 1, 90)}
        {num("product_commission_pct", "Comisión por productos (%)", 0, 100)}
        {num("staff_discount_pct", "Descuento de empleado (%)", 0, 100)}
      </div>
      <p className="text-muted -mt-2 text-sm">
        Los % de productos y de descuento se aplican a las ventas desde hoy. Con descuento en 0 no
        sale &quot;Compra de un barbero&quot;.
      </p>
      {state?.error && <ErrorText>{state.error}</ErrorText>}
      {state?.ok && <p className="text-ok text-sm font-medium">Guardado.</p>}
      <button type="submit" className="btn-primary" disabled={pending}>
        {pending ? "Guardando…" : "Guardar"}
      </button>
    </form>
  );
}

/** REQ-036.1 */
export function GoogleReviewForm({ url }: { url: string | null }) {
  const [state, action, pending] = useActionState<FormState, FormData>(
    saveGoogleReviewUrl,
    undefined,
  );
  return (
    <form
      action={action}
      onSubmit={keepValuesOnSubmit(action)}
      aria-label="Reseñas de Google"
      className="border-line bg-card flex flex-col gap-4 rounded-md border p-4"
    >
      <h2 className="text-lg font-bold">Reseñas de Google</h2>
      <Field label="Enlace de reseñas de Google" htmlFor="google_review_url">
        <input
          id="google_review_url"
          name="google_review_url"
          inputMode="url"
          autoCapitalize="none"
          autoCorrect="off"
          defaultValue={url ?? ""}
          placeholder="https://g.page/r/…"
          className="input"
        />
      </Field>
      <p className="text-muted -mt-2 text-sm">
        El cliente lo ve en &quot;Mi turno&quot; al terminar. Déjalo vacío para no pedir reseñas.
      </p>
      {state?.error && <ErrorText>{state.error}</ErrorText>}
      {state?.ok && <p className="text-ok text-sm font-medium">Enlace guardado.</p>}
      <button type="submit" className="btn-secondary" disabled={pending}>
        {pending ? "Guardando…" : "Guardar enlace"}
      </button>
    </form>
  );
}

/** REQ-043.3 interruptor del aviso automático. REQ-042.4 número de la respuesta automática. */
export function WhatsAppForm({
  enabled,
  contactPhone,
}: {
  enabled: boolean;
  contactPhone: string | null;
}) {
  const [state, action, pending] = useActionState<FormState, FormData>(
    saveWhatsAppSettings,
    undefined,
  );
  // Controlados: React limpia el formulario al enviar y un error apagaría el interruptor
  const [on, setOn] = useState(enabled);
  const [phone, setPhone] = useState(contactPhone ? formatPhoneCO(contactPhone) : "");
  return (
    <form
      action={action}
      onSubmit={keepValuesOnSubmit(action)}
      aria-label="Avisos por WhatsApp"
      className="border-line bg-card flex flex-col gap-4 rounded-md border p-4"
    >
      <h2 className="text-lg font-bold">Avisos por WhatsApp</h2>
      <label className="flex min-h-12 items-center gap-3 font-medium">
        <input
          type="checkbox"
          name="whatsapp_auto_enabled"
          checked={on}
          onChange={(e) => setOn(e.target.checked)}
          className="accent-brand h-6 w-6 shrink-0"
        />
        Avisos automáticos activos
      </label>
      <p className="text-muted -mt-2 text-sm">
        Le avisa por WhatsApp al cliente que dio permiso cuando faltan 2 turnos y cuando lo llaman.
      </p>
      <Field label="Número de contacto" htmlFor="whatsapp_contact_phone">
        <input
          id="whatsapp_contact_phone"
          name="whatsapp_contact_phone"
          type="tel"
          inputMode="numeric"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="300 123 4567"
          className="input"
        />
      </Field>
      <p className="text-muted -mt-2 text-sm">
        Se lo damos a quien responda a los avisos. Déjalo vacío si no quieres darlo.
      </p>
      {state?.error && <ErrorText>{state.error}</ErrorText>}
      {state?.ok && <p className="text-ok text-sm font-medium">Avisos guardados.</p>}
      <button type="submit" className="btn-secondary" disabled={pending}>
        {pending ? "Guardando…" : "Guardar avisos"}
      </button>
    </form>
  );
}
