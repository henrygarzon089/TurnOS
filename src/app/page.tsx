import type { Metadata } from "next";
import Link from "next/link";
import { SiteHome } from "@/components/site/SiteHome";
import { getSiteHome } from "@/lib/actions/site";
import { SITE_TAGLINE, SITE_URL } from "@/lib/brand";
import { homeSlug } from "@/lib/domain/modules";
import { mediaUrl } from "@/lib/media/paths";

// Precios, horario y abierto/cerrado se leen al servir (REQ-101.4); sin base al compilar
export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const data = await getSiteHome(homeSlug());
  if (!data) return {};
  const b = data.business;
  const title = `${b.name} · Barbería en Sabaneta`;
  const description =
    b.description ?? `${SITE_TAGLINE}. Reserva tu cita o toma turno desde el celular.`;
  const images = b.coverPath ? [{ url: mediaUrl(b.coverPath), alt: `Foto de ${b.name}` }] : [];
  // REQ-101.7: título propio, canónica y Open Graph con la portada
  return {
    title: { absolute: title },
    description,
    alternates: { canonical: `${SITE_URL}/` },
    openGraph: {
      type: "website",
      locale: "es_CO",
      url: `${SITE_URL}/`,
      siteName: b.name,
      title,
      description,
      images,
    },
    twitter: { card: "summary_large_image", title, description, images: images.map((i) => i.url) },
  };
}

/**
 * REQ-101.1 (ADR-077): la portada es la web del negocio de `homeSlug()`; `/<slug>` sigue siendo la
 * fila. Si ese negocio no existe, la portada genérica de antes.
 */
export default async function HomePage() {
  const data = await getSiteHome(homeSlug());
  if (data) return <SiteHome data={data} />;

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-6 px-4 py-10">
      <div>
        <h1 className="text-3xl font-bold">TurnOS</h1>
        <p className="text-muted mt-2">
          Fila virtual para negocios de barrio. Toma tu turno con el QR del local o con el enlace
          que te compartieron por WhatsApp.
        </p>
      </div>
      <Link href="/entrar" className="btn-primary">
        Entrar (dueños y barberos)
      </Link>
    </main>
  );
}
