import { adminDb, resetQueue, SEED } from "./helpers";

/**
 * Deja el negocio del seed listo para los E2E sin depender del reloj: fila abierta todo el día
 * (horario 00:00–23:59, sin override), fila vacía, barberos presentes hoy y E2E_SCREEN_KEY leída
 * de la base. Usa service_role (salta RLS), como el seed. El horario NO se restaura al terminar: si
 * otra corrida de Playwright va por la mitad, la cerraría. `supabase db reset` lo devuelve al seed.
 */
export default async function globalSetup() {
  const db = adminDb();
  const { data: biz, error } = await db
    .from("businesses")
    .select("id, screen_key")
    .eq("slug", SEED.slug)
    .single();
  if (error || !biz) throw new Error(`No está el negocio ${SEED.slug}: ¿se aplicó el seed?`);
  process.env.E2E_SCREEN_KEY ??= biz.screen_key;

  await must(
    db
      .from("business_hours")
      .update({ opens_at: "00:00", closes_at: "23:59", is_closed: false })
      .eq("business_id", biz.id),
  );
  await must(
    db
      .from("businesses")
      .update({ queue_override: "auto", queue_override_day: null })
      .eq("id", biz.id),
  );
  await resetQueue();
}

async function must(q: PromiseLike<{ error: { message: string } | null }>) {
  const { error } = await q;
  if (error) throw new Error(error.message);
}
