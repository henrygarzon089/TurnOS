import { giftCardReportLines, type GiftCardTotals as Totals } from "@/lib/domain/giftCard";

/** REQ-059.1 / REQ-059.2 tarjetas de regalo aparte en la caja, el cierre y la semana. */
export function GiftCardTotals({ totals }: { totals: Totals }) {
  const lines = giftCardReportLines(totals);
  if (!lines.length) return null;
  return (
    <section aria-label="Tarjetas de regalo" className="border-line bg-card rounded-md border p-3">
      <ul className="flex flex-col gap-1 text-sm">
        {lines.map((l) => (
          <li key={l.key} className="flex justify-between gap-2" data-testid={`gift-card-${l.key}`}>
            <span className="text-muted">{l.label}</span>
            <span className="font-semibold">{l.value}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
