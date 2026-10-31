import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { LiveRefresh } from "@/components/queue/LiveRefresh";
import { getPublicBusiness } from "@/lib/actions/public";
import { formatCOP } from "@/lib/domain/money";
import { formatMinutes } from "@/lib/domain/time";
import { mediaUrl } from "@/lib/media/paths";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const b = await getPublicBusiness(slug);
  return { title: b ? `${b.name} · Fila` : "Negocio no encontrado" };
}

/** REQ-001.1 / REQ-001.4 / REQ-001.5: portada pública de la fila. */
export default async function PublicBusinessPage({ params }: Props) {
  const { slug } = await params;
  const b = await getPublicBusiness(slug);
  if (!b) notFound();

  const statusLabels: Record<string, string> = {
    available: "",
    busy: "",
    paused: " (en pausa)",
    off: "",
  };

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col px-4 pb-28">
      <LiveRefresh businessId={b.id} />
      <header className="py-6">
        <h1 className="text-3xl font-bold">{b.name}</h1>
        {b.address && <p className="text-muted mt-1 text-sm">{b.address}</p>}
        <p className="mt-2 font-medium">
          {b.isOpen ? (
            <span className="text-ok">
              Abierto{b.closesAt ? ` · cierra a las ${to12h(b.closesAt)}` : ""}
            </span>
          ) : (
            <span className="text-danger">
              Cerrado{b.nextOpening ? ` · ${b.nextOpening.toLowerCase()}` : ""}
            </span>
          )}
        </p>
      </header>

      <section
        className="bg-card border-line rounded-2xl border p-5 text-center"
        aria-live="polite"
      >
        <p className="text-5xl font-bold">{b.waitingCount}</p>
        <p className="text-muted">
          {b.waitingCount === 1 ? "persona en la fila" : "personas en la fila"}
        </p>
        {b.isOpen && (
          <p className="mt-3 text-lg font-semibold">
            {b.estimatedWaitMin === null
              ? "Sin barberos atendiendo ahora"
              : b.estimatedWaitMin === 0
                ? "Te atenderían de una vez"
                : `${formatMinutes(b.estimatedWaitMin)} de espera`}
          </p>
        )}
      </section>

      {b.barbersToday.length > 0 && (
        <section className="mt-5">
          <h2 className="text-muted text-sm font-semibold uppercase">Barberos hoy</h2>
          <p className="mt-1">
            {b.barbersToday.map((x, i) => (
              <span key={x.id}>
                {i > 0 && " · "}
                {x.name}
                <span className="text-muted">{statusLabels[x.status]}</span>
              </span>
            ))}
          </p>
        </section>
      )}

      <section className="mt-5">
        <h2 className="text-muted text-sm font-semibold uppercase">Servicios</h2>
        <ul className="divide-line mt-1 divide-y">
          {b.services.map((s) => (
            <li key={s.id} className="flex justify-between py-2">
              <span>
                {s.name} <span className="text-muted text-sm">· {s.durationMin} min</span>
              </span>
              <span className="font-semibold">{formatCOP(s.price)}</span>
            </li>
          ))}
        </ul>
      </section>

      {b.products.length > 0 && (
        <section className="mt-5" aria-labelledby="lo-que-vendemos">
          <h2 id="lo-que-vendemos" className="text-muted text-sm font-semibold uppercase">
            Lo que vendemos
          </h2>
          <ul className="divide-line mt-1 divide-y">
            {b.products.map((p) => (
              <li key={p.id} className="flex items-center gap-3 py-2">
                {p.photoPath && (
                  <Image
                    src={mediaUrl(p.photoPath)}
                    alt={p.name}
                    width={56}
                    height={56}
                    unoptimized
                    className="h-14 w-14 shrink-0 rounded-lg object-cover"
                  />
                )}
                <span className="min-w-0 flex-1 break-words">{p.name}</span>
                <span className="shrink-0 font-semibold">{formatCOP(p.price)}</span>
              </li>
            ))}
          </ul>
          <p className="text-muted mt-1 text-sm">Se compran en el local.</p>
        </section>
      )}

      <div className="bg-surface fixed inset-x-0 bottom-0 p-4">
        <div className="mx-auto max-w-md">
          {b.isOpen ? (
            <Link href={`/${b.slug}/turno`} className="btn-primary">
              Tomar turno
            </Link>
          ) : (
            <p className="text-muted text-center text-sm">
              {b.nextOpening
                ? `Abrimos: ${b.nextOpening.toLowerCase()}.`
                : "La fila está cerrada por hoy."}
            </p>
          )}
        </div>
      </div>
    </main>
  );
}

function to12h(hhmm: string): string {
  const [h, m] = hhmm.split(":").map(Number);
  const suffix = h < 12 ? "a. m." : "p. m.";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(m).padStart(2, "0")} ${suffix}`;
}
