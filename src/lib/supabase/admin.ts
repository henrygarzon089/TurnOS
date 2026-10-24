import "server-only";

import { createClient } from "@supabase/supabase-js";

/**
 * Cliente con `service_role`: salta RLS. SOLO para las server actions públicas (tomar turno,
 * ver mi turno, pantalla) que validan la entrada y llaman funciones SQL seguras
 * (decisions.md ADR-009). Nunca se importa desde código de cliente: `server-only` lo impide
 * en tiempo de compilación.
 */
export function createSupabaseAdminClient() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) {
    throw new Error("Falta SUPABASE_SERVICE_ROLE_KEY en el servidor.");
  }
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
