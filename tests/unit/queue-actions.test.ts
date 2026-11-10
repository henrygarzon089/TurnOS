import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * design.md §12.4: toda acción que cambia la fila llama `afterQueueChange`. Corre las acciones de
 * verdad con Supabase falso. La lista exhaustiva obliga a clasificar cualquier acción nueva.
 */
const m = vi.hoisted(() => ({
  afterQueueChange: vi.fn(),
  session: vi.fn(),
  rpc: vi.fn(),
  joinQueue: vi.fn(),
  cancelTicketByToken: vi.fn(),
  registerNewTicket: vi.fn(),
  ticketBusinessId: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({ headers: async () => new Headers() }));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));
vi.mock("@/lib/notifications/after-queue-change", () => ({
  afterQueueChange: m.afterQueueChange,
}));
vi.mock("@/lib/auth/session", () => ({
  getStaffSession: m.session,
  barberEmailFromPhone: vi.fn(),
}));
vi.mock("@/lib/db/supabase-gateway", () => ({ createAdminGateway: () => ({ rpc: vi.fn() }) }));
vi.mock("@/lib/supabase/admin", () => ({ createSupabaseAdminClient: vi.fn() }));
vi.mock("@/lib/queue/public-queue", () => ({
  joinQueue: m.joinQueue,
  cancelTicketByToken: m.cancelTicketByToken,
  registerNewTicket: m.registerNewTicket,
  ticketBusinessId: m.ticketBusinessId,
}));
vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: async () => {
    const chain = {
      update: () => chain,
      eq: () => chain,
      then: (done: (r: { error: null; count: number }) => unknown) =>
        Promise.resolve({ error: null, count: 1 }).then(done),
    };
    return { rpc: m.rpc, from: () => chain };
  },
}));

import * as queueActions from "@/lib/actions/queue";
import * as publicActions from "@/lib/actions/public";

const BUSINESS = "biz-1";
const TICKET = "ticket-1";

const QUEUE_CHANGES: Record<string, () => Promise<{ ok: boolean }>> = {
  callNext: () => queueActions.callNext(),
  callNextFor: () => queueActions.callNextFor("barber-1"),
  startService: () => queueActions.startService(TICKET),
  finishService: () => queueActions.finishService(TICKET),
  markNoShow: () => queueActions.markNoShow(TICKET),
  setMyStatus: () => queueActions.setMyStatus("paused"),
  callTicket: () => queueActions.callTicket(TICKET, "barber-1"),
  uncallTicket: () => queueActions.uncallTicket(TICKET),
  cancelTicket: () => queueActions.cancelTicket(TICKET),
  reassignTicket: () => queueActions.reassignTicket(TICKET, null),
  moveTicket: () => queueActions.moveTicket(TICKET, null),
  addManualTicket: () => queueActions.addManualTicket({ name: "Ana", serviceId: "s" }),
  markAppointmentArrived: () => queueActions.markAppointmentArrived("appointment-1"),
};

/** No mueven a nadie en la fila. `setQueueOverride` solo cancela, como `close_expired_queues`. */
const NO_QUEUE_CHANGE = [
  "getBusinessQueue",
  "getMyQueue",
  "markCourtesyServed",
  "markNotified",
  "setQueueOverride",
];

beforeEach(() => {
  vi.clearAllMocks();
  m.session.mockResolvedValue({
    role: "owner",
    barberId: "barber-1",
    business: { id: BUSINESS, name: "La 33", slug: "la-33" },
  });
  m.rpc.mockResolvedValue({ data: { business_id: BUSINESS, public_token: "tok" }, error: null });
  m.registerNewTicket.mockResolvedValue(BUSINESS);
  m.ticketBusinessId.mockResolvedValue(BUSINESS);
});

