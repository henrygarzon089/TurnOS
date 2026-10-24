import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getPrivacyPolicy } from "@/lib/actions/public";

export const metadata: Metadata = { title: "Aviso de privacidad" };

/** REQ-002.1: texto completo del aviso vigente. */
export default async function PrivacyPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const p = await getPrivacyPolicy(slug);
  if (!p) notFound();
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col px-4 py-6">
      <h1 className="text-2xl font-bold">Aviso de privacidad</h1>
      <p className="text-muted mt-1 text-sm">
        {p.businessName} · versión {p.version}
      </p>
      <article className="mt-4 leading-relaxed whitespace-pre-wrap">{p.body}</article>
    </main>
  );
}
