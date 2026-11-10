import Link from "next/link";
import type { OwnerAlert } from "@/lib/domain/owner-alerts";
import { CountBadge } from "./CountBadge";
import { loadOwnerAlerts } from "./load-owner-alerts";
import { TodayBlockError } from "./TodayBlockError";
import { TodayCard } from "./TodayCard";

/**
 * REQ-076.6 lo que pide acción, en el orden de `buildOwnerAlerts`, cada uno con su enlace. Raya
 * roja = atención ahora (caja, limpieza); ámbar = aviso (inventario, membresías). Sin alertas:
 * "Todo en orden" en escritorio; en el celular el bloque no se dibuja (REQ-078.29, design §22.8) y,
 * si hay, va arriba en rojo suave como el tablero Dueno-Hoy-Movil.
 */
export async function TodayAlerts({
  load = loadOwnerAlerts,
}: { load?: () => Promise<OwnerAlert[] | null> } = {}) {
  let alerts: OwnerAlert[] | null = null;
  try {
    alerts = await load();
  } catch {
    alerts = null;
  }
  return (
    <TodayCard
      title="Piden tu atención"
      data-empty={alerts?.length === 0 || undefined}
      className={alerts?.length === 0 ? "max-lg:hidden" : "max-lg:bg-accent-soft"}
      titleClassName={alerts && alerts.length > 0 ? "max-lg:text-accent" : ""}
      badge={
        alerts && alerts.length > 0 ? <CountBadge count={alerts.length} label="alertas" /> : null
      }
    >
      {!alerts ? (
        <TodayBlockError />
      ) : alerts.length === 0 ? (
        <p className="text-ok px-4 py-4 font-semibold">Todo en orden.</p>
      ) : (
        <ul>
          {alerts.map((a, i) => (
            <li
              key={`${a.kind}-${i}`}
              className="border-line flex min-h-12 items-center gap-3 border-t px-4 py-2 first:border-t-0"
            >
              <span
                aria-hidden="true"
                className={`h-6 w-1 shrink-0 rounded-xs max-lg:hidden ${a.urgent ? "bg-danger" : "bg-warn"}`}
              />
              <p className="min-w-0 flex-1">
                <b>{a.title}</b>
                {a.detail && <span className="text-muted"> {a.detail}</span>}
              </p>
              <Link
                href={a.href}
                className="text-ink inline-flex min-h-12 shrink-0 items-center font-semibold underline underline-offset-4"
              >
                {a.action}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </TodayCard>
  );
}
