import { loyaltyText, type LoyaltyStatus } from "@/lib/domain/loyalty";

/** REQ-019.7 progreso "7 de 10 cortes" y REQ-019.3 premio disponible. */
export function StampCard({
  status,
  compact = false,
}: {
  status: LoyaltyStatus | null;
  compact?: boolean;
}) {
  const text = loyaltyText(status);
  if (!status || !text) return null;
  const filled = Math.min(status.stamps, status.required);

  return (
    <section
      aria-label="Tarjeta de fidelidad"
      className={`border-line bg-card rounded-xl border ${compact ? "p-3" : "p-4"}`}
    >
      {text.reward ? (
        <p className="text-ok text-lg font-bold">{text.reward}</p>
      ) : (
        <p className="font-semibold">{text.progress}</p>
      )}
      {status.required <= 20 && (
        <ol className="mt-2 flex flex-wrap gap-1.5" aria-hidden="true">
          {Array.from({ length: status.required }, (_, i) => (
            <li
              key={i}
              className={`h-5 w-5 rounded-full border-2 ${
                i < filled ? "border-accent bg-accent" : "border-line bg-surface"
              }`}
            />
          ))}
        </ol>
      )}
      {text.reward && <p className="text-muted mt-1 text-xs">{text.progress}</p>}
    </section>
  );
}
