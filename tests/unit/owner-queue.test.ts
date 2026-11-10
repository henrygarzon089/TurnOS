import { describe, expect, it } from "vitest";
import { buildLanes, laneNow, laneOf, type LaneTicket } from "@/lib/domain/owner-queue";

const NOW = new Date("2026-11-08T20:40:00Z"); // 3:40 p. m. en Bogotá

const t = (over: Partial<LaneTicket>): LaneTicket => ({
  id: over.id ?? "t",
  displayNumber: 11,
  customerName: "Ana María Gómez",
  status: "waiting",
  preferredBarberId: null,
  assignedBarberId: null,
  calledAt: null,
  startedAt: null,
  ...over,
});

const barbers = [
  { id: "sebas", name: "Sebas", status: "busy" as const, isActive: true },
  { id: "juli", name: "Juli", status: "available" as const, isActive: true },
  { id: "mateo", name: "Mateo", status: "paused" as const, isActive: true },
  { id: "kevin", name: "Kevin", status: "off" as const, isActive: true },
  { id: "viejo", name: "Viejo", status: "off" as const, isActive: false },
];

describe("REQ-078.30 carriles de la fila del dueño", () => {
  it('REQ-078.30 un carril por barbero presente (o con turnos) y "El primero libre" al final', () => {
    const lanes = buildLanes(barbers, [t({ id: "a", preferredBarberId: "kevin" })]);
    expect(lanes.map((l) => l.id)).toEqual(["sebas", "juli", "mateo", "kevin", "free"]);
    expect(lanes.at(-1)!.title).toBe("El primero libre");
  });

  it("REQ-078.30 el turno va al carril de quien lo atiende, si no al que prefiere, si no al libre", () => {
    expect(laneOf(t({ assignedBarberId: "juli", preferredBarberId: "sebas" }))).toBe("juli");
    expect(laneOf(t({ preferredBarberId: "sebas" }))).toBe("sebas");
    expect(laneOf(t({}))).toBe("free");
  });

  it("REQ-078.30 el bloque fijo dice a quién atiende, con nombre corto y minutos", () => {
    const serving = t({ status: "in_service", startedAt: "2026-11-08T20:18:00Z" });
    expect(laneNow(barbers[0], [serving], NOW)).toEqual([
      { tone: "serving", text: "Atiende 11 · Ana M. · 22 min" },
    ]);
  });

  it("REQ-078.30 el llamado va en rojo suave con los minutos desde el llamado", () => {
    const called = t({
      status: "called",
      displayNumber: 14,
      customerName: "juan pablo",
      calledAt: "2026-11-08T20:39:00Z",
    });
    expect(laneNow(barbers[1], [called], NOW)).toEqual([
      { tone: "called", text: "Llamó a 14 · Juan P. · 1 min" },
    ]);
  });

  it("REQ-078.30 sin turno en la silla dice el estado del barbero", () => {
    expect(laneNow(barbers[1], [t({})], NOW)).toEqual([{ tone: "free", text: "Libre" }]);
    expect(laneNow(barbers[2], [], NOW)).toEqual([{ tone: "paused", text: "En pausa" }]);
    expect(laneNow(barbers[3], [], NOW)).toEqual([{ tone: "off", text: "No está" }]);
  });

  it('REQ-078.30 "El primero libre" dice quiénes están libres para tomarlo', () => {
    expect(laneNow(null, [], NOW, barbers)).toEqual([{ tone: "free", text: "Libre ahora: Juli" }]);
    expect(laneNow(null, [], NOW, [barbers[0]])).toEqual([
      { tone: "off", text: "Nadie libre ahora" },
    ]);
  });
});
