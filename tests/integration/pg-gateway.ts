import { GatewayError, type Gateway, type RpcArgs } from "@/lib/db/gateway";
import type { Q } from "./db";

/**
 * Gateway de pruebas: llama las funciones SQL directamente en Postgres local, dentro de la
 * transacción de la prueba. Los argumentos se pasan por nombre (p_x => $n).
 */
export function createPgGateway(q: Q): Gateway {
  return {
    async rpc<T>(fn: string, args: RpcArgs): Promise<T> {
      const keys = Object.keys(args);
      const named = keys.map((k, i) => `${k} => $${i + 1}`).join(", ");
      try {
        const { rows } = await q<{ result: T }>(
          `select ${fn}(${named}) as result`,
          keys.map((k) => args[k]),
        );
        return rows[0]?.result as T;
      } catch (e) {
        const err = e as { code?: string; message?: string };
        throw new GatewayError(err.code ?? "UNKNOWN", err.message ?? "error");
      }
    },
  };
}
