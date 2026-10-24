/**
 * Preferencias del cliente en su navegador (REQ-003.7, REQ-002.4). Solo comodidad: el estado real
 * vive en el servidor. Todo en try/catch porque localStorage puede no existir.
 */
export type CustomerPrefs = {
  name?: string;
  phone?: string; // E.164
  /** Versión del aviso aceptada por negocio (slug → versión) */
  privacyAccepted?: Record<string, number>;
  /** Último turno por negocio (slug → token), para volver a "Mi turno" */
  lastTicket?: Record<string, string>;
};

const KEY = "turnos:cliente";

export function readPrefs(): CustomerPrefs {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as CustomerPrefs) : {};
  } catch {
    return {};
  }
}

export function writePrefs(patch: Partial<CustomerPrefs>): void {
  try {
    const current = readPrefs();
    const next: CustomerPrefs = {
      ...current,
      ...patch,
      privacyAccepted: { ...current.privacyAccepted, ...patch.privacyAccepted },
      lastTicket: { ...current.lastTicket, ...patch.lastTicket },
    };
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // sin almacenamiento: seguimos sin prellenar
  }
}
