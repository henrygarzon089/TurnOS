import { cache } from "react";
import { getBusinessQueue } from "@/lib/actions/queue";

/**
 * La fila del dueño una sola vez por pedido: la comparten "Fila en vivo" de "Hoy" y los números
 * de Fila y Citas del menú lateral (REQ-078.27).
 */
export const loadOwnerQueue = cache(getBusinessQueue);
