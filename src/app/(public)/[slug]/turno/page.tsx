import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PublicHeader } from "@/components/public/PublicHeader";
import { JoinForm } from "@/components/queue/JoinForm";
import { getPublicBusiness } from "@/lib/actions/public";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Tomar turno" };

/** REQ-002 / REQ-003 / REQ-017.3. Encabezado con volver a la portada (T-162). */
export default async function JoinPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const b = await getPublicBusiness(slug);
  if (!b) notFound();

  return (
    <div className="flex flex-1 flex-col">
      <PublicHeader
        name="Tomar turno"
        subtitle={b.name}
        back={{ href: `/${b.slug}`, label: `Volver a ${b.name}` }}
      />
      <main className="mx-auto w-full max-w-md flex-1 px-4 pt-4">
        {b.isOpen ? (
          <JoinForm business={b} now={new Date().toISOString()} />
        ) : (
          <p className="bg-warn-soft rounded-md p-4">
            La fila está cerrada ahora.{b.nextOpening ? ` ${b.nextOpening}.` : ""}
          </p>
        )}
      </main>
    </div>
  );
}
