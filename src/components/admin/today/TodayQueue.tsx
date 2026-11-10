import { getPublicBusiness } from "@/lib/actions/public";
import {
  buildTodayQueue,
  type TodayBarberState,
  type TodayQueue as Data,
} from "@/lib/domain/today";
import { loadOwnerQueue } from "./load-owner-queue";
import { TodayBlockError } from "./TodayBlockError";
import { TodayCard } from "./TodayCard";

/** Fila del dueño + estimado de la portada (el mismo número que ve el cliente, REQ-017.3). */
async function loadTodayQueue(): Promise<Data | null> {
  const view = await loadOwnerQueue();
  if (!view) return null;
  const pub = await getPublicBusiness(view.business.slug);
  return buildTodayQueue(
    {
      waitingCount: view.active.filter((t) => t.status === "waiting").length,
      estimatedWaitMin: pub?.estimatedWaitMin ?? null,
      barbers: view.barbers,
      active: view.active,
    },
    new Date(),
  );
}

const DOT: Record<TodayBarberState, string> = {
  serving: "bg-ink",
  called: "bg-called",
  paused: "bg-warn",
  free: "bg-ok",
  off: "bg-line-strong",
};
const TEXT: Record<TodayBarberState, string> = {
  serving: "text-ink font-semibold",
  called: "text-accent font-semibold",
  paused: "text-warn font-semibold",
  free: "text-ok font-semibold",
  off: "text-muted",
};
const TH = "text-muted px-4 py-2 text-xs font-bold tracking-wider uppercase";

/**
 * REQ-076.2, REQ-078.28, REQ-078.29 fila en vivo como el tablero Dueno-Hoy. Escritorio: cuántos
 * esperan y el estimado junto al título, y la tabla Barbero · Ahora · Desde · En su fila (sin
 * "Silla": la app no tiene sillas, ADR-053). Celular y tablet: el número grande y una fila por
 * barbero con su turno o estado, los minutos y "N en fila". El estimado es el de la portada (el
 * que ve quien toma turno ahora), no un promedio.
 */
export async function TodayQueue({
  load = loadTodayQueue,
}: { load?: () => Promise<Data | null> } = {}) {
  let data: Data | null = null;
  try {
    data = await load();
  } catch {
    data = null;
  }
  const wait =
    data && data.waiting > 0 && data.nextWaitMin !== null ? `~ ${data.nextWaitMin} min` : null;
  return (
    <TodayCard
      title="Fila en vivo"
      link={{ href: "/admin/fila", label: "Abrir la fila" }}
      aside={
        data && (
          <p className="text-muted hidden text-center lg:block">
            <b className="text-ink text-xl tabular-nums">{data.waiting}</b> esperando
            {wait && (
              <>
                {" · "}
                <b className="text-ink">{wait}</b> de espera
              </>
            )}
          </p>
        )
      }
    >
      {!data ? (
        <TodayBlockError />
      ) : (
        <>
          <p className="flex items-baseline gap-3 px-4 pt-2 pb-2 lg:hidden">
            <span data-testid="today-waiting" className="text-5xl font-bold tabular-nums">
              {data.waiting}
            </span>
            <span className="text-muted">esperando{wait && ` · ${wait}`}</span>
          </p>
          <table className="hidden w-full lg:table">
            <thead className="bg-surface border-line border-b text-left">
              <tr>
                <th className={TH}>Barbero</th>
                <th className={TH}>Ahora</th>
                <th className={`${TH} text-right`}>Desde</th>
                <th className={`${TH} text-right`}>En su fila</th>
              </tr>
            </thead>
            <tbody>
              {data.barbers.map((b) => (
                <tr
                  key={b.id}
                  className={`border-line h-13 border-t first:border-t-0 ${b.state === "called" ? "bg-accent-soft" : ""}`}
                >
                  <td className="px-4 font-bold">{b.name}</td>
                  <td className={`px-4 ${TEXT[b.state]}`}>
                    <span className="flex items-center gap-2">
                      <span aria-hidden="true" className={`size-2 shrink-0 ${DOT[b.state]}`} />
                      {b.now}
                    </span>
                  </td>
                  <td className="px-4 text-right tabular-nums">
                    {b.sinceMin === null ? (
                      <span className="text-muted">—</span>
                    ) : (
                      `${b.sinceMin} min`
                    )}
                  </td>
                  <td className="px-4 text-right tabular-nums">{b.inLine}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <ul aria-label="Barberos" className="lg:hidden">
            {data.barbers.map((b) => (
              <li
                key={b.id}
                className={`border-line flex min-h-13 items-center gap-3 border-t px-4 py-2 ${
                  b.state === "called" ? "bg-accent-soft" : ""
                }`}
              >
                <span aria-hidden="true" className={`size-2 shrink-0 ${DOT[b.state]}`} />
                <b className="w-20 shrink-0 truncate">{b.name}</b>
                <span className={`min-w-0 flex-1 truncate ${TEXT[b.state]}`}>{b.short}</span>
                <span className="text-muted shrink-0 text-sm tabular-nums">
                  {b.inLine > 0 ? `${b.inLine} en fila` : "0"}
                </span>
              </li>
            ))}
          </ul>
          {data.barbers.length === 0 && (
            <p className="text-muted px-4 py-4">Todavía no hay barberos activos.</p>
          )}
        </>
      )}
    </TodayCard>
  );
}
