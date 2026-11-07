import { membershipReportLines, type MembershipTotals as Totals } from "@/lib/domain/membership";

/** REQ-048.3 cuotas y cortes de membresía aparte en la caja, el cierre y la semana. */
export function MembershipTotals({ totals }: { totals: Totals }) {
  const lines = membershipReportLines(totals);
  if (!lines.length) return null;
  return (
    <section aria-label="Membresía familiar" className="border-line bg-card rounded-md border p-3">
      <ul className="flex flex-col gap-1 text-sm">
        {lines.map((l) => (
          <li
            key={l.key}
            className="flex justify-between gap-2"
            data-testid={`membership-${l.key}`}
          >
            <span className="text-muted">{l.label}</span>
            <span className="font-semibold">{l.value}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
