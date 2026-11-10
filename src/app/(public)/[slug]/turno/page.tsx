import { redirect } from "next/navigation";

/**
 * REQ-003.1 (ADR-052): tomar turno vive en la portada. La ruta se conserva para los QR y enlaces
 * viejos, y lleva a `/<slug>`.
 */
export default async function JoinPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  redirect(`/${slug}`);
}
