/**
 * Textos automáticos tal como los aprobó Meta (design.md §12.3, REQ-040.9): se muestran solo para
 * leer y las variables salen de `templateFor` en `dispatch.ts`. Si cambia una plantilla en Meta hay
 * que cambiarla aquí.
 */
export const AUTO_MESSAGES = [
  {
    title: "Cuando faltan 2 turnos",
    body: "Hola {nombre}, en {negocio} ya casi es tu turno (≈ {tiempo}). Ve saliendo. Sigue tu turno aquí: {enlace}",
  },
  {
    title: "Cuando lo llaman",
    body: "{nombre}, te están llamando en {negocio}. Tienes {minutos} minutos para llegar. Tu turno: {enlace}",
  },
] as const;
