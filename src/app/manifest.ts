import type { MetadataRoute } from "next";

/**
 * PWA instalable (REQ-032.1). El nombre por negocio (marca blanca, PA-22) se resuelve en
 * /[slug]/manifest.webmanifest (T-029); este es el manifest base de la app del personal.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "TurnOS",
    short_name: "TurnOS",
    description: "Fila virtual, clientes y caja para negocios de barrio.",
    lang: "es-CO",
    start_url: "/app",
    display: "standalone",
    background_color: "#f8fafc",
    theme_color: "#1d4ed8",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      {
        src: "/icons/icon-512-maskable.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
