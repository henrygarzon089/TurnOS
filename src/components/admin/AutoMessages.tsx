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
        <p role="alert" className="text-warn bg-warn-soft rounded-md p-3 text-sm font-medium">
          Llegaste al tope de 3.000 avisos del mes. Los turnos vuelven al botón manual hasta el
          próximo mes.
        </p>
      )}
      <dl className="grid grid-cols-2 gap-3">
        <div className="border-line bg-card rounded-md border p-3">
          <dt className="text-muted text-sm">Enviados este mes</dt>
          <dd className="text-2xl font-bold tabular-nums">{count.format(stats.sent)}</dd>
        </div>
        <div className="border-line bg-card rounded-md border p-3">
          <dt className="text-muted text-sm">Fallidos este mes</dt>
          <dd className="text-2xl font-bold tabular-nums">{count.format(stats.failed)}</dd>
        </div>
      </dl>
      <ul className="border-line bg-card divide-line flex flex-col divide-y rounded-md border">
        {AUTO_MESSAGES.map((m) => (
          <li key={m.title} className="px-4 py-3">
            <p className="font-semibold">{m.title}</p>
            <p className="bg-surface mt-1 rounded-sm p-2 text-base">
              {renderTemplate(m.body, { negocio: businessName })}
            </p>
          </li>
        ))}
      </ul>
      <p className="text-muted text-sm">
        Estos textos los aprueba WhatsApp y no se pueden editar. Salen solos a quien dio permiso.
      </p>
    </section>
  );
}
