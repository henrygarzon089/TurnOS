"use client";

import { useState, useTransition } from "react";
import { Segmented } from "@/components/ui/Segmented";
import { EmptyState } from "@/components/ui/States";
import { deleteJob, setJobStatus } from "@/lib/actions/jobs";
import {
  applicantWhatsappLink,
  AVAILABILITY_LABEL,
  receivedLabel,
  ROLE_LABEL,
  type JobAvailability,
  type JobRole,
  type JobStatus,
} from "@/lib/domain/jobs";
import { formatPhoneCO, isColombianPhone } from "@/lib/domain/phone";

export type JobApplicationRow = {
  id: string;
  full_name: string;
  phone_e164: string;
  role: JobRole;
  years_experience: number;
  portfolio_url: string | null;
  availability: JobAvailability;
  message: string | null;
  status: JobStatus;
  created_at: string;
};

/**
 * REQ-102.6 lista de postulaciones del dueño, de la más nueva a la más vieja, por estado. Cada una
 * con WhatsApp (saludo listo), marcar contactada, descartar y borrar con confirmación.
 */
export function JobApplications({
  rows,
  businessName,
  now = new Date(),
}: {
  rows: JobApplicationRow[];
  businessName: string;
  now?: Date;
}) {
  const groups: { name: string; status: JobStatus }[] = [
    { name: "Nuevas", status: "nueva" },
    { name: "Contactadas", status: "contactada" },
    { name: "Descartadas", status: "descartada" },
  ];
  return (
    <div className="mt-4">
      <Segmented
        label="Estado de las postulaciones"
        tabs={groups.map((g) => {
          const list = rows.filter((r) => r.status === g.status);
          return {
            name: `${g.name} (${list.length})`,
            panel: (
              <ul className="mt-4 grid gap-3 px-4 lg:grid-cols-2">
                {list.length === 0 ? (
                  <li className="lg:col-span-2">
                    <EmptyState
                      icon="users"
                      title={g.status === "nueva" ? "No hay postulaciones nuevas" : `Sin ${g.name.toLowerCase()}`}
                      text="Las postulaciones llegan desde la página Trabaja con nosotros de la web."
                    />
                  </li>
                ) : (
                  list.map((r) => (
                    <JobCard key={r.id} row={r} businessName={businessName} now={now} />
                  ))
                )}
              </ul>
            ),
          };
        })}
      />
    </div>
  );
}

function JobCard({ row: r, businessName, now }: { row: JobApplicationRow; businessName: string; now: Date }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const run = (fn: () => Promise<{ error?: string }>) =>
    start(async () => {
      const res = await fn();
      setError(res.error ?? null);
    });
  const phone = isColombianPhone(r.phone_e164) ? formatPhoneCO(r.phone_e164) : r.phone_e164;

  return (
    <li data-testid="job-application" className="border-line bg-card flex flex-col gap-3 rounded-lg border p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-lg font-bold">{r.full_name}</p>
          <p className="text-muted text-sm">
            {ROLE_LABEL[r.role]} · {r.years_experience} {r.years_experience === 1 ? "año" : "años"} ·{" "}
            {AVAILABILITY_LABEL[r.availability]}
          </p>
        </div>
        <span className="text-muted shrink-0 text-sm">{receivedLabel(r.created_at, now)}</span>
      </div>
      <p className="tabular-nums">{phone}</p>
      {r.portfolio_url && (
        <a
          href={r.portfolio_url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-link truncate font-semibold underline underline-offset-2"
        >
          Ver su trabajo
        </a>
      )}
      {r.message && <p className="text-muted whitespace-pre-line">{r.message}</p>}
      <div className="flex flex-wrap gap-2">
        <a
          href={applicantWhatsappLink(r.phone_e164, r.full_name, businessName)}
          target="_blank"
          rel="noopener noreferrer"
          className="btn-primary sm:w-auto sm:px-5"
        >
          Escribir por WhatsApp
        </a>
        {r.status !== "contactada" && (
          <button
            type="button"
            disabled={pending}
            className="btn-secondary sm:w-auto sm:px-5"
            onClick={() => run(() => setJobStatus(r.id, "contactada"))}
          >
            Marcar contactada
          </button>
        )}
        {r.status !== "descartada" ? (
          <button
            type="button"
            disabled={pending}
            className="btn-secondary sm:w-auto sm:px-5"
            onClick={() => run(() => setJobStatus(r.id, "descartada"))}
          >
            Descartar
          </button>
        ) : (
          <button
            type="button"
            disabled={pending}
            className="btn-secondary sm:w-auto sm:px-5"
            onClick={() => run(() => setJobStatus(r.id, "nueva"))}
          >
            Volver a nuevas
          </button>
        )}
      </div>
      {confirming ? (
        <div role="alertdialog" aria-label="Borrar postulación" className="bg-surface flex flex-col gap-2 rounded-md p-3">
          <p className="font-semibold">¿Borrar los datos de {r.full_name}? No se puede deshacer.</p>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={pending}
              className="btn-danger sm:w-auto sm:px-5"
              onClick={() => run(() => deleteJob(r.id))}
            >
              Sí, borrar
            </button>
            <button type="button" className="btn-secondary sm:w-auto sm:px-5" onClick={() => setConfirming(false)}>
              No
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          className="text-danger min-h-12 self-start text-sm font-semibold underline underline-offset-2"
          onClick={() => setConfirming(true)}
        >
          Borrar datos
        </button>
      )}
      {error && (
        <p role="alert" className="text-danger text-sm font-semibold">
          {error}
        </p>
      )}
    </li>
  );
}
