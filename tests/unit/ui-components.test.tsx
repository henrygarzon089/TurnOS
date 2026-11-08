import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { Button, createOnceGuard } from "@/components/ui/Button";
import { ConnectionBanner } from "@/components/ui/ConnectionBanner";
import { EmptyState, ErrorState } from "@/components/ui/States";
import { FlashRow } from "@/components/ui/FlashRow";
import { PinField } from "@/components/ui/PinField";
import { StatusChip, type ChipStatus } from "@/components/ui/StatusChip";
import { formatPhoneTyping } from "@/lib/domain/phone";

const html = (el: React.ReactElement) => renderToStaticMarkup(el);
/** Texto que se ve: sin etiquetas ni lo que solo oyen los lectores de pantalla. */
const visible = (h: string) =>
  h
    .replace(/<span class="sr-only">[^<]*<\/span>/g, "")
    .replace(/<[^>]+>/g, "")
    .trim();

describe("Button", () => {
  it("REQ-078.5 mide al menos 48 px y el gigante 80 px", () => {
    expect(html(<Button>Tomar turno</Button>)).toContain("min-h-12");
    expect(html(<Button size="giant">Llamar a A14</Button>)).toContain("min-h-20");
  });

  it("REQ-078.3 el destructivo es de contorno rojo, nunca relleno", () => {
    const h = html(<Button variant="danger">Cancelar turno</Button>);
    expect(h).toContain("border-danger");
    expect(h).toContain("text-danger");
    expect(h).not.toMatch(/bg-(accent|danger|called)(?![\w-])/);
  });

  it('REQ-078.9 guardando: deshabilitado, aria-busy y "Guardando…"', () => {
    const h = html(<Button pending>Cobrar $ 29.000</Button>);
    expect(h).toContain("disabled");
    expect(h).toContain('aria-busy="true"');
    expect(visible(h)).toBe("Guardando…");
  });

  it("REQ-078.9 el candado no deja enviar dos veces mientras la acción sigue en curso", async () => {
    let finish!: () => void;
    const action = vi.fn(() => new Promise<void>((r) => (finish = r)));
    const run = createOnceGuard();
    const first = run(action);
    void run(action);
    void run(action);
    expect(action).toHaveBeenCalledTimes(1);
    finish();
    await first;
    void run(action);
    expect(action).toHaveBeenCalledTimes(2);
  });
});

describe("StatusChip", () => {
  const all: ChipStatus[] = ["waiting", "called", "in_service", "done", "cancelled", "no_show"];

  it("REQ-078.3 solo el turno llamado va en rojo relleno", () => {
    for (const s of all) {
      const h = html(<StatusChip status={s} />);
      if (s === "called") expect(h).toContain("bg-called");
      else expect(h).not.toMatch(/bg-(called|accent)(?![\w-])/);
    }
  });

  it("REQ-078.3 el estado nunca es solo color: lleva ícono y texto", () => {
    for (const s of all) {
      const h = html(<StatusChip status={s} />);
      expect(h).toContain("<svg");
      expect(visible(h).length).toBeGreaterThan(2);
    }
    expect(visible(html(<StatusChip status="appointment" time="3:30 p. m." />))).toBe(
      "Cita 3:30 p. m.",
    );
  });
});

describe("PinField", () => {
  it("REQ-078.7 muestra un punto por dígito y nunca los dígitos", () => {
    const h = html(<PinField label="Tu PIN" value="123" onChange={() => {}} />);
    expect(visible(h)).not.toMatch(/\d/);
    expect((visible(h).match(/●/g) ?? []).length).toBe(3);
    expect(h).toContain('type="password"');
    expect(h).toContain('inputMode="numeric"');
  });

  it("REQ-078.7 con error marca las seis casillas y dice qué pasó", () => {
    const h = html(
      <PinField label="Tu PIN" value="123456" onChange={() => {}} error="Ese PIN no es." />,
    );
    expect((h.match(/border-danger/g) ?? []).length).toBe(6);
    expect(visible(h)).toContain("Ese PIN no es.");
    expect(h).toContain('aria-invalid="true"');
  });
});

