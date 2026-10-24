import { describe, expect, it, vi } from "vitest";
import { NetworkError, withRetry } from "@/lib/net/retry";

describe("REQ-011.3 reintento de acciones del barbero", () => {
  it("reintenta hasta 3 veces con espera creciente ante errores de red", async () => {
    const waits: number[] = [];
    const sleep = async (ms: number) => {
      waits.push(ms);
    };
    let calls = 0;
    const fn = vi.fn(async () => {
      calls++;
      if (calls < 3) throw new NetworkError("fetch failed");
      return "ok";
    });
    await expect(withRetry(fn, { sleep })).resolves.toBe("ok");
    expect(fn).toHaveBeenCalledTimes(3);
    expect(waits).toEqual([500, 1000]);
  });

  it("tras 3 fallos de red lanza el último error", async () => {
    const fn = vi.fn(async () => {
      throw new NetworkError("fetch failed");
    });
    await expect(withRetry(fn, { sleep: async () => {} })).rejects.toBeInstanceOf(NetworkError);
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it("no reintenta errores de negocio (BARBER_BUSY, etc.)", async () => {
    const fn = vi.fn(async () => {
      throw new Error("BARBER_BUSY");
    });
    await expect(withRetry(fn, { sleep: async () => {} })).rejects.toThrow("BARBER_BUSY");
    expect(fn).toHaveBeenCalledTimes(1);
  });
});
