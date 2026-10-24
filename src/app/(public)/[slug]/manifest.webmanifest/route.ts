import { getPublicBusiness } from "@/lib/actions/public";
import { businessManifest } from "@/lib/pwa";

/** REQ-032.1: manifest de la app del cliente con el nombre de la barbería (PA-22). */
export async function GET(_req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const b = await getPublicBusiness(slug);
  if (!b) return new Response("Negocio no encontrado", { status: 404 });
  return Response.json(businessManifest({ name: b.name, pwaName: b.pwaName, slug: b.slug }), {
    headers: {
      "Content-Type": "application/manifest+json",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
