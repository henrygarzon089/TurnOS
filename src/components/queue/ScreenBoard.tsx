"use client";

import QRCode from "qrcode";
import { useCallback, useEffect, useState } from "react";
import { getScreenQueue } from "@/lib/actions/public";
import { businessMark } from "@/lib/domain/public-view";
import {
  activeCall,
  barberScreenState,
  MAX_LANES,
  nextLabel,
  type BarberScreenState,
  type ScreenView,
} from "@/lib/domain/screen";
import { formatTimeBogota } from "@/lib/domain/time";
import { useQueueSubscription } from "@/lib/realtime/use-queue-subscription";

/**
 * REQ-013 / REQ-078.25: pantalla del televisor como el tablero Cliente-Pantalla (design §22.7).
 * Sin interacción, se actualiza sola. Todo se mide en `em` sobre una base de 16 px a 1920×1080 que
 * escala con la pantalla (`min(vw, vh)`), así un televisor de 1280×720 tampoco se desplaza.
 */
export function ScreenBoard({
  initial,
  slug,
  screenKey,
  queueUrl,
}: {
  initial: ScreenView;
  slug: string;
  screenKey: string;
  queueUrl: string;
}) {
  const [view, setView] = useState(initial);
  const [qr, setQr] = useState<string | null>(null);

  const reload = useCallback(async () => {
    const v = await getScreenQueue(slug, screenKey);
    if (v) setView(v);
  }, [slug, screenKey]);
  useQueueSubscription(view.id, reload);

  useEffect(() => {
    QRCode.toDataURL(queueUrl, { width: 240, margin: 0 })
      .then(setQr)
      .catch(() => setQr(null));
  }, [queueUrl]);

  // REQ-013.4: la franja y la hora salen del reloj (sin setState en efecto por cada llamado)
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  return <ScreenLayout view={view} now={now} qr={qr} />;
}

const STATE_CLASS: Record<BarberScreenState, string> = {
  Atendiendo: "text-brand-ink/80",
  Llamando: "text-accent-on-brand font-semibold",
  "En pausa": "text-warn-on-brand font-semibold",
  Libre: "text-ok-on-brand font-semibold",
};

