import type { Metadata } from "next";
import Link from "next/link";
import { AdminNav } from "@/components/admin/AdminNav";
import { CleaningHistory } from "@/components/cleaning/CleaningHistory";
import { CleaningInspection } from "@/components/cleaning/CleaningInspection";
import { CleaningListsEditor, CleaningSwitch } from "@/components/cleaning/CleaningListsEditor";
import { CleaningTasks } from "@/components/cleaning/CleaningTasks";
import { CleaningToday } from "@/components/cleaning/CleaningToday";
import { getCleaningHistory, getCleaningLists, getCleaningTasks, getCleaningToday } from "@/lib/actions/cleaning";
import { getStaffSession } from "@/lib/auth/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Limpieza" };

const TABS = [
  { key: "hoy", label: "Hoy" },
  { key: "revision", label: "Revisión" },
  { key: "tareas", label: "Tareas" },
  { key: "historial", label: "Historial" },
  { key: "listas", label: "Listas" },
] as const;
type Tab = (typeof TABS)[number]["key"];

/** REQ-060…REQ-064 para el dueño (design.md §16.6). Solo el dueño: lo asegura el layout de /admin. */
export default async function OwnerCleaningPage({
  searchParams,
}: {
  searchParams: Promise<{ pestana?: string; semanas?: string }>;
}) {
  const { pestana, semanas } = await searchParams;
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
      {tab === "revision" && (await inspectionTab(session.business.id))}
      {tab === "tareas" && (
        <CleaningTasks tasks={(await getCleaningTasks()) ?? []} businessId={session.business.id} />
      )}
      {tab === "historial" && (await historyTab(session.business.id, semanas))}
      {tab === "listas" && (
        <>
          <CleaningSwitch enabled={enabled} />
          {enabled && <CleaningListsEditor lists={(await getCleaningLists()) ?? {}} />}
        </>
      )}
    </main>
  );
}

/** REQ-063.1: la lista de Cierre, la de Entre clientes y los barberos activos para asignar fallas. */
async function inspectionTab(businessId: string) {
  const supabase = await createSupabaseServerClient();
  const [lists, { data: barbers }] = await Promise.all([
    getCleaningLists(),
    supabase
      .from("barbers")
      .select("id, display_name")
      .eq("business_id", businessId)
      .eq("is_active", true)
      .order("sort_order")
      .order("display_name"),
  ]);
  return (
    <CleaningInspection
      closing={lists?.closing ?? []}
      betweenClients={lists?.between_clients ?? []}
      barbers={(barbers ?? []).map((b) => ({ id: b.id as string, name: b.display_name as string }))}
      businessId={businessId}
    />
  );
}

const WEEK_OPTIONS = [8, 26, 52] as const;

/** REQ-063.5: 8 semanas por defecto; se puede ver hasta un año atrás. */
async function historyTab(businessId: string, semanas: string | undefined) {
  const weeks = WEEK_OPTIONS.find((n) => String(n) === semanas) ?? 8;
  const supabase = await createSupabaseServerClient();
  const [history, { data: barbers }] = await Promise.all([
    getCleaningHistory(weeks),
    supabase.from("barbers").select("id, display_name").eq("business_id", businessId),
  ]);
  return (
    <>
      <nav aria-label="Semanas del historial" className="mt-3 flex gap-2">
        {WEEK_OPTIONS.map((n) => (
          <Link
            key={n}
            href={`/admin/limpieza?pestana=historial&semanas=${n}`}
            aria-current={n === weeks ? "page" : undefined}
            className={`inline-flex min-h-10 items-center rounded-full border px-3 text-sm ${
              n === weeks ? "bg-ink text-card border-ink" : "border-line bg-card text-ink"
            }`}
          >
            {n} semanas
          </Link>
        ))}
      </nav>
      <CleaningHistory
        weeks={history ?? []}
        barberNames={Object.fromEntries((barbers ?? []).map((b) => [b.id as string, b.display_name as string]))}
      />
    </>
  );
}
