import type { Metadata, MetadataRoute } from "next";

/**
 * PWA por negocio (REQ-032.1, PA-22: la app del cliente lleva el nombre de la barbería). La app
 * del personal usa el manifest base `src/app/manifest.ts` ("TurnOS").
 */
type Biz = { name: string; pwaName?: string | null; slug: string };

const ICONS: MetadataRoute.Manifest["icons"] = [
  { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
  { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
  { src: "/icons/icon-512-maskable.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
];

function appName(b: Biz): string {
  return b.pwaName?.trim() || b.name;
}

/** Bajo el ícono caben ~12 caracteres. */
function shortName(name: string): string {
  return name.length <= 12 ? name : `${name.slice(0, 11).trimEnd()}…`;
}

export function businessManifest(b: Biz): MetadataRoute.Manifest {
  const name = appName(b);
  return {
    name,
    short_name: shortName(name),
    description: `Toma tu turno en ${b.name} sin esperar en el local.`,
    lang: "es-CO",
    start_url: `/${b.slug}`,
    // "Mi turno" vive en /t/[token]: el alcance es todo el sitio
    scope: "/",
    display: "standalone",
    background_color: "#f8fafc",
    theme_color: "#1d4ed8",
    icons: ICONS,
  };
}

/** Metadatos de las páginas públicas del negocio: su manifest y "Agregar a inicio" en iOS. */
export function businessPwaMetadata(b: Biz): Metadata {
  return {
    manifest: `/${b.slug}/manifest.webmanifest`,
    appleWebApp: { capable: true, title: appName(b), statusBarStyle: "default" },
    icons: { apple: "/icons/apple-touch-icon.png" },
  };
}
