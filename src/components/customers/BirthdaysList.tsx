import type { BirthdaysView } from "@/lib/actions/customers";
import { celebrationLabel } from "@/lib/domain/birthday";
import { buildBirthdayLink } from "@/lib/notifications/reminder";

/** REQ-037.4: quienes cumplen años esta semana, con saludo por WhatsApp. */
export function BirthdaysList({ view }: { view: BirthdaysView }) {
  if (view.customers.length === 0) {
    return <p className="text-muted mt-2">Nadie cumple años esta semana.</p>;
  }
  return (
    <ul aria-label="Cumplen esta semana" className="mt-2 flex flex-col gap-2">
      {view.customers.map((c) => (
        <li key={c.id} className="border-line bg-card flex flex-col gap-2 rounded-xl border p-3">
          <div>
            <p className="font-semibold">{c.name}</p>
            <p className="text-muted text-sm">{celebrationLabel(c.celebratesOn, view.today)}</p>
          </div>
          <a
            className="btn-primary"
            href={buildBirthdayLink({
              phoneE164: c.phone,
              template: view.template,
              customerName: c.name,
              businessName: view.businessName,
            })}
            target="_blank"
            rel="noopener"
          >
            📲 Saludar por WhatsApp
          </a>
        </li>
      ))}
    </ul>
  );
}
