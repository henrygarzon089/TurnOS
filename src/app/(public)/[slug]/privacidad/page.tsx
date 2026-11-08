import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PublicHeader } from "@/components/public/PublicHeader";
import { getPrivacyPolicy } from "@/lib/actions/public";

export const metadata: Metadata = { title: "Aviso de privacidad" };

/** REQ-002.1: texto completo del aviso vigente. */
export default async function PrivacyPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const p = await getPrivacyPolicy(slug);
  if (!p) notFound();
  return (
    <div className="flex flex-1 flex-col">
      <PublicHeader
        name="Aviso de privacidad"
        subtitle={`${p.businessName} · versión ${p.version}`}
        back={{ href: `/${slug}`, label: `Volver a ${p.businessName}` }}
      />
      <main className="mx-auto w-full max-w-prose flex-1 px-4 py-6">
        <article className="text-base leading-relaxed whitespace-pre-wrap">{p.body}</article>
      </main>
    </div>
  );
}
