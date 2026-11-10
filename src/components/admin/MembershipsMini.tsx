import Link from "next/link";
import { Panel, Tag } from "@/components/admin/ModulePage";
import type { MembershipsView } from "@/lib/actions/memberships";
import { familyQuota, familyUsed } from "@/lib/domain/owner-tables";

/**
 * REQ-078.33 (T-180) Membresías en corto (Familia · Usó · Cuota), junto a Tarjetas de regalo como
 * el tablero Dueno-Clientes. Las acciones viven en /admin/membresias.
 */
export function MembershipsMini({ view, limit = 5 }: { view: MembershipsView; limit?: number }) {
  const families = view.families.slice(0, limit);
  return (
    <Panel
      title="Membresías"
      actions={
        <Link href="/admin/membresias" className="btn-secondary w-auto px-4 text-base">
          Ver familias
        </Link>
      }
    >
      {families.length === 0 ? (
        <p className="text-muted px-4 py-4 text-sm">Todavía no hay familias.</p>
      ) : (
        <table className="w-full text-sm" aria-label="Membresías en corto">
          <thead className="bg-brand text-brand-ink text-left text-xs">
            <tr>
              <th className="px-4 py-2 font-bold">Familia</th>
              <th className="px-3 py-2 text-right font-bold">Usó</th>
              <th className="px-4 py-2 font-bold">Cuota</th>
            </tr>
          </thead>
          <tbody className="divide-line divide-y">
            {families.map((f) => {
              const q = familyQuota(f.current, view.today);
              return (
                <tr key={f.id}>
                  <td className="px-4 py-3">
                    <strong>{f.holderName ?? "Sin titular"}</strong>
                    <span className="text-muted"> · {f.members.length}</span>
                  </td>
                  <td className="px-3 py-3 text-right tabular-nums">{familyUsed(f.current)}</td>
                  <td className="px-4 py-3">
                    <Tag tone={q.tone}>{q.label}</Tag>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </Panel>
  );
}
