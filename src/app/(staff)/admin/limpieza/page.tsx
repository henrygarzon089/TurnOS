import type { Metadata } from "next";
import Link from "next/link";
import { AdminNav } from "@/components/admin/AdminNav";
import { CleaningListsEditor, CleaningSwitch } from "@/components/cleaning/CleaningListsEditor";
import { CleaningToday } from "@/components/cleaning/CleaningToday";
import { getCleaningLists, getCleaningToday } from "@/lib/actions/cleaning";
import { getStaffSession } from "@/lib/auth/session";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Limpieza" };

const TABS = [
  { key: "hoy", label: "Hoy" },
  { key: "listas", label: "Listas" },
] as const;
type Tab = (typeof TABS)[number]["key"];

/** REQ-060…REQ-064 para el dueño (design.md §16.6). Solo el dueño: lo asegura el layout de /admin. */
export default async function OwnerCleaningPage({
  searchParams,
}: {
  searchParams: Promise<{ pestana?: string }>;
}) {
  const { pestana } = await searchParams;
  const session = (await getStaffSession())!;
  const today = await getCleaningToday();
  const enabled = Boolean(today?.enabled);
  // Apagada solo se muestran el interruptor y las listas
  const tab: Tab = !enabled ? "listas" : TABS.some((t) => t.key === pestana) ? (pestana as Tab) : "hoy";

  return (
    <main className="pb-6">
      <AdminNav current="/admin/limpieza" />
      <h1 className="text-2xl font-bold">Limpieza</h1>
      {enabled && (
        <nav aria-label="Pestañas de limpieza" className="mt-3 flex gap-2 overflow-x-auto">
          {TABS.map((t) => (
            <Link
              key={t.key}
              href={`/admin/limpieza?pestana=${t.key}`}
              aria-current={tab === t.key ? "page" : undefined}
              className={`inline-flex min-h-10 items-center rounded-full border px-4 text-sm font-semibold ${
                tab === t.key ? "bg-ink text-card border-ink" : "border-line bg-card text-ink"
              }`}
            >
              {t.label}
            </Link>
          ))}
        </nav>
      )}
      {tab === "hoy" && today?.enabled && <CleaningToday today={today} businessId={session.business.id} />}
      {tab === "listas" && (
        <>
          <CleaningSwitch enabled={enabled} />
          {enabled && <CleaningListsEditor lists={(await getCleaningLists()) ?? {}} />}
        </>
      )}
    </main>
  );
}
