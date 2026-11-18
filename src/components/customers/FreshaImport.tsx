"use client";

import Link from "next/link";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import {
  confirmFreshaImport,
  previewFreshaImport,
  type ImportDone,
  type ImportPreview,
  type ImportReason,
} from "@/lib/actions/customer-import";
import { formatDayCO, formatTimeBogota } from "@/lib/domain/time";

/** REQ-100.8 motivo de cada cita que no se importó. */
export const REASON_TEXT: Record<ImportReason, string> = {
  PAST: "La hora ya pasó",
  DAY_CLOSED: "Ese día el negocio está cerrado",
  OUTSIDE_HOURS: "Queda por fuera del horario",
  SLOT_TAKEN: "El barbero ya tiene otra cita a esa hora",
  HAS_BOOKING: "El cliente ya tiene una cita pendiente",
  INVALID: "La cita viene incompleta",
  NO_PHONE: "La cita no trae el celular del cliente",
  UNMAPPED: "Falta emparejar el barbero o el servicio",
};

const FILE_ERROR: Record<string, string> = {
  TOO_BIG: "El archivo pesa más de 2 MB.",
  NOT_READABLE: "No pudimos abrir el archivo. Expórtalo otra vez en CSV o Excel.",
  NO_COLUMNS: "No encontramos las columnas de Fresha. Revisa que sea el archivo correcto.",
};

const ERROR: Record<string, string> = {
  FORBIDDEN: "Solo el dueño puede importar.",
  NO_FILES: "Sube por lo menos un archivo.",
  APPOINTMENTS_DISABLED: "Para importar citas primero enciende Citas.",
  FAILED: "No se pudo importar. Revisa tu conexión e inténtalo otra vez.",
};

const FILE_NAME = { clients: "clientes", appointments: "citas" } as const;

function errorText(r: { error: string; file?: "clients" | "appointments" }): string {
  if (r.file) return `Archivo de ${FILE_NAME[r.file]}: ${FILE_ERROR[r.error] ?? ERROR.FAILED}`;
  return ERROR[r.error] ?? ERROR.FAILED;
}

function when(iso: string): string {
  const d = new Date(iso);
  return `${formatDayCO(iso.slice(0, 10))}, ${formatTimeBogota(d)}`;
}

/**
 * Importar de Fresha (REQ-100.1, 100.2, 100.7, 100.8; design.md §32.2). Paso 1: subir; paso 2:
 * revisar el resumen y emparejar nombres; paso 3: resultado con lo que no se importó.
 */
