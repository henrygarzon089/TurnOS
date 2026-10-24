/**
 * Crea en un proyecto REAL de Supabase los usuarios de Auth que supabase/seed.sql da por
 * existentes (mismos UUID). Solo para desarrollo / demo. Uso:
 *
 *   NEXT_PUBLIC_SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... pnpm tsx scripts/seed-users.ts
 *
 * Luego aplica supabase/seed.sql al proyecto (supabase db push + seed, o el MCP de Supabase).
 * En la base local NO hace falta: el seed inserta las filas en el shim de auth.users.
 */
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Faltan NEXT_PUBLIC_SUPABASE_URL y/o SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const supabase = createClient(url, key, { auth: { persistSession: false } });

// Misma convención que ADR-010: barbero = <E.164 sin +>@barberos.turnos.local, contraseña = PIN.
const users = [
  { id: "a0000000-0000-4000-8000-000000000001", email: "dueno@la33.test", password: "turnos123" },
  ...[1, 2, 3, 4, 5].map((n) => ({
    id: `b0000000-0000-4000-8000-00000000000${n}`,
    email: `57300100000${n}@barberos.turnos.local`,
    password: String(n).repeat(6),
  })),
];

for (const u of users) {
  const { error } = await supabase.auth.admin.createUser({
    id: u.id,
    email: u.email,
    password: u.password,
    email_confirm: true,
  });
  if (error && !/already|exists/i.test(error.message)) {
    console.error(`✗ ${u.email}: ${error.message}`);
    process.exit(1);
  }
  console.log(`✓ ${u.email}`);
}
