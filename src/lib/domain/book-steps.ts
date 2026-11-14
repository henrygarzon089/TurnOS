/**
 * Hito 20 · reservar una cita paso a paso (REQ-089, ADR-063, design.md §26.3). Lógica pura: qué paso
 * se ve según la dirección (`?paso=…&servicio=…&barbero=…&dia=…&hora=…`), el paso de cada error y el
 * resumen. Las reglas de reservar no cambian (REQ-049, REQ-050): solo cómo se presentan.
 */
import { ANY_BARBER } from "@/lib/domain/join-steps";
import type { AppointmentInfo } from "@/lib/queue/appointments";

export const BOOK_STEPS = ["servicio", "barbero", "hora", "datos"] as const;
export type BookStep = (typeof BOOK_STEPS)[number];

export type BookView = {
  step: BookStep;
  serviceId: string | null;
  /** null: "El que esté libre". */
  barberId: string | null;
  /** Día escogido, `YYYY-MM-DD`; null: el primero que tenga horario. */
  day: string | null;
  /** Hora escogida (ISO); se confirma contra las horas libres al cargarlas. */
  startsAt: string | null;
};

/** Servicios que hace algún barbero que recibe citas (REQ-049.3). */
export function bookableServices<S extends { id: string }>(
  services: S[],
  info: Pick<AppointmentInfo, "barbers">,
): S[] {
  return services.filter((s) => info.barbers.some((b) => b.serviceIds.includes(s.id)));
}

/** REQ-089.1: los que reciben citas y hacen el servicio. */
export function bookBarbers(info: Pick<AppointmentInfo, "barbers">, serviceId: string) {
  return info.barbers.filter((b) => b.serviceIds.includes(serviceId));
}

/**
 * REQ-089.3 (REQ-088.4): lo que dice la dirección, corregido. Sin servicio válido, paso 1; un
 * barbero que no hace el servicio pasa a "El que esté libre"; sin hora, el paso 4 vuelve al 3.
 */
export function readBookView(
  params: { get(name: string): string | null },
  services: { id: string }[],
  info: Pick<AppointmentInfo, "barbers" | "openDays">,
): BookView {
  const paso = params.get("paso");
  const asked = (BOOK_STEPS as readonly string[]).includes(paso ?? "")
    ? (paso as BookStep)
    : "servicio";
  const serviceId = bookableServices(services, info).some((s) => s.id === params.get("servicio"))
    ? params.get("servicio")
    : null;
  const raw = params.get("barbero");
  const barberId =
    serviceId && raw && raw !== ANY_BARBER && bookBarbers(info, serviceId).some((b) => b.id === raw)
      ? raw
      : null;
  const dia = params.get("dia");
  const day = dia && info.openDays.includes(dia) ? dia : null;
  const startsAt = day ? params.get("hora") : null;
  if (!serviceId)
    return { step: "servicio", serviceId: null, barberId: null, day: null, startsAt: null };
  const step = asked === "datos" && !startsAt ? "hora" : asked;
  return { step, serviceId, barberId, day, startsAt };
}

/** La dirección de un paso, con lo ya escogido (REQ-089.3). */
export function bookStepQuery(v: BookView): string {
  const q = new URLSearchParams({ paso: v.step });
  if (v.serviceId) q.set("servicio", v.serviceId);
  if (v.serviceId && v.step !== "servicio" && v.step !== "barbero")
    q.set("barbero", v.barberId ?? ANY_BARBER);
  if (v.step === "barbero" && v.barberId) q.set("barbero", v.barberId);
  if (v.day && (v.step === "hora" || v.step === "datos")) q.set("dia", v.day);
  if (v.startsAt && v.step === "datos") q.set("hora", v.startsAt);
  return `?${q.toString()}`;
}

/** El paso anterior; del paso 1, null (vuelve a la portada). */
export function previousBookStep(step: BookStep): BookStep | null {
  const i = BOOK_STEPS.indexOf(step);
  return i === 0 ? null : BOOK_STEPS[i - 1];
}

export function bookStepNumber(step: BookStep): number {
  return BOOK_STEPS.indexOf(step) + 1;
}

/** REQ-089.3 (REQ-088.6): una hora que otro tomó lleva al paso 3; lo demás se ve en el 4. */
export function bookStepOfField(field: string | undefined): BookStep {
  if (field === "serviceId") return "servicio";
  if (field === "barberId") return "barbero";
  if (field === "startsAt") return "hora";
  return "datos";
}

/** "Corte con Juan" / "Corte con el que esté libre" sobre el botón fijo del paso 4. */
export function bookSummary(serviceName: string, barberName: string | null): string {
  return `${serviceName} ${barberName ? `con ${barberName}` : "con el que esté libre"}`;
}
