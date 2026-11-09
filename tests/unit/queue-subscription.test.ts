import { describe, expect, it, vi } from "vitest";
import {
  subscribeToQueue,
  type ChannelStatus,
  type MinimalChannel,
  type MinimalClient,
} from "@/lib/realtime/queue-subscription";

function fakeClient() {
  let broadcastCb: ((msg: { payload?: unknown }) => void) | undefined;
  let statusCb: ((s: ChannelStatus) => void) | undefined;
  const channel: MinimalChannel = {
    on: (_t, _f, cb) => {
      broadcastCb = cb;
      return channel;
    },
    subscribe: (cb) => {
      statusCb = cb;
      return channel;
    },
  };
  const removeChannel = vi.fn();
  const client: MinimalClient = {
    channel: vi.fn(() => channel),
    removeChannel,
  };
  return {
    client,
    removeChannel,
    emit: () => broadcastCb?.({ payload: { type: "queue_changed" } }),
    status: (s: ChannelStatus) => statusCb?.(s),
  };
}

describe("ADR-008 suscripción a queue_changed", () => {
  it("REQ-004.2 recarga al recibir queue_changed (con debounce)", () => {
    vi.useFakeTimers();
    const f = fakeClient();
    const reload = vi.fn();
    subscribeToQueue({ client: f.client, businessId: "b1", reload, pollMs: 0 });
    expect(f.client.channel).toHaveBeenCalledWith("queue:b1", { config: { private: false } });
    f.emit();
    f.emit();
    f.emit();
    expect(reload).not.toHaveBeenCalled();
    vi.advanceTimersByTime(300);
    expect(reload).toHaveBeenCalledTimes(1);
    vi.useRealTimers();
  });

  it("REQ-011.1 / REQ-011.2 avisa sin conexión y recarga al reconectar", () => {
    vi.useFakeTimers();
    const f = fakeClient();
    const reload = vi.fn();
    const onConnection = vi.fn();
    subscribeToQueue({ client: f.client, businessId: "b1", reload, onConnection, pollMs: 0 });
    f.status("SUBSCRIBED");
    expect(onConnection).toHaveBeenLastCalledWith(true);
    expect(reload).toHaveBeenCalledTimes(1);
    f.status("CHANNEL_ERROR");
    expect(onConnection).toHaveBeenLastCalledWith(false);
    f.status("TIMED_OUT");
    expect(onConnection).toHaveBeenCalledTimes(2); // no repite el mismo estado
    f.status("SUBSCRIBED");
    expect(onConnection).toHaveBeenLastCalledWith(true);
    expect(reload).toHaveBeenCalledTimes(2); // recarga completa al reconectar
    vi.useRealTimers();
  });

  it("REQ-078.8 un primer intento que vence en red lenta no prende la franja (no mueve la página)", () => {
    const f = fakeClient();
    const onConnection = vi.fn();
    subscribeToQueue({
      client: f.client,
      businessId: "b1",
      reload: vi.fn(),
      onConnection,
      pollMs: 0,
    });
    f.status("TIMED_OUT");
    f.status("CHANNEL_ERROR");
    expect(onConnection).not.toHaveBeenCalled(); // la página acaba de llegar del servidor
    f.status("SUBSCRIBED");
    f.status("CLOSED");
    expect(onConnection.mock.calls).toEqual([[true], [false]]); // ya conectado, sí avisa
  });

  it("NFR-003 polling de respaldo y limpieza al desmontar", () => {
    vi.useFakeTimers();
    const f = fakeClient();
    const reload = vi.fn();
    const stop = subscribeToQueue({ client: f.client, businessId: "b1", reload, pollMs: 1000 });
    vi.advanceTimersByTime(3000);
    expect(reload).toHaveBeenCalledTimes(3);
    stop();
    vi.advanceTimersByTime(3000);
    expect(reload).toHaveBeenCalledTimes(3);
    expect(f.removeChannel).toHaveBeenCalledTimes(1);
    vi.useRealTimers();
  });
});

describe("REQ-011.7 relectura al volver a primer plano", () => {
  function fakePage() {
    const doc = Object.assign(new EventTarget(), {
      visibilityState: "visible" as DocumentVisibilityState,
    });
    const win = new EventTarget();
    return {
      doc,
      win,
      hide: () => {
        doc.visibilityState = "hidden";
        doc.dispatchEvent(new Event("visibilitychange"));
      },
      show: () => {
        doc.visibilityState = "visible";
        doc.dispatchEvent(new Event("visibilitychange"));
      },
      pageshow: () => win.dispatchEvent(new Event("pageshow")),
    };
  }

  it("REQ-011.7 al ocultar y mostrar la pestaña relee una sola vez (con pageshow junto)", () => {
    vi.useFakeTimers();
    const f = fakeClient();
    const page = fakePage();
    const reload = vi.fn();
    subscribeToQueue({
      client: f.client,
      businessId: "b1",
      reload,
      pollMs: 0,
      visibilityTarget: page.doc,
      pageShowTarget: page.win,
    });
    page.hide();
    vi.advanceTimersByTime(1000);
    expect(reload).not.toHaveBeenCalled(); // ocultarla no relee
    page.show();
    page.pageshow(); // el navegador puede mandar los dos avisos juntos
    expect(reload).not.toHaveBeenCalled(); // pasa por la misma espera de 300 ms
    vi.advanceTimersByTime(300);
    expect(reload).toHaveBeenCalledTimes(1);
    vi.useRealTimers();
  });

  it("REQ-011.7 al desmontar deja de escuchar la visibilidad", () => {
    vi.useFakeTimers();
    const f = fakeClient();
    const page = fakePage();
    const reload = vi.fn();
    const stop = subscribeToQueue({
      client: f.client,
      businessId: "b1",
      reload,
      pollMs: 0,
      visibilityTarget: page.doc,
      pageShowTarget: page.win,
    });
    stop();
    page.hide();
    page.show();
    page.pageshow();
    vi.advanceTimersByTime(1000);
    expect(reload).not.toHaveBeenCalled();
    vi.useRealTimers();
  });
});
