"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { createContext, useCallback, useContext, useState } from "react";
import { ConnectionBanner } from "@/components/ui/ConnectionBanner";
import { capLines, deskLine, liveLineText, type PublicBarberLine } from "@/lib/domain/public-view";
import { formatTimeBogota } from "@/lib/domain/time";
import { useQueueSubscription } from "@/lib/realtime/use-queue-subscription";

/**
 * Portada del cliente (T-173, ADR-052, tableros Cliente-Negocio y Cliente-Escritorio): la fila en
 * vivo y el formulario en una sola pantalla. Aquí van las piezas que comparten el estado de la
 * conexión (franja de arriba y bloque en vivo) y la barra fija de "Tomar turno".
 */

type LiveStatus = { online: boolean; lastSeen: Date | null };
const LiveStatusContext = createContext<LiveStatus>({ online: true, lastSeen: null });

/**
 * Se suscribe a la fila (ADR-008) y relee la página al cambiar. La franja y el bloque en vivo leen
 * de aquí si hay señal y desde qué hora es lo que se ve (REQ-078.10).
 */
export function LiveStatusProvider({
  businessId,
  children,
}: {
  businessId: string;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const reload = useCallback(() => router.refresh(), [router]);
  const { online, lastUpdated } = useQueueSubscription(businessId, reload);
  const [openedAt] = useState(() => new Date());
  return (
    <LiveStatusContext value={{ online, lastSeen: lastUpdated ?? openedAt }}>
      {children}
    </LiveStatusContext>
  );
}

/** "Sin conexión. Mostrando lo último que vimos · 3:40 p. m." encima del encabezado. */
export function LiveBanner() {
  const { online, lastSeen } = useContext(LiveStatusContext);
  return <ConnectionBanner online={online} lastSeen={lastSeen} />;
}

/**
 * Bloque en vivo (REQ-078.21, REQ-001.4). Celular: tarjeta de 124 px reservados con "N esperando",
 * "en vivo" y una línea por barbero (máx. 5). Escritorio: "N personas esperando ahora" en grande y
 * la tabla Barbero, Estado, En fila, Espera aprox. Sin red, el punto gris y "a las <hora>".
 * Nunca celulares (REQ-013.2).
 */
export function LiveBlock({
  waiting,
  lines,
  whatsapp,
}: {
  waiting: number;
  lines: PublicBarberLine[];
  /** Aviso por WhatsApp encendido: la frase de escritorio lo promete. */
  whatsapp: boolean;
}) {
  const { online, lastSeen } = useContext(LiveStatusContext);
  const { shown, more } = capLines(lines);
  const dot = online ? "bg-called" : "bg-muted";
  return (
    <section aria-label="Fila en vivo" aria-live="polite">
      {/* Celular */}
      <div className="border-line bg-card min-h-31 rounded-md border px-4 py-3 lg:hidden">
        {/* Con zoom 200 % o una fuente ancha, "en vivo" baja de línea en vez de salirse */}
        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
          <span aria-hidden="true" className={`${dot} size-2 shrink-0 rounded-full`} />
          <span className="text-xl leading-none font-bold tabular-nums">{waiting}</span>
          <span className="font-semibold">esperando</span>
          <span className="text-muted ml-auto text-sm">
            {online ? "en vivo" : lastSeen ? `a las ${formatTimeBogota(lastSeen)}` : "sin señal"}
          </span>
        </div>
        {shown.length > 0 && (
          <ul className="mt-1.5">
            {shown.map((l) => (
              <li key={l.id} className="flex min-h-6 items-center justify-between gap-3 text-sm">
                <span className="min-w-0 truncate">{l.name}</span>
                <span
                  className={`shrink-0 tabular-nums ${l.state === "paused" ? "text-warn font-semibold" : l.state === "free" ? "text-ok font-semibold" : ""}`}
                >
                  {liveLineText(l)}
                </span>
              </li>
            ))}
            {more > 0 && <li className="text-muted min-h-6 text-sm">y {more} más</li>}
          </ul>
        )}
      </div>

      {/* Escritorio */}
      <div className="hidden lg:block">
        <p className="flex items-center gap-3">
          <span
            aria-hidden="true"
            className={`${dot} size-2.5 shrink-0 self-center rounded-full`}
          />
          <span className="text-6xl leading-none font-bold tabular-nums">{waiting}</span>
          <span className="self-end text-xl font-semibold">
            {waiting === 1 ? "persona esperando ahora" : "personas esperando ahora"}
          </span>
        </p>
        {lines.length > 0 && (
          <table className="mt-8 w-full text-left">
            <thead>
              <tr className="border-ink text-muted border-b-2 text-xs font-semibold tracking-wide uppercase">
                <th className="py-2 font-semibold">Barbero</th>
                <th className="py-2 font-semibold">Estado</th>
                <th className="py-2 text-right font-semibold">En fila</th>
                <th className="py-2 text-right font-semibold">Espera aprox.</th>
              </tr>
            </thead>
            <tbody className="divide-line divide-y">
              {lines.map((l) => {
                const d = deskLine(l);
                return (
                  <tr key={l.id} className="h-12">
                    <td className="font-semibold">{l.name}</td>
                    <td
                      className={
                        l.state === "paused"
                          ? "text-warn font-semibold"
                          : l.state === "free"
                            ? "text-ok font-semibold"
                            : ""
                      }
                    >
                      {d.status}
                    </td>
                    <td className="text-right tabular-nums">{l.waiting}</td>
                    <td className="text-right tabular-nums">{d.wait}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
        <p className="text-muted mt-6 max-w-md text-sm">
          Tomas el turno aquí y te vas a tu casa.
          {whatsapp && " Te escribimos por WhatsApp cuando falten dos."} La lista se actualiza sola.
        </p>
      </div>
    </section>
  );
}

/** "Reservar una cita" y "Ver menú" en una línea, bajo "Tomar turno" (solo celular). */
function BarLinks({
  slug,
  canBook,
  citaQuery,
  menuTrigger,
}: {
  slug: string;
  canBook: boolean;
  citaQuery?: string;
  menuTrigger: React.ReactNode;
}) {
  if (!canBook && !menuTrigger) return null;
  return (
    <div className="mt-1 flex items-center justify-center gap-6 lg:hidden">
      {canBook && (
        <Link
          href={`/${slug}/cita${citaQuery ? `?${citaQuery}` : ""}`}
          className="text-ink inline-flex min-h-12 items-center font-semibold underline underline-offset-4"
        >
          Reservar una cita
        </Link>
      )}
      {menuTrigger}
    </div>
  );
}

const BAR =
  "border-line bg-card fixed inset-x-0 bottom-0 z-10 border-t px-4 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] lg:static lg:border-0 lg:bg-transparent lg:p-0";

/**
 * Barra de "Tomar turno" (REQ-078.21): fija abajo en el celular (130 px; el contenido lleva el
 * mismo espacio abajo) y al final de la tarjeta en escritorio. Guardando: "Guardando…" (REQ-078.9);
 * sin red, deshabilitada y dice por qué (REQ-078.10).
 */
export function JoinBar({
  slug,
  pending,
  disabled,
  online,
  hint,
  canBook,
  citaQuery,
  menuTrigger,
}: {
  slug: string;
  pending: boolean;
  disabled: boolean;
  online: boolean;
  /** Por qué sigue deshabilitado con red (la casilla de privacidad). */
  hint: string | null;
  canBook: boolean;
  citaQuery?: string;
  menuTrigger: React.ReactNode;
}) {
  return (
    <div className={BAR}>
      <div className="mx-auto max-w-md lg:max-w-none">
        <button
          type="submit"
          // Guardando: azul marino atenuado; sin red o sin la casilla: gris (Cliente-Negocio)
          className={`btn-primary ${pending ? "disabled:opacity-70" : "disabled:bg-skeleton disabled:text-muted disabled:opacity-100"}`}
          disabled={disabled}
          aria-busy={pending || undefined}
        >
          {pending ? "Guardando…" : "Tomar turno"}
        </button>
        {!online ? (
          <p className="text-muted mt-2 text-center text-sm">
            Necesitas señal para tomar turno. Lo que escribiste no se borra.
          </p>
        ) : (
          hint && <p className="text-muted mt-2 text-center text-sm">{hint}</p>
        )}
        <BarLinks slug={slug} canBook={canBook} citaQuery={citaQuery} menuTrigger={menuTrigger} />
      </div>
    </div>
  );
}

/** Cierra la frase con un punto, sin doblarlo ("… 9:00 a. m." ya lo trae). */
const sentence = (t: string) => (t.endsWith(".") ? t : `${t}.`);

/** Cerrado (REQ-078.21): sin formulario; cuándo abrimos y "Reservar una cita" si hay. */
export function ClosedNotice({
  slug,
  nextOpening,
  canBook,
  menuTrigger,
}: {
  slug: string;
  nextOpening: string | null;
  canBook: boolean;
  menuTrigger: React.ReactNode;
}) {
  return (
    <div className={BAR}>
      <div className="mx-auto max-w-md lg:max-w-none">
        <p className="text-ink flex min-h-12 items-center justify-center text-center font-semibold">
          {nextOpening
            ? `Abrimos: ${sentence(nextOpening.toLowerCase())}`
            : "La fila está cerrada por hoy."}
        </p>
        <BarLinks slug={slug} canBook={canBook} menuTrigger={menuTrigger} />
      </div>
    </div>
  );
}