describe("Vacío y error", () => {
  it("REQ-078.11 el vacío dice qué pasa y qué hacer", () => {
    const h = html(
      <EmptyState
        title="Todavía no hay turnos"
        text="Comparte el QR del local para que la gente tome turno."
        action={<button type="button">Ver QR</button>}
      />,
    );
    expect(visible(h)).toContain("Todavía no hay turnos");
    expect(visible(h)).toContain("Comparte el QR");
    expect(visible(h)).toContain("Ver QR");
  });

  it('REQ-078.11 el error ofrece "Intentar de nuevo" y solo promete datos a salvo si es cierto', () => {
    const safe = html(<ErrorState title="No pudimos cargar la fila" dataSafe onRetry={() => {}} />);
    expect(visible(safe)).toContain("Intentar de nuevo");
    expect(visible(safe)).toContain("Tus datos no se perdieron");
    const unsure = html(<ErrorState title="No se guardó" onRetry={() => {}} />);
    expect(visible(unsure)).not.toContain("no se perdieron");
  });
});

describe("Sin conexión", () => {
  it("REQ-078.10 dice que muestra lo último que vio y a qué hora", () => {
    const at = new Date("2026-11-07T20:40:00Z"); // 3:40 p. m. en Bogotá
    expect(visible(html(<ConnectionBanner online={false} lastSeen={at} />))).toBe(
      "Sin conexión. Mostrando lo último que vimos · 3:40 p. m.",
    );
    expect(html(<ConnectionBanner online />)).toBe("");
  });
});

describe("Tiempo real", () => {
  it("REQ-078.12 la fila nueva entra resaltada y la vieja no", () => {
    expect(html(<FlashRow flash>A20 Dani C.</FlashRow>)).toContain("animate-flash");
    expect(html(<FlashRow>A20 Dani C.</FlashRow>)).not.toContain("animate-flash");
  });
});

describe("Movimiento (globals.css)", () => {
  const css = readFileSync("src/app/globals.css", "utf8");
  const keyframes = Object.fromEntries(
    [...css.matchAll(/@keyframes ([\w-]+)\s*\{([\s\S]*?)\n  \}/g)].map((m) => [m[1], m[2]]),
  );
  const animations = Object.fromEntries(
    [...css.matchAll(/--animate-([\w-]+):\s*[\w-]+\s+(\d+)ms/g)].map((m) => [m[1], Number(m[2])]),
  );

  it("REQ-078.13 las animaciones solo usan transform y opacity y duran 150–250 ms", () => {
    for (const name of ["enter", "sheet-in", "dialog-in", "fade-in"]) {
      expect(keyframes[name], `falta @keyframes ${name}`).toBeDefined();
      const props = [...keyframes[name].matchAll(/([\w-]+):/g)].map((m) => m[1]);
      expect(props.every((p) => p === "transform" || p === "opacity")).toBe(true);
      expect(animations[name]).toBeGreaterThanOrEqual(150);
      expect(animations[name]).toBeLessThanOrEqual(250);
    }
  });

  it("REQ-078.12 el resaltado de tiempo real se desvanece en 1,2 s", () => {
    expect(animations.flash).toBe(1200);
  });

  it("REQ-078.13 con movimiento reducido las entradas quedan solo en opacidad", () => {
    const reduced = css.match(/@media \(prefers-reduced-motion: reduce\)\s*\{([\s\S]*?)\n\}/)?.[1];
    expect(reduced).toBeDefined();
    for (const cls of ["animate-enter", "animate-sheet-in", "animate-dialog-in"])
      expect(reduced).toContain(`.${cls}`);
    expect(reduced).toContain("animation-name: fade-in");
  });
});

describe("Celular al escribir", () => {
  it("REQ-003.2 agrupa 3XX XXX XXXX mientras se escribe y no pasa de 10 dígitos", () => {
    expect(formatPhoneTyping("3001")).toBe("300 1");
    expect(formatPhoneTyping("300100")).toBe("300 100");
    expect(formatPhoneTyping("3001000001")).toBe("300 100 0001");
    expect(formatPhoneTyping("300-100-0001 99")).toBe("300 100 0001");
    // T-162: pegado con el indicativo, que ya va fijo en el campo
    expect(formatPhoneTyping("+57 300 100 0001")).toBe("300 100 0001");
    expect(formatPhoneTyping("573001000001")).toBe("300 100 0001");
    expect(formatPhoneTyping("")).toBe("");
  });
});
