"use client";

import { createBrowserClient } from "@supabase/ssr";

/**
 * Cliente de Supabase para componentes del navegador (personal autenticado y suscripciones
 * Realtime). Usa la clave anónima: todo lo que lee pasa por RLS.
 */
export function createSupabaseBrowserClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
