import type { Metadata } from "next";
import { Suspense } from "react";
import { TodayAlerts } from "@/components/admin/today/TodayAlerts";
import { TodayAppointments } from "@/components/admin/today/TodayAppointments";
import { TodayCardSkeleton } from "@/components/admin/today/TodayCard";
import { TodayCash } from "@/components/admin/today/TodayCash";
import { TodayQueue } from "@/components/admin/today/TodayQueue";
import { TodayRemind } from "@/components/admin/today/TodayRemind";
import { TodayShortcuts } from "@/components/admin/today/TodayShortcuts";
import { TodayWeek } from "@/components/admin/today/TodayWeek";
import { LiveRefresh } from "@/components/queue/LiveRefresh";
import { getStaffSession } from "@/lib/auth/session";
import { businessDayBogota, formatTimeBogota, weekdayName } from "@/lib/domain/time";
import { enabledModules } from "@/lib/domain/modules";
import { shortDayLabel, todayLayout } from "@/lib/domain/today";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Hoy" };

const MONTHS = [
  "enero",
  "febrero",
  "marzo",
  "abril",
  "mayo",
  "junio",
  "julio",
  "agosto",
  "septiembre",
  "octubre",
  "noviembre",
  "diciembre",
];

/**
 * REQ-076, REQ-078.28, REQ-078.29 "Hoy" del dueño como los tableros Dueno-Hoy y Dueno-Hoy-Movil
 * (design §22.8). Cada bloque es un Server Component en su propio Suspense: llega cuando termina,
 * sin esperar a los demás (REQ-076.10). Se relee con cada cambio de la fila o de la caja
 * (REQ-076.3, `LiveRefresh`); "en vivo · <hora>" es la hora de esa relectura. El rol lo controla
 * admin/layout.tsx.
 *
 * Celular: cabecera azul y una columna (alertas, fila, caja, citas, recordar; REQ-076.11).
 * Tablet (768 px): dos columnas, alertas y fila a la izquierda, la plata a la derecha. Escritorio:
 * rejilla de 12 columnas; las dos columnas pasan a `contents` y cada bloque toma su celda
 * (`todayLayout`, REQ-079.4): con todos los módulos, Fila (8) + Caja (4); Alertas (8) + Citas (4);
 * Semana (6) + Recordar (6). En modo esencial (sin citas ni recordar): Fila (8) + Alertas (4) y
 * Caja (6) + Semana (6).
 */
export default async function TodayPage() {
  const session = (await getStaffSession())!;
  const day = businessDayBogota();
  const [, m, d] = day.split("-").map(Number);
  const time = formatTimeBogota(new Date());
  const modules = enabledModules();
  const layout = todayLayout(modules);
  return (
    <main data-tablet className="pb-6">
      <LiveRefresh businessId={session.business.id} />
      <header
        data-testid="today-mobile-header"
        data-screen-header
        className="bg-brand text-brand-ink -mx-4 -mt-6 flex h-14 items-center gap-3 px-4 lg:hidden"
      >
        <h1 className="text-lg font-bold">Hoy</h1>
        <p className="text-sm opacity-80">
          <span className="md:hidden">{shortDayLabel(day)}</span>
          <span className="max-md:hidden">
            {weekdayName(day)} {d} de {MONTHS[m - 1]}
          </span>
        </p>
        <p className="ml-auto flex items-center gap-2 text-sm font-semibold">
          <span aria-hidden="true" className="bg-accent-on-brand size-2 rounded-full" />
          <span>
            en vivo<span className="max-md:hidden"> · {time}</span>
          </span>
        </p>
      </header>
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-4 max-lg:hidden">
          <h1 className="text-3xl font-bold">Hoy</h1>
          <p data-testid="today-live" className="text-muted flex items-center gap-2">
            <span aria-hidden="true" className="bg-called size-2 rounded-full" />
            en vivo · {time}
          </p>
        </div>
        <TodayShortcuts modules={modules} />
      </div>
      <div className="group grid gap-2 max-lg:-mx-4 md:grid-cols-2 md:items-start lg:mt-6 lg:grid-cols-12 lg:items-stretch lg:gap-5">
        <div className="flex flex-col gap-2 lg:contents">
          <div className={`max-lg:has-[[data-empty]]:hidden ${layout.alerts}`}>
            <Suspense fallback={<TodayCardSkeleton rows={3} />}>
              <TodayAlerts />
            </Suspense>
          </div>
          <div className={layout.queue}>
            <Suspense fallback={<TodayCardSkeleton rows={5} />}>
              <TodayQueue />
            </Suspense>
          </div>
        </div>
        <div className="flex flex-col gap-2 lg:contents">
          <div className={layout.cash}>
            <Suspense fallback={<TodayCardSkeleton rows={6} />}>
              <TodayCash />
            </Suspense>
          </div>
          {/* REQ-079.4 con citas apagadas ni se monta; con citas encendidas pero sin citas hoy el
              bloque no pinta nada y la celda se oculta (REQ-076.5) */}
          {layout.showAppointments && (
            <div data-appointments className={`empty:hidden ${layout.appointments}`}>
              <Suspense fallback={<TodayCardSkeleton rows={3} />}>
                <TodayAppointments />
              </Suspense>
            </div>
          )}
          {layout.showRemind && (
            <div className={layout.remind}>
              <Suspense fallback={<TodayCardSkeleton rows={4} />}>
                <TodayRemind />
              </Suspense>
            </div>
          )}
          {/* REQ-076.9 solo desde 1024 px */}
          <div className={`hidden lg:block ${layout.week}`}>
            <Suspense fallback={<TodayCardSkeleton rows={4} />}>
              <TodayWeek />
            </Suspense>
          </div>
        </div>
      </div>
    </main>
  );
}
