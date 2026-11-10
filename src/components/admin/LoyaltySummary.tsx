import Link from "next/link";
import { Tag } from "@/components/admin/ModulePage";
import { formatCOP } from "@/lib/domain/money";

export type LoyaltyOverview = {
  enabled: boolean;
  visitsRequired: number;
  rewardType: "free_service" | "discount";
  rewardServiceName: string | null;
  rewardAmount: number | null;
};

export function rewardLabel(p: LoyaltyOverview): string {
  if (p.rewardType === "discount")
    return p.rewardAmount ? `${formatCOP(p.rewardAmount)} de descuento` : "Descuento";
  return p.rewardServiceName ? `${p.rewardServiceName} gratis` : "Servicio gratis";
}

/**
 * REQ-078.33 (T-180) Fidelidad en resumen, junto a Recordar como el tablero Dueno-Clientes:
 * cortes para el premio, premio y "Cambiar regla" (lleva al formulario de /admin/fidelidad).
 */
export function LoyaltySummary({ program }: { program: LoyaltyOverview }) {
  return (
    <section aria-label="Fidelidad" className="bg-card border-line min-w-0 rounded-md border">
      <div className="border-line flex min-h-14 items-center justify-between gap-2 border-b px-4 py-2">
        <h2 className="text-lg font-bold">Fidelidad</h2>
        <Tag tone={program.enabled ? "ok" : "muted"}>{program.enabled ? "Activa" : "Apagada"}</Tag>
      </div>
      <dl className="divide-line divide-y text-sm">
        <div className="flex items-center justify-between gap-3 px-4 py-3">
          <dt>Cortes para el premio</dt>
          <dd className="font-bold tabular-nums">{program.visitsRequired}</dd>
        </div>
        <div className="flex items-center justify-between gap-3 px-4 py-3">
          <dt>Premio</dt>
          <dd>{rewardLabel(program)}</dd>
        </div>
      </dl>
      <Link
        href="/admin/fidelidad"
        className="border-line text-ink flex min-h-12 items-center border-t px-4 text-sm font-semibold underline underline-offset-4"
      >
        Cambiar regla
      </Link>
    </section>
  );
}
