/**
 * Puerta mínima a las funciones SQL públicas. Permite probar la lógica de las server actions
 * contra Postgres local (pruebas de integración) y usar Supabase con service_role en producción.
 */
export type RpcArgs = Record<string, unknown>;

export interface Gateway {
  /** Llama una función SQL que devuelve un escalar/jsonb. Lanza con `code` SQLSTATE si falla. */
  rpc<T = unknown>(fn: string, args: RpcArgs): Promise<T>;
}

export class GatewayError extends Error {
  constructor(
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "GatewayError";
  }
}
