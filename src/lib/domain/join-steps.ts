/**
 * Hito 20 · tomar turno paso a paso (REQ-088, ADR-063, design.md §26.3). Lógica pura: qué paso se
 * ve según la dirección (`?paso=…&servicio=…&barbero=…`), a qué paso lleva cada error, qué dice cada
 * tarjeta de barbero y el resumen del botón "Confirmar turno". Las reglas de tomar turno no cambian
 * (REQ-003, REQ-035): solo cómo se presentan.
 */
import { barbersForService, serviceAvailability } from "@/lib/domain/barber-services";
import { minutes } from "@/lib/domain/public-view";
import { estimateNewTicket } from "@/lib/domain/queue-estimate";
import type { PublicBusiness } from "@/lib/queue/public-queue";

export const JOIN_STEPS = ["servicio", "barbero", "datos"] as const;
export type JoinStep = (typeof JOIN_STEPS)[number];

/** "El primero libre" en la dirección. */
export const ANY_BARBER = "libre";

type Biz = Pick<PublicBusiness, "services" | "barbersToday" | "queue">;

export type JoinView = {
  /** null: la portada con los dos botones (REQ-088.1). */
  step: JoinStep | null;
  serviceId: string | null;
  /** null: "El primero libre". */
  barberId: string | null;
};

/**
 * REQ-088.4: lo que dice la dirección, corregido. Sin servicio válido se vuelve al paso 1; un
 * barbero que no está hoy, está en pausa o no hace el servicio pasa a "El primero libre" (REQ-035.6).
 */
export function readJoinView(params: { get(name: string): string | null }, b: Biz): JoinView {
  const paso = params.get("paso");
  const step = (JOIN_STEPS as readonly string[]).includes(paso ?? "") ? (paso as JoinStep) : null;
  const service = b.services.find(
    (s) =>
      s.id === params.get("servicio") && serviceAvailability(s, b.barbersToday) === "available",
  );
  const raw = params.get("barbero");
  const barber =
    service && raw && raw !== ANY_BARBER
      ? barbersForService(service, b.barbersToday).find(
          (x) => x.id === raw && x.status !== "paused",
        )
      : undefined;
  if (step === null) return { step: null, serviceId: null, barberId: null };
  if (!service) return { step: "servicio", serviceId: null, barberId: null };
  return { step, serviceId: service.id, barberId: barber?.id ?? null };
}

/** La dirección de un paso, con lo ya escogido (REQ-088.4). */
export function joinStepQuery(view: JoinView): string {
  if (!view.step) return "";
  const q = new URLSearchParams({ paso: view.step });
  if (view.serviceId) q.set("servicio", view.serviceId);
  if (view.step === "datos") q.set("barbero", view.barberId ?? ANY_BARBER);
  if (view.step === "barbero" && view.barberId) q.set("barbero", view.barberId);
  return `?${q.toString()}`;
}

/** El paso anterior ("Atrás"); del paso 1 se vuelve a la portada. */
export function previousStep(step: JoinStep): JoinStep | null {
  const i = JOIN_STEPS.indexOf(step);
  return i === 0 ? null : JOIN_STEPS[i - 1];
}

/** "Paso 2 de 3" (REQ-088.2). */
export function stepNumber(step: JoinStep): number {
  return JOIN_STEPS.indexOf(step) + 1;
}

/** REQ-088.6: el error se muestra en el paso donde está el dato. */
export function stepOfField(field: string | undefined): JoinStep {
  if (field === "serviceId") return "servicio";
  if (field === "preferredBarberId") return "barbero";
  return "datos";
}

export type BarberChoice = {
  id: string;
  name: string;
  photoPath: string | null;
  paused: boolean;
  /** "Libre", "2 antes · ~ 30 min" o "En pausa" (REQ-088.2). */
  text: string;
};

/** Lo que dice una tarjeta de barbero con el servicio escogido. */
export function barberChoiceText(paused: boolean, ahead: number, waitMin: number | null): string {
  if (paused) return "En pausa";
  if (waitMin === 0) return "Libre";
  const before = `${ahead} antes`;
  return waitMin === null ? before : `${before} · ~ ${minutes(waitMin)}`;
}

/**
 * REQ-088.2 paso 2: "El primero libre" con su espera, y los presentes que hacen el servicio, con
 * foto y su espera para ese servicio. Los que no lo hacen no salen (REQ-035.6).
 */
export function barberChoices(
  b: Biz & Pick<PublicBusiness, "barberPhotos">,
  serviceId: string,
  now: Date,
): { anyWaitMin: number | null; barbers: BarberChoice[] } {
  const service = b.services.find((s) => s.id === serviceId);
  if (!service) return { anyWaitMin: null, barbers: [] };
  const capable = service.barberIds ?? null;
  const est = (id: string | null) =>
    estimateNewTicket({ now, ...b.queue }, service.durationMin, id, capable).waitMin;
  const barbers = barbersForService(service, b.barbersToday).map((x) => {
    const paused = x.status === "paused";
    const ahead = b.queue.waiting.filter((t) => t.preferredBarberId === x.id).length;
    const wait = paused ? null : est(x.id);
    // "Libre" solo si atiende ya: disponible y sin nadie antes para él
    const free = x.status === "available" && wait === 0;
    return {
      id: x.id,
      name: x.name,
      photoPath: b.barberPhotos[x.id] ?? null,
      paused,
      text: barberChoiceText(paused, ahead, free ? 0 : wait === 0 ? null : wait),
    };
  });
  return { anyWaitMin: est(null), barbers };
}

/** REQ-088.2: "Corte moderno con Pedro · ~ 20 min" en el botón fijo del paso 3. */
export function joinSummary(
  serviceName: string,
  barberName: string | null,
  waitMin: number | null,
): string {
  const who = barberName ? `con ${barberName}` : "con el primero libre";
  const wait = waitMin === null ? "" : waitMin === 0 ? " · ya" : ` · ~ ${minutes(waitMin)}`;
  return `${serviceName} ${who}${wait}`;
}