export function FreshaImport() {
  const [clients, setClients] = useState<File | null>(null);
  const [appointments, setAppointments] = useState<File | null>(null);
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [barberChoice, setBarberChoice] = useState<Record<string, string>>({});
  const [serviceChoice, setServiceChoice] = useState<Record<string, string>>({});
  const [done, setDone] = useState<ImportDone | null>(null);
  const [error, setError] = useState<string | null>(null);

  function form(): FormData {
    const f = new FormData();
    if (clients) f.set("clients", clients);
    if (appointments) f.set("appointments", appointments);
    f.set("barberChoice", JSON.stringify(barberChoice));
    f.set("serviceChoice", JSON.stringify(serviceChoice));
    return f;
  }

  async function review() {
    setError(null);
    const r = await previewFreshaImport(form());
    if (!r.ok) return setError(errorText(r));
    setPreview(r.preview);
  }

  async function run() {
    setError(null);
    const r = await confirmFreshaImport(form());
    if (!r.ok) return setError(errorText(r));
    setDone(r.done);
  }

  function reset() {
    setClients(null);
    setAppointments(null);
    setPreview(null);
    setDone(null);
    setBarberChoice({});
    setServiceChoice({});
  }

  if (done) {
    return (
      <section className="mt-4 space-y-4" aria-labelledby="fresha-done">
        <h2 id="fresha-done" className="text-xl font-bold">
          Importación lista
        </h2>
        <ul className="border-line bg-card divide-line divide-y rounded-md border">
          <Row label="Clientes nuevos" value={done.customersNew} />
          <Row label="Clientes que ya estaban" value={done.customersExisting} />
          <Row label="Citas creadas" value={done.appointmentsCreated} />
          {done.appointmentsAlready > 0 && (
            <Row label="Citas que ya estaban" value={done.appointmentsAlready} />
          )}
        </ul>
        {done.notImported.length > 0 && (
          <div>
            <h3 className="text-lg font-bold">No se importaron ({done.notImported.length})</h3>
            <p className="text-muted text-sm">Créalas a mano en Citas o avísale al cliente.</p>
            <ul className="border-line bg-card divide-line mt-2 divide-y rounded-md border">
              {done.notImported.map((n, i) => (
                <li key={i} className="p-3">
                  <p className="font-semibold">
                    {when(n.startsAt)} · {n.clientName}
                  </p>
                  <p className="text-muted text-sm">
                    {n.serviceName} con {n.barberName}
                  </p>
                  <p className="text-warn text-sm font-semibold">{REASON_TEXT[n.reason]}</p>
                </li>
              ))}
            </ul>
          </div>
        )}
        <p className="text-muted text-sm">
          Los clientes importados aceptan el aviso de privacidad la próxima vez que tomen turno o
          reserven. Hasta entonces no les llegan mensajes.
        </p>
        <div className="flex flex-wrap gap-3">
          <Link href="/app/clientes" className="btn-primary">
            Ver clientes
          </Link>
          <Button variant="secondary" onClick={reset}>
            Importar otro archivo
          </Button>
        </div>
      </section>
    );
  }

  return (
    <div className="mt-4 space-y-5">
      <section className="border-line bg-card rounded-md border p-4" aria-labelledby="fresha-pasos">
        <h2 id="fresha-pasos" className="font-bold">
          Cómo sacar los archivos de Fresha
        </h2>
        <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm">
          <li>Entra a tu cuenta de Fresha, mejor desde un computador.</li>
          <li>
            <strong>Clientes:</strong> abre la lista de clientes y busca la opción de exportar o
            descargar, en CSV o Excel.
          </li>
          <li>
            <strong>Citas:</strong> abre las citas o la agenda, elige desde hoy hasta tu última cita
            reservada y exporta o descarga el archivo.
          </li>
          <li>Sube los dos archivos aquí. Puedes subir solo uno.</li>
        </ol>
      </section>

      <FilePick
        label="Archivo de clientes"
        file={clients}
        onPick={(f) => {
          setClients(f);
          setPreview(null);
        }}
      />
      <FilePick
        label="Archivo de citas"
        file={appointments}
        onPick={(f) => {
          setAppointments(f);
          setPreview(null);
        }}
      />

      {error && (
        <p role="alert" className="text-danger font-semibold">
          {error}
        </p>
      )}

      {!preview && (
        <Button onAction={review} disabled={!clients && !appointments} pendingText="Revisando…">
          Revisar
        </Button>
      )}

      {preview && (
        <section className="space-y-4" aria-labelledby="fresha-resumen">
          <h2 id="fresha-resumen" className="text-xl font-bold">
            Resumen antes de importar
          </h2>
          <p className="text-muted text-sm">Todavía no se ha guardado nada.</p>
          {preview.clients && (
            <ul
              className="border-line bg-card divide-line divide-y rounded-md border"
              aria-label="Clientes"
            >
              <Row label="Clientes nuevos" value={preview.clients.new} />
              <Row
                label="Ya estaban (mismo celular, no se modifican)"
                value={preview.clients.existing}
              />
              <Row
                label="Sin celular (no se importan)"
                value={preview.clients.skipped.NO_PHONE}
                skip
              />
              <Row
                label="Celular que no es colombiano (no se importan)"
                value={preview.clients.skipped.FOREIGN_PHONE}
                skip
              />
              <Row
                label="Sin nombre (no se importan)"
                value={preview.clients.skipped.NO_NAME}
                skip
              />
            </ul>
          )}
          {preview.appointments && (
            <ul
              className="border-line bg-card divide-line divide-y rounded-md border"
              aria-label="Citas"
            >
              <Row label="Citas de hoy en adelante" value={preview.appointments.importable} />
              <Row label="Listas para crear" value={preview.appointments.ready} />
              <Row
                label="Esperan que emparejes el barbero o el servicio"
                value={preview.appointments.unmatched}
                skip
              />
              <Row
                label="Sin celular del cliente (no se importan)"
                value={preview.appointments.noPhone}
                skip
              />
              <Row
                label="Citas de días pasados (no se importan)"
                value={preview.appointments.skipped.PAST}
                skip
              />
              <Row
                label="Canceladas o ya atendidas (no se importan)"
                value={preview.appointments.skipped.NOT_BOOKED}
                skip
              />
              <Row
                label="Con fecha que no se entiende (no se importan)"
                value={preview.appointments.skipped.BAD_DATE}
                skip
              />
            </ul>
          )}
          {preview.appointments && (
            <p className="text-muted text-sm">
              Si una cita choca con otra o cae en un día cerrado, te avisamos al importar.
            </p>
          )}

          {(preview.unmatchedBarbers.length > 0 || preview.unmatchedServices.length > 0) && (
            <div className="space-y-3">
              <h3 className="font-bold">Nombres que no están en la app</h3>
              <p className="text-muted text-sm">
                Escoge a qué equivale cada uno. Las citas sin pareja no se importan.
              </p>
              {preview.unmatchedBarbers.map((name) => (
                <Pair
                  key={`b-${name}`}
                  label={`Barbero "${name}"`}
                  options={preview.barbers}
                  value={barberChoice[name] ?? ""}
                  onChange={(v) => setBarberChoice({ ...barberChoice, [name]: v })}
                />
              ))}
              {preview.unmatchedServices.map((name) => (
                <Pair
                  key={`s-${name}`}
                  label={`Servicio "${name}"`}
                  options={preview.services}
                  value={serviceChoice[name] ?? ""}
                  onChange={(v) => setServiceChoice({ ...serviceChoice, [name]: v })}
                />
              ))}
            </div>
          )}

          <Button onAction={run} pendingText="Importando…">
            Importar
          </Button>
        </section>
      )}
    </div>
  );
}

function Row({ label, value, skip = false }: { label: string; value: number; skip?: boolean }) {
  if (skip && value === 0) return null;
  return (
    <li className="flex items-center justify-between gap-3 p-3">
      <span className={skip ? "text-muted" : ""}>{label}</span>
      <span className="text-lg font-bold tabular-nums">{value}</span>
    </li>
  );
}

function FilePick({
  label,
  file,
  onPick,
}: {
  label: string;
  file: File | null;
  onPick: (f: File | null) => void;
}) {
  return (
    <label className="block">
      <span className="font-semibold">{label}</span>
      <input
        type="file"
        accept=".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        className="border-line bg-card mt-1 block min-h-12 w-full rounded-md border p-2 text-base"
        onChange={(e) => onPick(e.target.files?.[0] ?? null)}
      />
      {file && <span className="text-muted mt-1 block text-sm">{file.name}</span>}
    </label>
  );
}

function Pair({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: { id: string; name: string }[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <label className="block">
      <span className="font-semibold">{label}</span>
      <select className="input mt-1" value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">Ninguno: no importar esas citas</option>
        {options.map((o) => (
          <option key={o.id} value={o.id}>
            {o.name}
          </option>
        ))}
      </select>
    </label>
  );
}
