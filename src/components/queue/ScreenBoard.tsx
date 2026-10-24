"use client";

import QRCode from "qrcode";
import { useCallback, useEffect, useState } from "react";
import { getScreenQueue, type ScreenView } from "@/lib/actions/public";
import { useQueueSubscription } from "@/lib/realtime/use-queue-subscription";

/** REQ-013: pantalla del televisor. Letra grande, sin interacción, se actualiza sola. */
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
    QRCode.toDataURL(queueUrl, { width: 256, margin: 1 })
      .then(setQr)
      .catch(() => setQr(null));
  }, [queueUrl]);

  // REQ-013.4: resaltar 30 s al llamar (derivado del reloj, sin setState en efecto)
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  const highlight: Record<string, boolean> = {};
  for (const b of view.barbers) {
    if (b.current?.status === "called" && b.current.calledAt) {
      highlight[b.id] = now - new Date(b.current.calledAt).getTime() < 30_000;
    }
  }

  return (
    <main className="bg-ink text-card flex min-h-screen flex-col p-8" style={{ fontSize: 32 }}>
      <header className="flex items-start justify-between">
        <div>
          <h1 className="text-6xl font-bold">{view.name}</h1>
          <p className="opacity-70">
            {view.isOpen ? `${view.waitingCount} en la fila` : "Cerrado"}
          </p>
        </div>
        {qr && (
          <div className="bg-card rounded-2xl p-3 text-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={qr} alt="QR para tomar turno" width={160} height={160} />
            <p className="text-ink mt-1 text-base font-semibold">Toma tu turno</p>
          </div>
        )}
      </header>

      <section
        className="mt-8 grid flex-1 gap-6"
        style={{
          gridTemplateColumns: `repeat(${Math.max(1, Math.min(5, view.barbers.length || 1))}, minmax(0, 1fr))`,
        }}
      >
        {view.barbers.map((b) => {
          const hl = !!highlight[b.id];
          return (
            <article
              key={b.id}
              className={`rounded-3xl p-6 ${hl ? "text-ink animate-pulse bg-amber-300" : "bg-white/10"}`}
              aria-label={b.name}
            >
              <h2 className="text-4xl font-bold">{b.name}</h2>
              <p className="text-2xl opacity-70">
                {b.status === "paused"
                  ? "En pausa"
                  : b.status === "busy"
                    ? "Atendiendo"
                    : "Disponible"}
              </p>
              <div className="mt-6">
                <p className="text-xl uppercase opacity-60">Ahora</p>
                <p className="text-5xl font-bold">{b.current?.name ?? "—"}</p>
                {hl && <p className="mt-2 text-2xl font-semibold">Pasa a la silla de {b.name}</p>}
              </div>
              {b.next.length > 0 && (
                <div className="mt-6">
                  <p className="text-xl uppercase opacity-60">Siguen</p>
                  <ol className="text-3xl">
                    {b.next.map((n, i) => (
                      <li key={i}>{n}</li>
                    ))}
                  </ol>
                </div>
              )}
            </article>
          );
        })}
      </section>

      {view.anyone.length > 0 && (
        <section className="mt-6 rounded-3xl bg-white/10 p-6">
          <p className="text-xl uppercase opacity-60">El que esté libre</p>
          <p className="text-3xl">{view.anyone.join(" · ")}</p>
        </section>
      )}
    </main>
  );
}
