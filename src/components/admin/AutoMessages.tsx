import { AUTO_MESSAGES } from "@/lib/notifications/auto-messages";
import { renderTemplate } from "@/lib/notifications/render";

export type MonthStats = { sent: number; failed: number; capReached: boolean };

const count = new Intl.NumberFormat("es-CO");

/** REQ-040.9 textos fijos, solo para leer. REQ-043.2 contadores del mes y aviso de tope. */
export function AutoMessages({ stats, businessName }: { stats: MonthStats; businessName: string }) {
  return (
    <section aria-label="Avisos automáticos" className="mt-4 flex flex-col gap-3">
      <h2 className="text-lg font-bold">Avisos automáticos</h2>
      {stats.capReached && (
        <p role="alert" className="text-warn rounded-xl bg-warn-soft p-3 text-sm font-medium">
          Llegaste al tope de 3.000 avisos del mes. Los turnos vuelven al botón manual hasta el
          próximo mes.
        </p>
      )}
      <dl className="grid grid-cols-2 gap-3">
        <div className="border-line bg-card rounded-xl border p-3">
          <dt className="text-muted text-xs">Enviados este mes</dt>
          <dd className="text-2xl font-bold">{count.format(stats.sent)}</dd>
        </div>
        <div className="border-line bg-card rounded-xl border p-3">
          <dt className="text-muted text-xs">Fallidos este mes</dt>
          <dd className="text-2xl font-bold">{count.format(stats.failed)}</dd>
        </div>
      </dl>
      {AUTO_MESSAGES.map((m) => (
        <div key={m.title} className="border-line bg-card rounded-xl border p-3">
          <p className="font-semibold">{m.title}</p>
          <p className="mt-1 rounded-lg bg-ok-soft p-2 text-sm">
            {renderTemplate(m.body, { negocio: businessName })}
          </p>
        </div>
      ))}
      <p className="text-muted text-xs">
        Estos textos los aprueba WhatsApp y no se pueden editar. Salen solos a quien dio permiso.
      </p>
    </section>
  );
}
