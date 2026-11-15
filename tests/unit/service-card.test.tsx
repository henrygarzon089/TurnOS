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
