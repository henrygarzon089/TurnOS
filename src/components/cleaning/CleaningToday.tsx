"use client";

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

/**
 * REQ-061.11: Apertura, Cierre y Profunda de la semana. Cada tarjeta dice quién y a qué hora, o
 * trae el botón para llenarla. La comparten el barbero (/app/limpieza) y el dueño (/admin/limpieza).
 */
export function CleaningToday({
  today,
  businessId,
  initialOpen,
}: {
  today: Extract<Today, { enabled: true }>;
  businessId: string;
  initialOpen?: CleaningKind | null;
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
