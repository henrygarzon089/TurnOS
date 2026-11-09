"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { CleaningChecklist } from "@/components/cleaning/CleaningChecklist";
import { Segmented } from "@/components/ui/Segmented";
import type { CleaningToday as Today, RecordSummary } from "@/lib/actions/cleaning";
import { formatHour, KIND_LABEL, type CleaningKind } from "@/lib/domain/cleaning";

const KINDS: CleaningKind[] = ["opening", "closing", "deep"];
const TAB: Record<CleaningKind, string> = {
  opening: "Apertura",
  closing: "Cierre",
  deep: "Profunda",
};
const HEADING: Record<CleaningKind, string> = {
  opening: "Limpieza de apertura",
  closing: "Limpieza de cierre",
  deep: "Limpieza profunda",
};
const REGION: Record<CleaningKind, string> = {
  opening: "Apertura de hoy",
  closing: "Cierre de hoy",
  deep: "Limpieza profunda de la semana",
};

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
 * T-171 /app/limpieza como el tablero Barbero-Otros (REQ-078.16, REQ-061.11): Apertura / Cierre /
 * Profunda en pestañas, el título dice cuál, y cada una trae la lista para llenar o quién y a qué
 * hora la hizo. Arranca en la primera que falta.
 */
export function BarberCleaning({
  today,
  businessId,
  initial,
}: {
  today: Extract<Today, { enabled: true }>;
  businessId: string;
  initial?: CleaningKind | null;
}) {
  const router = useRouter();
  const [notice, setNotice] = useState<string | null>(null);
  const records: Record<CleaningKind, RecordSummary | null> = {
    opening: today.opening,
    closing: today.closing,
    deep: today.deep,
  };
  const closingLocked =
    !today.isOwner && today.closingFrom !== null && nowHHMM() < today.closingFrom;
  const firstPending = KINDS.findIndex((k) => !records[k] && !(k === "closing" && closingLocked));
  const start = initial ? KINDS.indexOf(initial) : Math.max(0, firstPending);
  const [active, setActive] = useState(start);

  function panel(kind: CleaningKind) {
    const record = records[kind];
    if (record || (kind === "closing" && closingLocked)) {
      return (
        <section aria-label={REGION[kind]} className="border-line border-y px-4 py-4">
          {record ? (
            <p
              className={
                record.isComplete && !record.isLate ? "text-muted" : "text-warn font-medium"
              }
            >
              {doneLine(record)}
            </p>
          ) : (
            <p className="text-muted">
              El cierre se registra desde las {formatHour(today.closingFrom!)}
            </p>
          )}
        </section>
      );
    }
    return (
      <CleaningChecklist
        fixed
        kind={kind}
        items={today.lists[kind]}
        businessId={businessId}
        businessDay={today.businessDay}
        onDone={(r) => {
          const done = kind === "closing" ? "registrado" : "registrada";
          const incomplete = kind === "closing" ? "incompleto" : "incompleta";
          setNotice(
            `${KIND_LABEL[kind]} ${done}${r.isComplete ? "" : ` como ${incomplete}`}${r.isLate ? " (tarde)" : ""}.`,
          );
          router.refresh();
        }}
      />
    );
  }

  return (
    <main className="-mx-4 flex flex-col gap-3 pt-4">
      <h1 className="px-4 text-2xl font-bold">{HEADING[KINDS[active]]}</h1>
      <Segmented
        label="Limpieza"
        initial={start}
        onChange={(i) => {
          setActive(i);
          setNotice(null);
        }}
        tabs={KINDS.map((k) => ({ name: TAB[k], panel: panel(k) }))}
      />
      {notice && (
        <p role="status" className="text-ok px-4 text-sm font-semibold">
          {notice}
        </p>
      )}
    </main>
  );
}