describe("REQ-040.1 / REQ-040.5 toda acción de la fila llama afterQueueChange", () => {
  it("REQ-040.1 cada acción exportada de la fila está clasificada", () => {
    expect(Object.keys(queueActions).sort()).toEqual(
      [...Object.keys(QUEUE_CHANGES), ...NO_QUEUE_CHANGE].sort(),
    );
  });

  it.each(Object.keys(QUEUE_CHANGES))("REQ-040.1 REQ-040.5 %s lo llama", async (name) => {
    expect(await QUEUE_CHANGES[name]()).toEqual({ ok: true });
    expect(m.afterQueueChange).toHaveBeenCalledExactlyOnceWith(BUSINESS);
  });

  it.each(Object.keys(QUEUE_CHANGES).filter((n) => n !== "reassignTicket"))(
    "REQ-040.1 %s no lo llama si la acción falla",
    async (name) => {
      m.rpc.mockResolvedValue({ data: null, error: { code: "P0004" } });
      expect((await QUEUE_CHANGES[name]()).ok).toBe(false);
      expect(m.afterQueueChange).not.toHaveBeenCalled();
    },
  );

  it("REQ-052.4 si nadie cabe antes de la cita, 'Llamar al siguiente' dice a qué hora es", async () => {
    m.rpc.mockResolvedValue({
      data: null,
      error: { code: "P0006", message: "NEXT_APPOINTMENT", details: "15:30" },
    });
    expect(await queueActions.callNext()).toEqual({
      ok: false,
      error: "Tu próxima cita es a las 3:30 p. m.",
      code: "P0006",
    });
  });

  it("REQ-078.17 'Llamar a <número>' envía el turno que la pantalla muestra", async () => {
    m.rpc.mockResolvedValue({ data: { business_id: "biz-1" }, error: null });
    expect((await queueActions.callNext(TICKET)).ok).toBe(true);
    expect(m.rpc).toHaveBeenCalledWith("call_next", { p_expected: TICKET });
  });

  it("REQ-078.17 si ese turno ya no es el primero, lo dice sin llamar a otro", async () => {
    m.rpc.mockResolvedValue({ data: null, error: { code: "P0006", message: "NOT_NEXT" } });
    expect(await queueActions.callNext(TICKET)).toEqual({
      ok: false,
      error: "Ese turno ya no es el siguiente.",
      code: "P0006",
    });
  });

  it("REQ-052.2 'Llegó' tarde o repetido sale en español", async () => {
    m.rpc.mockResolvedValue({ data: null, error: { code: "P0004", message: "NOT_ARRIVABLE" } });
    expect(await queueActions.markAppointmentArrived("appointment-1")).toEqual({
      ok: false,
      error: "Esa cita ya no está pendiente hoy.",
      code: "P0004",
    });
  });

  it("REQ-040.2 el turno manual se registra antes de revisar la fila", async () => {
    await queueActions.addManualTicket({ name: "Ana", serviceId: "s" });
    expect(m.registerNewTicket).toHaveBeenCalledWith(expect.anything(), "tok", false);
    expect(m.registerNewTicket.mock.invocationCallOrder[0]).toBeLessThan(
      m.afterQueueChange.mock.invocationCallOrder[0],
    );
  });
});

describe("REQ-040.1 / REQ-040.2 acciones públicas", () => {
  const input = {
    slug: "la-33",
    name: "Ana",
    phone: "3001110001",
    serviceId: "s",
    privacyAccepted: true,
  };

  it("REQ-040.2 tomar turno registra el turno nuevo y revisa la fila", async () => {
    m.joinQueue.mockResolvedValue({ ok: true, token: "tok", existing: false });

    expect(await publicActions.joinQueue(input)).toEqual({
      ok: true,
      token: "tok",
      existing: false,
    });

    expect(m.registerNewTicket).toHaveBeenCalledWith(expect.anything(), "tok", false);
    expect(m.afterQueueChange).toHaveBeenCalledExactlyOnceWith(BUSINESS);
  });

  it("REQ-040.2 un turno rechazado no registra nada", async () => {
    m.joinQueue.mockResolvedValue({ ok: false, error: "Cerrado" });

    await publicActions.joinQueue(input);

    expect(m.registerNewTicket).not.toHaveBeenCalled();
    expect(m.afterQueueChange).not.toHaveBeenCalled();
  });

  it('REQ-040.1 cancelar desde "Mi turno" revisa la fila', async () => {
    m.cancelTicketByToken.mockResolvedValue({ ok: true });

    expect(await publicActions.cancelTicketByToken("tok")).toEqual({ ok: true });

    expect(m.afterQueueChange).toHaveBeenCalledExactlyOnceWith(BUSINESS);
  });

  it("REQ-040.1 si no se pudo cancelar no revisa la fila", async () => {
    m.cancelTicketByToken.mockResolvedValue({ ok: false, error: "Ya no" });

    await publicActions.cancelTicketByToken("tok");

    expect(m.afterQueueChange).not.toHaveBeenCalled();
  });
});
