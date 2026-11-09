import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/admin/PageHeader";
import { SectionTabs } from "@/components/admin/SectionTabs";
import { CleaningHistory } from "@/components/cleaning/CleaningHistory";
import { CleaningInspection } from "@/components/cleaning/CleaningInspection";
import { CleaningListsEditor, CleaningSwitch } from "@/components/cleaning/CleaningListsEditor";
import { CleaningTasks } from "@/components/cleaning/CleaningTasks";
import { CleaningToday, type RecordThumb } from "@/components/cleaning/CleaningToday";
import {
  getCleaningHistory,
  getCleaningLists,
  getCleaningTasks,
  getCleaningToday,
  getRecordDetail,
  type CleaningToday as Today,
} from "@/lib/actions/cleaning";
import { getStaffSession } from "@/lib/auth/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Limpieza" };

// Nombres del tablero Dueno-Local donde la app tiene lo mismo (design §22.8)
const TABS = [
  { key: "hoy", label: "Hoy" },
  { key: "revision", label: "Fallas por barbero" },
  { key: "tareas", label: "Tareas periódicas" },
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
  const tab: Tab = !enabled
    ? "listas"
    : TABS.some((t) => t.key === pestana)
      ? (pestana as Tab)
      : "hoy";

  return (
    <main className="pb-6">
      <PageHeader
        title="Limpieza"
        subtitle="Revisión de fotos, fallas por barbero, tareas periódicas y PDF."
      />
      {enabled && (
        <SectionTabs
          label="Pestañas de limpieza"
          current={`/admin/limpieza?pestana=${tab}`}
          tabs={TABS.map((t) => ({ href: `/admin/limpieza?pestana=${t.key}`, label: t.label }))}
        />
      )}
      {tab === "hoy" && today?.enabled && (
        <CleaningToday
          today={today}
          businessId={session.business.id}
          thumbs={await todayThumbs(today)}
        />
      )}
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

/** Miniatura y "N de M" de cada registro de hoy (REQ-063.6, fotos firmadas por 1 hora). */
async function todayThumbs(today: Extract<Today, { enabled: true }>) {
  const records = [today.opening, today.closing, today.deep].filter((r) => r !== null);
  const details = await Promise.all(records.map((r) => getRecordDetail(r.id)));
  const thumbs: Record<string, RecordThumb> = {};
  for (const d of details) {
    if (!d) continue;
    thumbs[d.id] = {
      photoUrl: d.photoUrls[0] ?? null,
      done: d.items.filter((i) => i.done).length,
      total: d.items.length,
    };
  }
  return thumbs;
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
      <nav aria-label="Semanas del historial" className="mt-4 flex gap-2">
        {WEEK_OPTIONS.map((n) => (
          <Link
            key={n}
            href={`/admin/limpieza?pestana=historial&semanas=${n}`}
            aria-current={n === weeks ? "page" : undefined}
            className={`inline-flex min-h-12 items-center rounded-sm px-3 text-base ${
              n === weeks
                ? "border-brand bg-brand-soft text-ink border-2 font-bold"
                : "border-line-strong bg-card text-ink border"
            }`}
          >
            {n} semanas
          </Link>
        ))}
      </nav>
      <CleaningHistory
        weeks={history ?? []}
        barberNames={Object.fromEntries(
          (barbers ?? []).map((b) => [b.id as string, b.display_name as string]),
        )}
      />
    </>
  );
}
