import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PublicHeader } from "@/components/public/PublicHeader";
import { LiveRefresh } from "@/components/queue/LiveRefresh";
import { getPublicBusiness } from "@/lib/actions/public";
import { getAppointmentInfo } from "@/lib/actions/public-appointments";
import { formatCOP } from "@/lib/domain/money";
import { hhmmTo12h, publicBarberLines, type PublicBarberLine } from "@/lib/domain/public-view";
import { formatMinutes } from "@/lib/domain/time";
import { mediaUrl } from "@/lib/media/paths";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const b = await getPublicBusiness(slug);
  return { title: b ? `${b.name} · Fila` : "Negocio no encontrado" };
}

/**
 * REQ-001.1 / REQ-001.4 / REQ-001.5: portada pública de la fila, con el sistema visual de T-162
 * (tablero Cliente-Negocio y Cliente-Escritorio). En el celular una columna con la barra de
 * "Tomar turno" fija abajo; desde 1024 px, la fila en vivo a la izquierda y los servicios con
 * "Tomar turno" a la derecha. El formulario sigue en `/turno` (Hito 16 no cambia flujos).
 */
export default async function PublicBusinessPage({ params }: Props) {
  const { slug } = await params;
  const b = await getPublicBusiness(slug);
  if (!b) notFound();
  // REQ-050.1: "Reservar cita" solo con las citas encendidas y alguien que las reciba
  const appts = await getAppointmentInfo(slug);
  const canBook = Boolean(appts?.enabled && appts.barbers.length > 0 && appts.openDays.length > 0);
  const lines = publicBarberLines(b, new Date());

  const state = b.isOpen ? (
    <span className="text-ok font-medium">
      Abierto{b.closesAt ? ` hasta ${hhmmTo12h(b.closesAt)}` : ""}
    </span>
  ) : (
    <span className="text-danger font-medium">
      Cerrado{b.nextOpening ? ` · ${b.nextOpening.toLowerCase()}` : ""}
    </span>
  );

  return (
    <div className="flex flex-1 flex-col">
      <LiveRefresh businessId={b.id} />
      <PublicHeader
        name={b.name}
        subtitle={state}
        aside={
          canBook && (
            <Link
              href={`/${b.slug}/cita`}
              className="hidden min-h-12 items-center font-semibold underline underline-offset-4 lg:inline-flex"
            >
              Reservar una cita
            </Link>
          )
        }
      />
      <main className="mx-auto grid w-full max-w-md flex-1 grid-cols-[minmax(0,1fr)] gap-4 px-4 pt-4 pb-44 lg:max-w-5xl lg:grid-cols-[minmax(0,1fr)_400px] lg:items-start lg:gap-10 lg:pt-8 lg:pb-10">
        <div className="flex flex-col gap-4">
          {b.address && <p className="text-muted text-sm">{b.address}</p>}
          <LiveBlock
            waiting={b.waitingCount}
            isOpen={b.isOpen}
            estimate={b.estimatedWaitMin}
            lines={lines}
          />
          <p className="text-muted hidden text-sm lg:block">
            Tomas el turno aquí y te vas a tu casa. La lista se actualiza sola.
          </p>
        </div>

        <div className="lg:border-line lg:bg-card flex flex-col gap-4 lg:rounded-lg lg:border lg:p-6">
          <h2 className="hidden text-xl font-bold lg:block">Tomar turno</h2>
          <section aria-labelledby="servicios">
            <h2 id="servicios" className="text-muted text-sm font-semibold">
              Servicios
            </h2>
            <ul className="divide-line border-line bg-card mt-2 divide-y rounded-md border lg:border-0 lg:bg-transparent">
              {b.services.map((s) => (
                <li key={s.id} className="flex min-h-12 items-center justify-between gap-3 px-3">
                  <span className="min-w-0 break-words">
                    <b className="font-semibold">{s.name}</b>{" "}
                    <span className="text-muted text-sm">· {s.durationMin} min</span>
                  </span>
                  <span className="shrink-0 font-semibold tabular-nums">{formatCOP(s.price)}</span>
                </li>
              ))}
            </ul>
          </section>

          {b.products.length > 0 && (
            <section aria-labelledby="lo-que-vendemos">
              <h2 id="lo-que-vendemos" className="text-muted text-sm font-semibold">
                Lo que vendemos
              </h2>
              <ul className="divide-line border-line bg-card mt-2 divide-y rounded-md border lg:border-0 lg:bg-transparent">
                {b.products.map((p) => (
                  <li key={p.id} className="flex min-h-14 items-center gap-3 px-3 py-1">
                    {p.photoPath && (
                      <Image
                        src={mediaUrl(p.photoPath)}
                        alt={p.name}
                        width={48}
                        height={48}
                        unoptimized
                        className="size-12 shrink-0 rounded-sm object-cover"
                      />
                    )}
                    <span className="min-w-0 flex-1 break-words">{p.name}</span>
                    <span className="shrink-0 font-semibold tabular-nums">
                      {formatCOP(p.price)}
                    </span>
                  </li>
                ))}
              </ul>
              <p className="text-muted mt-1 text-sm">Se compran en el local.</p>
            </section>
          )}

          {/* Celular: barra fija abajo. Escritorio: al final de la tarjeta. */}
          <div className="border-line bg-card fixed inset-x-0 bottom-0 z-10 border-t px-4 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] lg:static lg:border-0 lg:bg-transparent lg:p-0">
            <div className="mx-auto max-w-md lg:max-w-none">
              {b.isOpen ? (
                <Link href={`/${b.slug}/turno`} className="btn-primary">
                  Tomar turno
                </Link>
              ) : (
                <p className="text-muted flex min-h-12 items-center justify-center text-center text-sm">
                  {b.nextOpening
                    ? `Abrimos: ${b.nextOpening.toLowerCase()}.`
                    : "La fila está cerrada por hoy."}
                </p>
              )}
              {canBook && (
                <Link
                  href={`/${b.slug}/cita`}
                  className="mt-1 flex min-h-12 items-center justify-center font-semibold underline underline-offset-4 lg:hidden"
                >
                  Reservar cita
                </Link>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

/**
 * Bloque "en vivo" (REQ-001.4): cuántos esperan, el estimado y una línea por barbero, sin
 * celulares (REQ-013.2). Alto reservado: una línea de 32 px por barbero (CLS, REQ-078.8).
 */
function LiveBlock({
  waiting,
  isOpen,
  estimate,
  lines,
}: {
  waiting: number;
  isOpen: boolean;
  estimate: number | null;
  lines: PublicBarberLine[];
}) {
  return (
    <section
      aria-label="Fila en vivo"
      aria-live="polite"
      className="border-line bg-card rounded-md border p-4 lg:border-0 lg:bg-transparent lg:p-0"
    >
      <div className="flex items-baseline gap-2">
        <span aria-hidden="true" className="bg-called size-2.5 shrink-0 self-center rounded-full" />
        <span className="text-3xl font-bold tabular-nums lg:text-6xl">{waiting}</span>
        <span className="font-semibold lg:text-xl">
          {waiting === 1 ? "persona en la fila" : "personas en la fila"}
        </span>
        <span className="text-muted ml-auto text-sm">en vivo</span>
      </div>
      {isOpen && (
        <p className="mt-1 font-semibold">
          {estimate === null
            ? "Sin barberos atendiendo ahora"
            : estimate === 0
              ? "Te atenderían de una vez"
              : `${formatMinutes(estimate)} de espera`}
        </p>
      )}
      {lines.length > 0 && (
        <ul className="divide-line mt-3 divide-y lg:mt-6">
          {lines.map((l) => (
            <li
              key={l.id}
              className="flex min-h-8 items-center justify-between gap-3 py-1 lg:min-h-12"
            >
              <span className="min-w-0 truncate lg:font-semibold">{l.name}</span>
              <span className="shrink-0 text-sm tabular-nums lg:text-base">
                {l.state === "paused" ? (
                  <span className="text-warn font-semibold">En pausa</span>
                ) : l.state === "free" ? (
                  <span className="text-ok font-semibold">Libre</span>
                ) : (
                  <>
                    {l.waiting > 0 && `${l.waiting} en fila · `}
                    {l.waitMin !== null && (
                      <span className="text-muted">{formatMinutes(l.waitMin)}</span>
                    )}
                  </>
                )}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
