import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CustomerForm } from "@/components/customers/CustomerForm";
import { CustomerHistory } from "@/components/customers/CustomerHistory";
import { DeleteCustomer } from "@/components/customers/DeleteCustomer";
import { MergeButton } from "@/components/customers/MergeDialog";
import { getCustomer } from "@/lib/actions/customers";
import { businessDayBogota, formatDayCO } from "@/lib/domain/time";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Ficha del cliente" };

function day(iso: string | null): string {
  return iso ? formatDayCO(businessDayBogota(new Date(iso))) : "—";
}

/** REQ-018.1–18.2 ficha con historial; REQ-018.4 barbero; REQ-018.5 editar y fusionar. */
export default async function CustomerPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const view = await getCustomer(id);
  if (!view) notFound();
  const c = view.customer;
  const isOwner = view.viewer.role === "owner";

  return (
    <main className="flex flex-col gap-4 py-4">
      <Link href="/app/clientes" className="text-accent min-h-10 text-sm font-medium">
        ← Clientes
      </Link>
      <header>
        <h1 className="text-2xl font-bold">{c.name}</h1>
        <p className="text-muted text-sm">
          <a href={`tel:${c.phone}`} className="underline">
            {c.phone.replace(/^\+57(\d{3})(\d{3})(\d{4})$/, "$1 $2 $3")}
          </a>
          {c.doNotContact ? " · No contactar" : ""}
        </p>
      </header>

      <dl className="border-line bg-card grid grid-cols-3 gap-2 rounded-xl border p-4 text-center">
        <div>
          <dt className="text-muted text-xs">Visitas</dt>
          <dd className="text-xl font-bold">{c.visitsCount}</dd>
        </div>
        <div>
          <dt className="text-muted text-xs">Primera</dt>
          <dd className="text-sm font-semibold">{day(c.firstVisitAt)}</dd>
        </div>
        <div>
          <dt className="text-muted text-xs">Última</dt>
          <dd className="text-sm font-semibold">{day(c.lastVisitAt)}</dd>
        </div>
      </dl>
      <p className="text-muted -mt-2 text-xs">
        {c.privacyAcceptedAt
          ? `Aceptó el aviso de privacidad (versión ${c.privacyVersion}) el ${day(c.privacyAcceptedAt)}.`
          : "No ha aceptado el aviso de privacidad."}
      </p>

      <CustomerForm view={view} />

      <section className="flex flex-col gap-2">
        <h2 className="font-semibold">Historial</h2>
        <CustomerHistory rows={view.history} />
      </section>

      {isOwner && <MergeButton view={view} />}
      {isOwner && <DeleteCustomer id={c.id} name={c.name} />}
    </main>
  );
}
