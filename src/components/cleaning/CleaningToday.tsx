"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { CleaningChecklist } from "@/components/cleaning/CleaningChecklist";
import type { CleaningToday as Today, RecordSummary } from "@/lib/actions/cleaning";
import { formatHour, KIND_LABEL, type CleaningKind } from "@/lib/domain/cleaning";

/** Hora actual de Bogotá "HH:MM", para saber si el cierre ya se puede registrar (REQ-061.7). */
function nowHHMM(): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "America/Bogota",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date());
}

function doneLine(r: RecordSummary): string {
  const flags = [!r.isComplete && "Incompleta", r.isLate && "Tarde"].filter(Boolean).join(" · ");
  return `Hecha por ${r.doneBy} · ${formatHour(r.at.slice(11, 16))}${flags ? ` · ${flags}` : ""}`;
}

/** Foto y puntos marcados de un registro, para las filas del dueño (tablero Dueno-Local). */
export type RecordThumb = { photoUrl: string | null; done: number; total: number };

/**
 * REQ-061.11: Apertura, Cierre y Profunda de la semana. Cada tarjeta dice quién y a qué hora, o
 * trae el botón para llenarla. La comparten el barbero (/app/limpieza) y el dueño (/admin/limpieza).
 */
export function CleaningToday({
  today,
  businessId,
  initialOpen,
  thumbs,
}: {
  today: Extract<Today, { enabled: true }>;
  businessId: string;
  initialOpen?: CleaningKind | null;
  /** Solo el dueño: filas con miniatura de 64 px y acciones como el tablero (design §22.8). */
  thumbs?: Record<string, RecordThumb>;
}) {
  const router = useRouter();
  const [open, setOpen] = useState<CleaningKind | null>(initialOpen ?? null);
  const [notice, setNotice] = useState<string | null>(null);

  const cards: { kind: CleaningKind; title: string; record: RecordSummary | null }[] = [
    { kind: "opening", title: "Apertura de hoy", record: today.opening },
    { kind: "closing", title: "Cierre de hoy", record: today.closing },
    { kind: "deep", title: "Limpieza profunda de la semana", record: today.deep },
  ];
  const closingLocked =
    !today.isOwner && today.closingFrom !== null && nowHHMM() < today.closingFrom;
  // REQ-078.4: solo la primera que falta va rellena; las demás en contorno
  const firstPending = cards.findIndex(
    ({ kind, record }) => !record && !(kind === "closing" && closingLocked),
  );

  if (open) {
    return (
      <CleaningChecklist
        kind={open}
        items={today.lists[open]}
        businessId={businessId}
        businessDay={today.businessDay}
        onCancel={() => setOpen(null)}
        onDone={(r) => {
          setOpen(null);
          const done = open === "closing" ? "registrado" : "registrada";
          const incomplete = open === "closing" ? "incompleto" : "incompleta";
          setNotice(
            `${KIND_LABEL[open]} ${done}${r.isComplete ? "" : ` como ${incomplete}`}${r.isLate ? " (tarde)" : ""}.`,
          );
          router.refresh();
        }}
      />
    );
  }

  if (thumbs) {
    return (
      <div className="border-line bg-card divide-line mt-4 divide-y overflow-hidden rounded-md border">
        {notice && (
          <p role="status" className="text-ok px-4 py-2 text-sm font-semibold">
            {notice}
          </p>
        )}
        {cards.map(({ kind, title, record }, i) => {
          const t = record ? thumbs[record.id] : undefined;
          const fault = record && (!record.isComplete || record.isLate);
          return (
            <section
              key={kind}
              aria-label={title}
              className={`flex flex-wrap items-center gap-3 px-4 py-3 ${fault ? "bg-accent-soft" : ""}`}
            >
              {t?.photoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={t.photoUrl}
                  alt={`Foto de ${title.toLocaleLowerCase("es")}`}
                  width={64}
                  height={64}
                  className="size-16 shrink-0 rounded-sm object-cover"
                />
              ) : (
                <div
                  aria-hidden="true"
                  className={`size-16 shrink-0 rounded-sm ${record ? "bg-skeleton" : "border-line-strong bg-surface border-2 border-dashed"}`}
                />
              )}
              <div className="min-w-0 flex-1">
                <h2 className="flex flex-wrap items-center gap-2 font-bold">
                  {record
                    ? `${record.doneBy} · ${KIND_LABEL[kind].toLocaleLowerCase("es")}`
                    : title}
                  {record && !record.isComplete && (
                    <span className="bg-danger rounded-sm px-1.5 text-sm font-bold text-white">
                      Incompleta
                    </span>
                  )}
                  {record?.isLate && (
                    <span className="bg-warn-soft text-warn rounded-sm px-1.5 text-sm font-bold">
                      Tarde
                    </span>
                  )}
                </h2>
                {record ? (
                  <p className="text-muted text-sm">
                    {doneLine(record)}
                    {t && t.total > 0 && ` · ${t.done} de ${t.total}`}
                  </p>
                ) : (
                  <p className="text-danger text-sm font-semibold">No la han hecho</p>
                )}
              </div>
              <div className="flex gap-2">
                {record ? (
                  <>
                    {t?.photoUrl && (
                      <a
                        href={t.photoUrl}
                        target="_blank"
                        rel="noopener"
                        className="btn-secondary w-auto px-4"
                      >
                        Ver foto
                      </a>
                    )}
                    <Link
                      href="/admin/limpieza?pestana=revision"
                      className="btn-secondary w-auto px-4"
                    >
                      Marcar falla
                    </Link>
                  </>
                ) : (
                  <button
                    type="button"
                    className={`${i === firstPending ? "btn-primary" : "btn-secondary"} w-auto px-4`}
                    onClick={() => setOpen(kind)}
                  >
                    Registrar {KIND_LABEL[kind].toLocaleLowerCase("es")}
                  </button>
                )}
              </div>
            </section>
          );
        })}
        <p className="text-muted px-4 py-3 text-sm">Las fotos se borran solas a los 90 días.</p>
      </div>
    );
  }

  return (
    <div className="mt-3 space-y-3">
      {notice && (
        <p role="status" className="text-ok text-sm font-semibold">
          {notice}
        </p>
      )}
      {cards.map(({ kind, title, record }, i) => (
        <section
          key={kind}
          aria-label={title}
          className="border-line bg-card rounded-md border p-3"
        >
          <h2 className="font-semibold">{title}</h2>
          {record ? (
            <p
              className={`text-sm ${record.isComplete && !record.isLate ? "text-muted" : "text-warn"}`}
            >
              {doneLine(record)}
            </p>
          ) : kind === "closing" && closingLocked ? (
            <p className="text-muted text-sm">
              El cierre se registra desde las {formatHour(today.closingFrom!)}
            </p>
          ) : (
            <button
              type="button"
              className={`${i === firstPending ? "btn-primary" : "btn-secondary"} mt-2 w-full`}
              onClick={() => setOpen(kind)}
            >
              Registrar {KIND_LABEL[kind].toLocaleLowerCase("es")}
            </button>
          )}
        </section>
      ))}
    </div>
  );
}
