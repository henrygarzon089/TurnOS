import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ServiceCard } from "@/components/public/JoinSteps";

/** T-230 · tarjeta de servicio al estilo de Fresha (REQ-086.2, ADR-064). */
const photo =
  "0f0e0d0c-0b0a-4908-8706-050403020100/services/1f0e0d0c-0b0a-4908-8706-050403020100.webp";

function card(props: Partial<Parameters<typeof ServiceCard>[0]> = {}) {
  return renderToStaticMarkup(
    <ServiceCard
      name="Corte moderno"
      price={25000}
      durationMin={30}
      photoPath={null}
      checked={false}
      onPick={() => {}}
      {...props}
    />,
  );
}

describe("REQ-086.2 tarjeta de servicio al estilo de Fresha", () => {
  it("REQ-086.2 muestra el nombre, la duración y el precio grande por separado", () => {
    const html = card();
    expect(html).toContain("Corte moderno");
    expect(html).toMatch(/data-testid="service-duration"[^>]*>30 min</);
    expect(html).toMatch(/data-testid="service-price"[^>]*>\$\s?25\.000</);
    // ya no van juntos en una sola línea
    expect(html).not.toContain("· 30 min");
  });

  it('REQ-086.2 lleva un botón "+" que pasa a "✓" cuando el servicio está escogido', () => {
    expect(card()).toMatch(/data-testid="service-pick"[^>]*data-picked="false"/);
    const picked = card({ checked: true });
    expect(picked).toMatch(/data-testid="service-pick"[^>]*data-picked="true"/);
    expect(picked).toContain('aria-checked="true"');
    expect(picked).toContain("border-brand");
  });

  it("REQ-086.2 la foto va como miniatura; sin foto no sale el ícono de tijera", () => {
    const withPhoto = card({ photoPath: photo });
    expect(withPhoto.match(/<img[^>]*>/g)?.length).toBe(1);
    const without = card();
    expect(without).not.toContain("<img");
    expect(without).not.toContain("M8.5 8.5 20 20"); // trazo del ícono de tijera
  });

  it("REQ-086.2 sin quién lo haga hoy, la tarjeta queda en gris con el motivo", () => {
    const html = card({ disabled: true, disabledText: "Hoy no hay quién lo haga" });
    expect(html).toContain("Hoy no hay quién lo haga");
    expect(html).toContain("disabled");
  });
});

/** T-262 · descripción del servicio en la tarjeta (REQ-096.4…096.6, ADR-070). */
describe("REQ-096 descripción en la tarjeta de servicio", () => {
  const text = "Máquina y tijera, lavado y peinado";

  it("REQ-096.4 con descripción, la muestra completa en texto secundario debajo de la duración y arriba del precio", () => {
    const html = card({ description: text });
    expect(html).toMatch(
      new RegExp(
        `data-testid="service-description"[^>]*class="[^"]*text-muted[^"]*text-sm[^"]*"[^>]*>${text}<`,
      ),
    );
    const iDuration = html.indexOf('data-testid="service-duration"');
    const iDescription = html.indexOf('data-testid="service-description"');
    const iPrice = html.indexOf('data-testid="service-price"');
    expect(iDuration).toBeLessThan(iDescription);
    expect(iDescription).toBeLessThan(iPrice);
  });

  it("REQ-096.4 en una tarjeta que no se puede escoger, la descripción sigue saliendo, apagada", () => {
    const html = card({
      description: text,
      disabled: true,
      disabledText: "Hoy no hay quién lo haga",
    });
    expect(html).toContain(text);
    expect(html).toContain("text-muted");
  });

  it("REQ-096.5 sin descripción, la tarjeta se ve igual que hoy", () => {
    expect(card({ description: null })).toBe(card());
    expect(card({ description: undefined })).toBe(card());
    expect(card()).not.toContain("service-description");
  });

  it("REQ-096.6 el nombre va antes que la descripción, dentro de la misma opción", () => {
    const html = card({ description: text });
    const button = html.match(/<button[^>]*role="radio"[\s\S]*<\/button>/)?.[0] ?? "";
    expect(button).toContain(text);
    expect(button.indexOf("Corte moderno")).toBeLessThan(button.indexOf(text));
  });
});
