import { getStaffSession } from "@/lib/auth/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * REQ-102.6 número de postulaciones nuevas junto a "Postulaciones" en el menú lateral. En su
 * propio Suspense; en cero o si falla la lectura, no se pinta.
 */
export async function NavJobsCount({
  load = countNewApplications,
}: {
  load?: () => Promise<number>;
}) {
  const count = await load().catch(() => 0);
  if (!count) return null;
  return (
    <span
      aria-label={`${count} ${count === 1 ? "postulación nueva" : "postulaciones nuevas"}`}
      data-testid="nav-badge-postulaciones"
      className="text-muted text-sm tabular-nums"
    >
      {count}
    </span>
  );
}

async function countNewApplications(): Promise<number> {
  const session = await getStaffSession();
  if (session?.role !== "owner") return 0;
  const supabase = await createSupabaseServerClient();
  const { count } = await supabase
    .from("job_applications")
    .select("id", { count: "exact", head: true })
    .eq("business_id", session.business.id)
    .eq("status", "nueva");
  return count ?? 0;
}