/** Lo que se ve, sin estado: se prueba con `renderToStaticMarkup`. */
export function ScreenLayout({
  view,
  now,
  qr,
}: {
  view: ScreenView;
  now: number;
  qr: string | null;
}) {
  const call = activeCall(view, now);
  const lanes = view.barbers.slice(0, MAX_LANES);

  return (
    <main
      className="bg-brand text-brand-ink flex h-screen flex-col overflow-hidden px-[4.5em] pt-[2.5em] pb-[2.5em]"
      style={{ fontSize: "min(0.8333vw, 1.4815vh)" }}
    >
      {/* 1. Marca, nombre, esperando y hora */}
      <header className="flex h-[5em] shrink-0 items-center gap-[1.5em]">
        <span
          aria-hidden="true"
          className="text-brand flex size-[5em] shrink-0 items-center justify-center rounded-md bg-white"
        >
          <span className="text-[2.25em] font-bold">{businessMark(view.name)}</span>
        </span>
        <h1 className="min-w-0 flex-1 truncate text-[3.5em] leading-tight font-bold">
          {view.name}
        </h1>
        <p className="flex shrink-0 items-center gap-[0.5em] text-[2.25em]">
          {view.isOpen ? (
            <>
              <span aria-hidden="true" className="bg-accent-on-brand size-[0.45em] rounded-full" />
              <span>
                <span className="font-semibold tabular-nums">{view.waitingCount}</span> esperando
              </span>
            </>
          ) : (
            <span className="text-brand-ink/80">Cerrado</span>
          )}
        </p>
        <p
          className="ml-[1.5em] shrink-0 text-[3.5em] font-bold tabular-nums"
          suppressHydrationWarning
        >
          {formatTimeBogota(new Date(now))}
        </p>
      </header>

      {/* 2. Franja del llamado (REQ-013.4): el espacio queda reservado aunque no haya llamado */}
      <div className="mt-[2em] h-[12.25em] shrink-0" role="status" aria-live="assertive">
        {call ? (
          <div
            data-call-slot="full"
            className="bg-called text-accent-ink motion-safe:animate-fade-in flex h-full items-center gap-[2.5em] rounded-lg px-[2.5em]"
          >
            <span className="shrink-0 text-[2.5em] font-bold tracking-wide">LLAMANDO A</span>
            {call.number != null && (
              <span className="shrink-0 text-[7.5em] leading-none font-bold tabular-nums">
                {call.number}
              </span>
            )}
            <span className="min-w-0 flex-1 truncate text-[4.5em] font-bold">{call.name}</span>
            <span className="shrink-0 text-[4.5em] font-bold">→ {call.barber}</span>
          </div>
        ) : (
          <div data-call-slot="empty" className="h-full" />
        )}
      </div>

      {/* 3. Una columna por barbero */}
      <section
        className="mt-[2em] grid min-h-0 flex-1 gap-[2.5em] overflow-hidden"
        style={{
          gridTemplateColumns: `repeat(${Math.max(1, lanes.length)}, minmax(0, 1fr))`,
        }}
      >
        {lanes.map((b) => {
          const state = barberScreenState(b);
          return (
            <article
              key={b.id}
              data-lane={b.id}
              aria-label={b.name}
              className={`min-w-0 border-t-[0.1875em] pt-[1.25em] ${state === "Llamando" ? "border-accent-on-brand" : "border-brand-ink/20"}`}
            >
              <h2 className="text-brand-ink/70 truncate text-[1.625em] font-bold tracking-wider">
                {b.name.toLocaleUpperCase("es-CO")}
              </h2>
              <p className={`mt-[0.25em] text-[1.875em] ${STATE_CLASS[state]}`}>{state}</p>
              <p className="mt-[0.3em] truncate text-[4.5em] leading-none font-bold tabular-nums">
                {b.current ? (
                  (b.current.number ?? b.current.name)
                ) : (
                  <span className="text-brand-ink/30">—</span>
                )}
              </p>
              {b.next.length > 0 ? (
                <ol className="mt-[0.5em]">
                  {b.next.map((n, i) => (
                    <li
                      key={i}
                      className="border-brand-ink/15 flex items-baseline justify-between gap-[0.5em] border-b py-[0.25em] text-[2.5em] leading-tight"
                    >
                      <span className="min-w-0 truncate">{n.name}</span>
                      <span
                        className={`shrink-0 font-bold tabular-nums ${n.scheduledAt ? "text-[0.8em]" : ""}`}
                      >
                        {nextLabel(n)}
                      </span>
                    </li>
                  ))}
                </ol>
              ) : (
                state === "Libre" && (
                  <p className="text-brand-ink/70 mt-[1em] text-[2.125em] leading-snug">
                    Nadie en su fila. Escanea y pasas ya.
                  </p>
                )
              )}
            </article>
          );
        })}
      </section>

      {/* 4. El primero libre (REQ-013.1) */}
      {view.anyone.length > 0 && (
        <section className="flex shrink-0 items-baseline gap-[1em] overflow-hidden pt-[0.5em] text-[2.25em]">
          <h2 className="text-brand-ink/70 shrink-0 font-semibold">El primero libre</h2>
          <ol className="flex min-w-0 gap-[1.25em] overflow-hidden whitespace-nowrap">
            {view.anyone.map((n, i) => (
              <li key={i} className="shrink-0">
                {n.name}
                {n.number != null && <b className="ml-[0.4em] tabular-nums">{n.number}</b>}
              </li>
            ))}
          </ol>
        </section>
      )}

      {/* 5. QR */}
      <footer className="border-brand-ink/15 mt-[1em] flex shrink-0 items-center gap-[1.75em] border-t pt-[1.5em]">
        <span className="flex size-[7.5em] shrink-0 items-center justify-center rounded-sm bg-white p-[0.6em]">
          {qr && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={qr} alt="QR para tomar turno" className="size-full" />
          )}
        </span>
        <div>
          <p className="text-[2.25em] font-semibold">Escanea para tomar turno</p>
          <p className="text-brand-ink/70 mt-[0.25em] text-[1.75em]">
            y espera en tu casa. Te avisamos por WhatsApp.
          </p>
        </div>
      </footer>
    </main>
  );
}
