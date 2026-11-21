import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { JobsPage } from "@/components/site/JobsPage";
import { getPublicBusiness } from "@/lib/actions/public";
import { SITE_URL } from "@/lib/brand";
import { homeSlug, isModuleEnabled } from "@/lib/domain/modules";
import { mediaUrl } from "@/lib/media/paths";

export const dynamic = "force-dynamic";

const TITLE = "Trabaja con nosotros · Barberos y estilistas en Sabaneta";
const DESCRIPTION =
  "Buscamos barberos y estilistas en San Remo, Sabaneta. Horario flexible, porcentaje negociable y un lugar en crecimiento. Postúlate desde el celular.";

export async function generateMetadata(): Promise<Metadata> {
  const b = await getPublicBusiness(homeSlug());
  const images = b?.coverPath ? [{ url: mediaUrl(b.coverPath), alt: `Foto de ${b.name}` }] : [];
  const url = `${SITE_URL}/trabaja-con-nosotros`;
  // REQ-102.8
  return {
    title: { absolute: b ? `${TITLE} · ${b.name}` : TITLE },
    description: DESCRIPTION,
    alternates: { canonical: url },
    openGraph: { type: "website", locale: "es_CO", url, title: TITLE, description: DESCRIPTION, images },
  };
}

/** REQ-102.1 (ADR-079): página pública para atraer y recibir postulaciones. */
export default async function TrabajaConNosotrosPage() {
  if (!isModuleEnabled("jobs")) notFound();
  const business = await getPublicBusiness(homeSlug());
  if (!business) notFound();
  return <JobsPage business={business} />;
}
