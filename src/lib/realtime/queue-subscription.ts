/**
 * Suscripción a la señal `queue_changed` del canal `queue:<business_id>` (ADR-008).
 * Lógica pura (sin React) para poder probarla: recibe un cliente mínimo y callbacks.
 *
 * Reglas (REQ-011.1, REQ-011.2, NFR-002):
 *  - al recibir queue_changed → reload() con debounce de 300 ms
 *  - al conectar o reconectar (SUBSCRIBED) → reload() y onConnection(true)
 *  - en CHANNEL_ERROR / TIMED_OUT / CLOSED → onConnection(false)
 *  - polling de respaldo cada `pollMs` (por defecto 30 s)
 */
export type ChannelStatus = "SUBSCRIBED" | "TIMED_OUT" | "CLOSED" | "CHANNEL_ERROR";

export type MinimalChannel = {
  on: (
    type: "broadcast",
    filter: { event: string },
    cb: (msg: { payload?: unknown }) => void,
  ) => MinimalChannel;
  subscribe: (cb: (status: ChannelStatus) => void) => MinimalChannel;
};

export type MinimalClient = {
  channel: (name: string, opts?: { config?: { private?: boolean } }) => MinimalChannel;
  removeChannel: (ch: MinimalChannel) => unknown;
};

export type SubscriptionOptions = {
  client: MinimalClient;
  businessId: string;
  reload: () => void | Promise<void>;
  onConnection?: (online: boolean) => void;
  debounceMs?: number;
  pollMs?: number;
  setTimeoutFn?: typeof setTimeout;
  clearTimeoutFn?: typeof clearTimeout;
  setIntervalFn?: typeof setInterval;
  clearIntervalFn?: typeof clearInterval;
};

export function subscribeToQueue(opts: SubscriptionOptions): () => void {
  const {
    client,
    businessId,
    reload,
    onConnection,
    debounceMs = 300,
    pollMs = 30_000,
    setTimeoutFn = setTimeout,
    clearTimeoutFn = clearTimeout,
    setIntervalFn = setInterval,
    clearIntervalFn = clearInterval,
  } = opts;

  let debounce: ReturnType<typeof setTimeout> | undefined;
  let wasOnline: boolean | undefined;

  const scheduleReload = () => {
    if (debounce) clearTimeoutFn(debounce);
    debounce = setTimeoutFn(() => {
      debounce = undefined;
      void reload();
    }, debounceMs);
  };

  const channel = client
    .channel(`queue:${businessId}`, { config: { private: false } })
    .on("broadcast", { event: "queue_changed" }, () => scheduleReload())
    .subscribe((status) => {
      const online = status === "SUBSCRIBED";
      if (online) {
        // Conexión o reconexión: recargar el estado completo, no confiar en eventos perdidos
        void reload();
      }
      if (online !== wasOnline) {
        wasOnline = online;
        onConnection?.(online);
      }
    });

  const poll = pollMs > 0 ? setIntervalFn(() => void reload(), pollMs) : undefined;

  return () => {
    if (debounce) clearTimeoutFn(debounce);
    if (poll) clearIntervalFn(poll);
    client.removeChannel(channel);
  };
}
