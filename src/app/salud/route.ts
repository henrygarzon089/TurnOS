import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

/** NFR-012: comprueba que la app y la base de datos responden. */
export async function GET() {
  let db = false;
  try {
    const admin = createSupabaseAdminClient();
    const { error } = await admin.from("businesses").select("id", { head: true, count: "exact" });
    db = !error;
  } catch {
    db = false;
  }
  return NextResponse.json(
    { ok: db, db, at: new Date().toISOString() },
    { status: db ? 200 : 503, headers: { "Cache-Control": "no-store" } },
  );
}
