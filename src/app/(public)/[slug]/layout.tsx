import type { Metadata } from "next";
import { getPublicBusiness } from "@/lib/actions/public";
import { businessPwaMetadata } from "@/lib/pwa";

/** REQ-032.1: las páginas públicas del negocio se instalan con su nombre (PA-22). */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const b = await getPublicBusiness(slug);
  return b ? businessPwaMetadata({ name: b.name, pwaName: b.pwaName, slug: b.slug }) : {};
}

export default function BusinessLayout({ children }: { children: React.ReactNode }) {
  return children;
}
