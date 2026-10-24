/**
 * Render de plantillas de WhatsApp (REQ-033.1, REQ-009.2). Variables: {nombre} {negocio}
 * {tiempo} {enlace}. Una variable desconocida se deja tal cual para que el dueño la vea.
 */
export type TemplateVars = Partial<Record<"nombre" | "negocio" | "tiempo" | "enlace", string>>;

export function renderTemplate(template: string, vars: TemplateVars): string {
  return template.replace(
    /\{(nombre|negocio|tiempo|enlace)\}/g,
    (match, key: keyof TemplateVars) => {
      const v = vars[key];
      return v === undefined ? match : v;
    },
  );
}
