import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { JoinForm } from "@/components/queue/JoinForm";
import { getPublicBusiness } from "@/lib/actions/public";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Tomar turno" };

/** REQ-002 / REQ-003 / REQ-017.3 */
export default async function JoinPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const b = await getPublicBusiness(slug);
  if (!b) notFound();

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col px-4 py-6">
      <Link href={`/${b.slug}`} className="text-muted text-sm">
        ← {b.name}
      </Link>
      <h1 className="mt-2 text-2xl font-bold">Tomar turno</h1>
      {b.isOpen ? (
        <div className="mt-4">
          <JoinForm business={b} now={new Date().toISOString()} />
        </div>
      ) : (
        <p className="mt-4 rounded-xl bg-amber-50 p-4">
          La fila está cerrada ahora.{b.nextOpening ? ` ${b.nextOpening}.` : ""}
        </p>
      )}
    </main>
  );
}
