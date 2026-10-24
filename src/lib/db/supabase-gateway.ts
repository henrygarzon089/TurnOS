import "server-only";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { GatewayError, type Gateway, type RpcArgs } from "./gateway";

/** Gateway de producción: funciones SQL vía PostgREST con service_role (ADR-009). */
export function createAdminGateway(): Gateway {
  const admin = createSupabaseAdminClient();
  return {
    async rpc<T>(fn: string, args: RpcArgs): Promise<T> {
      const { data, error } = await admin.rpc(fn, args);
      if (error) {
        // PostgREST expone el SQLSTATE en `code`
        throw new GatewayError(error.code ?? "UNKNOWN", error.message);
      }
      return data as T;
    },
  };
}
