"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { PhoneField } from "@/components/ui/PhoneField";
import { Field } from "@/components/ui/Field";
import { applyForJob, type JobFormState } from "@/lib/actions/jobs";
import {
  AVAILABILITY_LABEL,
  JOB_AVAILABILITY,
  JOB_ROLES,
  ROLE_LABEL,
  type JobField,
} from "@/lib/domain/jobs";
import type { PhoneCountry } from "@/lib/domain/phone";
import { JOB_SENT_MESSAGE } from "@/lib/jobs/sent-message";

/**
 * REQ-102.3 / REQ-102.4 formulario de postulación. Lo escrito no se pierde si hay un error (los
 * campos son controlados). El campo `website` está oculto: solo un robot lo llena (REQ-102.5).
 */
export function JobApplicationForm({
  slug,
  privacyVersion,
}: {
  slug: string;
  privacyVersion: number | null;
}) {
  const [state, action, pending] = useActionState<JobFormState, FormData>(applyForJob, {
    status: "idle",
  });
  const [phone, setPhone] = useState("");
  const [country, setCountry] = useState<PhoneCountry>("co");
  const [v, setV] = useState({ name: "", years: "", portfolio: "", message: "" });
  const [role, setRole] = useState("");
  const [availability, setAvailability] = useState("");
  const [privacy, setPrivacy] = useState(false);
  const err = (f: JobField) => (state.status === "error" ? state.errors[f] : undefined);

  if (state.status === "sent") {
    return (
      <div
        role="status"
        data-testid="job-sent"
        className="bg-brand text-brand-ink flex flex-col gap-3 rounded-[2rem] p-8"
      >
        <p className="text-3xl font-bold">¡Listo!</p>
        <p className="text-lg">{JOB_SENT_MESSAGE.replace("¡Listo! ", "")}</p>
      </div>
    );
  }

  return (
    <form action={action} noValidate className="flex flex-col gap-5" aria-label="Postulación">
      <input type="hidden" name="privacyVersion" value={privacyVersion ?? 1} />
      <input type="hidden" name="phone_country" value={country} />
      {/* REQ-102.5 trampa para robots: oculta para personas y lectores de pantalla */}
      <div aria-hidden="true" className="absolute -left-[9999px] size-px overflow-hidden">
        <label>
          Sitio web
          <input type="text" name="website" tabIndex={-1} autoComplete="off" defaultValue="" />
        </label>
      </div>

      <Field
        label="Nombre completo"
        name="name"
        autoComplete="name"
        value={v.name}
        onChange={(e) => setV({ ...v, name: e.target.value })}
        error={err("name")}
        maxLength={80}
        required
      />

      <div className="flex flex-col gap-2">
        <PhoneField
          label="Celular (WhatsApp)"
          name="phone"
          country={country}
          value={phone}
          onChange={setPhone}
          error={err("phone")}
          required
        />
        <button
          type="button"
          className="text-link self-start text-sm font-semibold underline underline-offset-2"
          onClick={() => {
            setCountry(country === "co" ? "other" : "co");
            setPhone("");
          }}
        >
          {country === "co" ? "Mi celular es de otro país" : "Mi celular es de Colombia"}
        </button>
      </div>

      <Choice
        legend="Soy"
        name="role"
        options={JOB_ROLES.map((r) => [r, ROLE_LABEL[r]])}
        value={role}
        onChange={setRole}
        error={err("role")}
      />

      <Field
        label="Años de experiencia"
        name="years"
        inputMode="numeric"
        value={v.years}
        onChange={(e) => setV({ ...v, years: e.target.value.replace(/\D/g, "").slice(0, 2) })}
        error={err("years")}
        required
      />

      <Field
        label="Instagram o enlace con tu trabajo (opcional)"
        name="portfolio"
        placeholder="@tuusuario"
        hint="Ahí miramos tus cortes. Puede ser Instagram, TikTok o cualquier enlace https://."
        value={v.portfolio}
        onChange={(e) => setV({ ...v, portfolio: e.target.value })}
        error={err("portfolio")}
        maxLength={200}
      />

      <Choice
        legend="Disponibilidad"
        name="availability"
        options={JOB_AVAILABILITY.map((a) => [a, AVAILABILITY_LABEL[a]])}
        value={availability}
        onChange={setAvailability}
        error={err("availability")}
      />

      <div className="flex flex-col gap-1.5">
        <label htmlFor="job-message" className="text-ink text-sm font-semibold">
          Cuéntanos de ti (opcional)
        </label>
        <textarea
          id="job-message"
          name="message"
          rows={4}
          maxLength={500}
          value={v.message}
          onChange={(e) => setV({ ...v, message: e.target.value })}
          aria-invalid={Boolean(err("message"))}
          className="border-line-strong bg-card text-ink focus:border-link focus:ring-link/25 w-full rounded-md border px-3 py-2 text-base outline-none focus:border-2 focus:ring-2"
        />
        <p className="text-muted text-sm">{v.message.length} de 500</p>
        {err("message") && <p className="text-danger text-sm">{err("message")}</p>}
      </div>

      <div className="flex flex-col gap-1">
        <label className="flex min-h-12 items-center gap-3 text-sm">
          <input
            type="checkbox"
            name="privacyAccepted"
            checked={privacy}
            onChange={(e) => setPrivacy(e.target.checked)}
            className="accent-brand size-6 shrink-0"
          />
          <span>
            Autorizo el uso de mis datos para esta postulación según el{" "}
            <Link href={`/${slug}/privacidad`} className="underline underline-offset-2" target="_blank">
              aviso de privacidad
            </Link>{" "}
            (Ley 1581)
          </span>
        </label>
        {err("privacy") && <p className="text-danger text-sm">{err("privacy")}</p>}
      </div>

      {state.status === "error" && state.message && (
        <p role="alert" className="text-danger font-semibold">
          {state.message}
        </p>
      )}
      {state.status === "error" && !state.message && (
        <p role="alert" className="text-danger font-semibold">
          Revisa los campos marcados.
        </p>
      )}

      <button type="submit" disabled={pending} className="btn-primary rounded-full">
        {pending ? "Enviando…" : "Enviar postulación"}
      </button>
    </form>
  );
}

function Choice({
  legend,
  name,
  options,
  value,
  onChange,
  error,
}: {
  legend: string;
  name: string;
  options: [string, string][];
  value: string;
  onChange: (v: string) => void;
  error?: string;
}) {
  return (
    <fieldset className="flex flex-col gap-2" aria-invalid={Boolean(error)}>
      <legend className="text-ink mb-1.5 text-sm font-semibold">{legend}</legend>
      <div className="flex flex-wrap gap-2">
        {options.map(([val, label]) => (
          <label
            key={val}
            className={`flex min-h-12 cursor-pointer items-center rounded-full px-5 font-semibold ring-1 ring-inset ${
              value === val ? "bg-brand text-brand-ink ring-brand" : "bg-card text-ink ring-line-strong"
            }`}
          >
            <input
              type="radio"
              name={name}
              value={val}
              checked={value === val}
              onChange={() => onChange(val)}
              className="sr-only"
            />
            {label}
          </label>
        ))}
      </div>
      {error && <p className="text-danger text-sm">{error}</p>}
    </fieldset>
  );
}
