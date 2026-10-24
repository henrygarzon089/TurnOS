import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // TurnOS es casi 100 % dinámico (fila en vivo, caja del día). Se desactiva Cache Components
  // para mantener el modelo mental simple: cada petición al servidor lee el estado actual.
  cacheComponents: false,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  async headers() {
    return [
      {
        // "Mi turno": nunca se cachea (NFR-004, design.md §6.6)
        source: "/t/:token",
        headers: [{ key: "Cache-Control", value: "no-store" }],
      },
      {
        // Pantalla del televisor: no indexable (design.md §6.6)
        source: "/:slug/pantalla",
        headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }],
      },
    ];
  },
};

export default nextConfig;
