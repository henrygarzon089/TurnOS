/**
 * Servicios por barbero en el formulario del cliente (REQ-035.6, REQ-035.7, ADR-023).
 * `barberIds` = quienes hacen el servicio; sin dato = todos (negocio sin restricciones).
 */
type ServiceRef = { id: string; barberIds?: string[] | null };
type BarberToday = { id: string };

/** REQ-035.6: barberos presentes que hacen el servicio. */
export function barbersForService<B extends BarberToday>(service: ServiceRef, today: B[]): B[] {
  if (!service.barberIds) return today;
  const can = new Set(service.barberIds);
  return today.filter((b) => can.has(b.id));
}

/** REQ-035.7: con alguien presente, un servicio que ninguno de los presentes hace no se ofrece. */
export function serviceAvailability(
  service: ServiceRef,
  today: BarberToday[],
): "available" | "nobody_today" {
  if (today.length === 0) return "available";
  return barbersForService(service, today).length > 0 ? "available" : "nobody_today";
}
