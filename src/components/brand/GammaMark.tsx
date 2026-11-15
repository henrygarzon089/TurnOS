/**
 * Símbolo de Gamma Club (REQ-091.7, design §27.3; manual en docs/marca/): una tijera abierta que
 * dibuja la letra γ, con el tornillo rojo como único acento. SVG en el código y colores solo de
 * tokens (REQ-078.1). Bajo 40 px va la versión simplificada del manual, que se lee mejor en chico.
 */
type Variant = "positivo" | "negativo";

const LOOK: Record<Variant, { body: string; stroke: string; screw: string }> = {
  positivo: { body: "fill-brand", stroke: "stroke-brand", screw: "fill-accent" },
  negativo: { body: "fill-surface", stroke: "stroke-surface", screw: "fill-accent-mark" },
};

export function GammaMark({
  variant = "positivo",
  size,
  decorative = false,
  className = "",
}: {
  variant?: Variant;
  /** Lado en px. */
  size: number;
  /** Va junto al nombre escrito: el lector de pantalla no lo repite. */
  decorative?: boolean;
  className?: string;
}) {
  const look = LOOK[variant];
  const simple = size < 40;
  const a11y = decorative
    ? ({ "aria-hidden": true } as const)
    : ({ role: "img", "aria-label": "Gamma Club" } as const);
  return (
    <svg
      viewBox="0 0 100 100"
      width={size}
      height={size}
      data-gamma-mark=""
      data-variant={variant}
      data-version={simple ? "simplificado" : "completo"}
      className={`shrink-0 ${className}`}
      {...a11y}
    >
      {simple ? (
        <>
          <polygon points="8,6 60,57 42,68" className={look.body} />
          <polygon points="92,6 40,57 58,68" className={look.body} />
          <circle
            cx="50"
            cy="82"
            r="13"
            fill="none"
            strokeWidth="12"
            className={variant === "positivo" ? "stroke-accent" : "stroke-accent-mark"}
          />
        </>
      ) : (
        <>
          <polygon points="12,10 55,57 46,63" className={look.body} />
          <polygon points="88,10 45,57 54,63" className={look.body} />
          <path
            d="M50 62 C36 78 40 96 50 96 C60 96 64 78 50 62"
            fill="none"
            strokeWidth="7"
            strokeLinejoin="round"
            className={look.stroke}
          />
          <circle cx="50" cy="60" r="5" className={look.screw} />
        </>
      )}
    </svg>
  );
}

/** Nombre escrito de la marca: Montserrat 600, mayúsculas, espaciado 0,3 em (manual, pág. 07). */
export function GammaWordmark({ className = "" }: { className?: string }) {
  return (
    <span className={`font-semibold tracking-[0.3em] uppercase ${className}`}>GAMMA CLUB</span>
  );
}
