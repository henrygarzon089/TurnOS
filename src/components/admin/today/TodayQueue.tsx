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
  serving: "text-ink",
  called: "text-accent font-semibold",
  paused: "text-warn font-semibold",
  free: "text-ok font-semibold",
  off: "text-muted",
};

/** REQ-076.2 fila en vivo: cuántos esperan, el estimado y el estado de cada barbero. */
export async function TodayQueue({
  load = loadTodayQueue,
}: { load?: () => Promise<Data | null> } = {}) {
  let data: Data | null = null;
  try {
    data = await load();
  } catch {
    data = null;
  }
  return (
    <TodayCard title="Fila en vivo" link={{ href: "/admin/fila", label: "Abrir la fila" }}>
      {!data ? (
        <TodayBlockError />
      ) : (
        <>
          <p className="flex items-baseline gap-2 px-4 pt-3 pb-2">
            <span data-testid="today-waiting" className="text-4xl font-bold tabular-nums">
              {data.waiting}
            </span>
            <span className="text-muted">
              esperando
              {data.waiting > 0 && data.nextWaitMin !== null
                ? ` · el próximo, ~ ${data.nextWaitMin} min`
                : ""}
            </span>
          </p>
          <ul aria-label="Barberos">
            {data.barbers.map((b) => (
              <li
                key={b.id}
                className={`border-line flex min-h-13 items-center gap-3 border-t px-4 py-2 ${
                  b.state === "called" ? "bg-accent-soft" : ""
                }`}
              >
                <span aria-hidden="true" className={`size-2 shrink-0 ${DOT[b.state]}`} />
                <b className="w-20 shrink-0 truncate">{b.name}</b>
                <span className={`min-w-0 ${TEXT[b.state]}`}>{b.text}</span>
              </li>
            ))}
          </ul>
          {data.barbers.length === 0 && (
            <p className="text-muted px-4 pb-4">Todavía no hay barberos activos.</p>
          )}
        </>
      )}
    </TodayCard>
  );
}
