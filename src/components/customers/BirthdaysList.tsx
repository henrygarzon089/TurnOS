import { EmptyState } from "@/components/ui/States";
import type { BirthdaysView } from "@/lib/actions/customers";
import { celebrationLabel } from "@/lib/domain/birthday";
import { buildBirthdayLink } from "@/lib/notifications/reminder";

/** REQ-037.4: quienes cumplen años esta semana, con saludo por WhatsApp. */
export function BirthdaysList({ view }: { view: BirthdaysView }) {
  if (view.customers.length === 0) {
    return (
      <EmptyState
        icon="calendar"
        title="Nadie cumple años esta semana."
        text="Cuando un cliente deja su cumpleaños al tomar turno, sale aquí esa semana para saludarlo."
      />
    );
  }
  return (
    <ul aria-label="Cumplen esta semana" className="divide-line divide-y">
      {view.customers.map((c) => (
        <li
          key={c.id}
          className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
        >
          <div className="min-w-0">
            <p className="font-bold">{c.name}</p>
            <p className="text-muted text-sm">{celebrationLabel(c.celebratesOn, view.today)}</p>
          </div>
          <a
            className="btn-secondary w-full shrink-0 text-base sm:w-auto"
            href={buildBirthdayLink({
              phoneE164: c.phone,
              template: view.template,
              customerName: c.name,
              businessName: view.businessName,
            })}
            target="_blank"
            rel="noopener"
          >
            Saludar por WhatsApp
          </a>
        </li>
      ))}
    </ul>
  );
}
