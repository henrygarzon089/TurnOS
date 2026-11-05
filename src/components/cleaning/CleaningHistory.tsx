"use client";

import { useState } from "react";
import {
  getInspectionDetail,
  getRecordDetail,
  type HistoryWeek,
  type InspectionDetail,
  type RecordDetail,
} from "@/lib/actions/cleaning";
import { formatHour, KIND_LABEL, PHOTO_PURGED } from "@/lib/domain/cleaning";
import { formatDayCO } from "@/lib/domain/time";

type Entry = HistoryWeek["entries"][number];
type Detail =
  | { type: "record"; data: RecordDetail & { photoUrls: string[] } }
  | { type: "inspection"; data: InspectionDetail & { photoUrls: Record<string, string> } };

const hour = (iso: string) => formatHour(iso.slice(11, 16));

/* eslint-disable @next/next/no-img-element -- URL firmadas de 1 hora del bucket privado */
function DetailView({ detail, barberNames }: { detail: Detail; barberNames: Record<string, string> }) {
  if (detail.type === "record") {
    const d = detail.data;
    return (
      <div aria-label="Detalle" role="region" className="mt-2 space-y-2 text-sm">
        <ul className="space-y-1">
          {d.items.map((i) => (
            <li key={i.label} className={i.done ? undefined : "text-warn"}>
              {i.done ? "✓" : "✗"} {i.label}
              {i.note && <span className="text-muted"> · {i.note}</span>}
            </li>
          ))}
        </ul>
        {d.photosPurged ? (
          <p className="text-muted">{PHOTO_PURGED}</p>
        ) : (
          d.photoUrls.map((u, n) => <img key={u} src={u} alt={`Foto ${n + 1}`} className="w-full rounded-lg" />)
        )}
      </div>
    );
  }
  const d = detail.data;
  return (
    <div aria-label="Detalle" role="region" className="mt-2 space-y-2 text-sm">
      <ul className="space-y-2">
        {d.items.map((i) => (
          <li key={`${i.group}-${i.label}`} className={i.ok ? undefined : "text-warn"}>
            {i.ok ? "Bien" : "Falla"} · {i.label}
            {!i.ok && <span> · {i.barberId ? (barberNames[i.barberId] ?? "Barbero") : "General"}</span>}
            {i.note && <span className="text-muted"> · {i.note}</span>}
            {i.photoPath &&
              (d.photosPurged || i.photoPurged || !d.photoUrls[i.photoPath] ? (
                <p className="text-muted">{PHOTO_PURGED}</p>
              ) : (
                <img src={d.photoUrls[i.photoPath]} alt={`Foto de ${i.label}`} className="mt-1 w-full rounded-lg" />
              ))}
          </li>
        ))}
      </ul>
    </div>
  );
}
/* eslint-enable @next/next/no-img-element */

function EntryRow({ entry, barberNames }: { entry: Entry; barberNames: Record<string, string> }) {
  const [detail, setDetail] = useState<Detail | null>(null);
  const [error, setError] = useState<string | null>(null);

  const label =
    entry.type === "record"
      ? `${KIND_LABEL[entry.kind]} · ${formatDayCO(entry.businessDay)} · ${entry.doneBy} · ${hour(entry.at)}${
          entry.isComplete ? "" : " · Incompleta"
        }${entry.isLate ? " · Tarde" : ""}`
      : `Revisión · ${formatDayCO(entry.businessDay)} · ${hour(entry.at)} · ${
          entry.failures === 0 ? "todo bien" : `${entry.failures} ${entry.failures === 1 ? "falla" : "fallas"}`
        }`;

  async function toggle() {
    if (detail) return setDetail(null);
    setError(null);
    if (entry.type === "record") {
      const data = await getRecordDetail(entry.id);
      if (data) setDetail({ type: "record", data });
      else setError("No se pudo abrir.");
    } else {
      const data = await getInspectionDetail(entry.id);
      if (data) setDetail({ type: "inspection", data });
      else setError("No se pudo abrir.");
    }
  }

  const flagged = entry.type === "record" ? !entry.isComplete || entry.isLate : entry.failures > 0;
  return (
    <li>
      <button
        type="button"
        aria-expanded={detail !== null}
        className={`min-h-12 w-full text-left text-sm ${flagged ? "text-warn" : ""}`}
        onClick={() => void toggle()}
      >
        {label}
      </button>
      {error && (
        <p role="alert" className="text-danger text-sm">
          {error}
        </p>
      )}
      {detail && <DetailView detail={detail} barberNames={barberNames} />}
    </li>
  );
}

/**
 * REQ-063.5–063.7: por semana y por barbero, solo conteos (sin niveles ni puntajes), y cada
 * registro o revisión se abre con su detalle. Las fotos de más de 90 días ya no se muestran (REQ-064.6).
 */
export function CleaningHistory({ weeks, barberNames }: { weeks: HistoryWeek[]; barberNames: Record<string, string> }) {
  if (weeks.length === 0) return <p className="text-muted mt-3 text-sm">Todavía no hay historial.</p>;
  return (
    <div className="mt-3 space-y-3">
      {weeks.map((w) => (
        <section
          key={w.weekStart}
          aria-label={`Semana del ${formatDayCO(w.weekStart)}`}
          className="border-line bg-card rounded-xl border p-3"
        >
          <h2 className="font-semibold">Semana del {formatDayCO(w.weekStart)}</h2>
          <p className="text-sm">
            <span className={w.deepDone ? "text-ok" : "text-warn"}>
              {w.deepDone ? "Profunda hecha" : "Sin profunda"}
            </span>
            {w.missedClosings > 0 && (
              <span className="text-warn">
                {" "}
                · {w.missedClosings} {w.missedClosings === 1 ? "cierre sin registrar" : "cierres sin registrar"}
              </span>
            )}
            {" · "}
            {w.inspections} {w.inspections === 1 ? "revisión" : "revisiones"}
            {w.generalFailures > 0 && ` · ${w.generalFailures} ${w.generalFailures === 1 ? "falla general" : "fallas generales"}`}
          </p>
          {w.barbers.length > 0 && (
            <table className="mt-2 w-full text-sm">
              <thead>
                <tr className="text-muted text-left">
                  <th className="font-normal">Quién</th>
                  <th className="font-normal">Completos</th>
                  <th className="font-normal">Incompletos</th>
                  <th className="font-normal">Tarde</th>
                  <th className="font-normal">Fallas</th>
                </tr>
              </thead>
              <tbody>
                {w.barbers.map((b) => (
                  <tr key={b.barberId ?? "owner"}>
                    <td>{b.name}</td>
                    <td>{b.complete}</td>
                    <td className={b.incomplete ? "text-warn" : undefined}>{b.incomplete}</td>
                    <td className={b.late ? "text-warn" : undefined}>{b.late}</td>
                    <td className={b.failures ? "text-warn" : undefined}>{b.failures}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {w.entries.length > 0 && (
            <ul className="divide-line mt-2 divide-y">
              {w.entries.map((e) => (
                <EntryRow key={`${e.type}-${e.id}`} entry={e} barberNames={barberNames} />
              ))}
            </ul>
          )}
        </section>
      ))}
    </div>
  );
}
