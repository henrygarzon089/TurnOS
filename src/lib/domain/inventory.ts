/** Inventario de insumos y vitrina (REQ-070…REQ-074, design.md §18). Cantidades en unidades enteras. */

/** Servicios de la ventana que gastan un insumo; `servicesPerUnit` null = "Midiendo". */
export type UsageWindow = { services: number; servicesPerUnit: number | null };

/** REQ-073.2 consumo esperado = Σ (servicios ÷ rendimiento), con 2 decimales, como `record_stock_count`. */
export function expectedUse(usage: UsageWindow[]): number {
  const sum = usage.reduce(
    (acc, u) => (u.servicesPerUnit ? acc + u.services / u.servicesPerUnit : acc),
    0,
  );
  return Math.round(sum * 100) / 100;
}

/**
 * REQ-073.4 alerta: el consumo real pasa el porcentaje del negocio y por al menos una unidad
 * entera (con unidades enteras, una caja abierta no es exceso). Igual que `inventory_is_alert`.
 */
export function isConsumptionAlert(realUse: number, expected: number, alertPct: number): boolean {
  return realUse > expected * (1 + alertPct / 100) && realUse - expected >= 1;
}
