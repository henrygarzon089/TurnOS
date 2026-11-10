import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PublicHeader } from "@/components/public/PublicHeader";
import { getPrivacyPolicy } from "@/lib/actions/public";
import { privacyBlocks, privacyVersionLine } from "@/lib/domain/privacy";

export const metadata: Metadata = { title: "Aviso de privacidad" };

/**
 * REQ-002.1: texto completo del aviso vigente. REQ-078.24 como el tablero Cliente-Cita (design
 * §22.7): flecha, "Versión N · vigente desde <fecha>" y títulos en negrita. No se construye
 * "Pedir que borren mis datos" (REQ-018.6: se pide en el local y lo hace el dueño).
 */
export default async function PrivacyPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const p = await getPrivacyPolicy(slug);
  if (!p) notFound();
  const blocks = privacyBlocks(p.body);
  return (
    <div className="flex flex-1 flex-col">
      <PublicHeader
        name="Aviso de privacidad"
        back={{ href: `/${slug}`, label: `Volver a ${p.businessName}` }}
      />
      <main className="mx-auto w-full max-w-prose flex-1 px-4 py-5">
        <p className="text-muted text-sm">{privacyVersionLine(p.version, p.publishedAt)}</p>
        {/* Los bloques van separados por salto de línea: el texto del artículo es el del dueño */}
        <article className="mt-4 text-base leading-relaxed">
          {blocks.map((b, i) => (
            <span key={i}>
              {i > 0 && "\n"}
              {b.kind === "heading" ? (
                <strong className={`block font-bold ${i > 0 ? "mt-4" : ""}`}>{b.text}</strong>
              ) : (
                <span className="mt-1 block">{b.text}</span>
              )}
            </span>
          ))}
        </article>
      </main>
    </div>
  );
}
