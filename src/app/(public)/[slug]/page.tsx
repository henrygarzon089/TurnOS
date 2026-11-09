import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { MenuSheet } from "@/components/public/MenuSheet";
import {
  ClosedNotice,
  LiveBanner,
  LiveBlock,
  LiveStatusProvider,
} from "@/components/public/PublicHome";
import { PublicHeader } from "@/components/public/PublicHeader";
import { JoinForm } from "@/components/queue/JoinForm";
import { getPublicBusiness } from "@/lib/actions/public";
import { getAppointmentInfo } from "@/lib/actions/public-appointments";
import { hhmmTo12h, publicBarberLines } from "@/lib/domain/public-view";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const b = await getPublicBusiness(slug);
  return { title: b ? `${b.name} · Fila` : "Negocio no encontrado" };
}

/**
 * REQ-001.1 / REQ-001.4 / REQ-003.1 / REQ-078.21 (T-173, ADR-052): la portada y tomar turno en una
 * sola pantalla, como Cliente-Negocio. Celular: encabezado, bloque en vivo, formulario y "Tomar
 * turno" fijo abajo. Desde 1024 px (Cliente-Escritorio): la fila en vivo como tabla a la izquierda
 * y el formulario en una tarjeta a la derecha.
 */
export default async function PublicBusinessPage({ params }: Props) {
  const { slug } = await params;
  const b = await getPublicBusiness(slug);
  if (!b) notFound();
  // REQ-050.1: "Reservar una cita" solo con las citas encendidas y alguien que las reciba
  const appts = await getAppointmentInfo(slug);
  const canBook = Boolean(appts?.enabled && appts.barbers.length > 0 && appts.openDays.length > 0);
  const lines = publicBarberLines(b, new Date());
  // REQ-038.2: sin productos a la venta, "Ver menú" no aparece
  const menu =
    b.products.length > 0 ? <MenuSheet address={b.address} products={b.products} /> : null;

  const state = b.isOpen ? (
    `Abierto${b.closesAt ? ` hasta ${hhmmTo12h(b.closesAt)}` : ""}`
  ) : (
    <span className="text-danger font-medium">
      Cerrado{b.nextOpening ? ` · ${b.nextOpening.toLowerCase()}` : ""}
    </span>
  );

  return (
    <LiveStatusProvider businessId={b.id}>
      <div className="flex flex-1 flex-col">
        <LiveBanner />
        <PublicHeader
          name={b.name}
          subtitle={state}
          aside={
            <div className="hidden items-center gap-8 lg:flex">
              {canBook && (
                <Link
                  href={`/${b.slug}/cita`}
                  className="text-ink inline-flex min-h-12 items-center font-semibold underline underline-offset-4"
                >
                  Reservar una cita
                </Link>
              )}
              {menu}
            </div>
          }
        />
        <main className="mx-auto grid w-full max-w-md flex-1 grid-cols-[minmax(0,1fr)] content-start gap-5 px-4 pt-4 lg:max-w-6xl lg:grid-cols-[minmax(0,1fr)_440px] lg:items-start lg:gap-14 lg:px-16 lg:pt-10">
          <LiveBlock waiting={b.waitingCount} lines={lines} whatsapp={b.whatsappAutoEnabled} />
          <div className="lg:border-line lg:bg-card lg:rounded-lg lg:border lg:p-6">
            {b.isOpen ? (
              <>
                <h2 className="mb-4 hidden text-xl font-bold lg:block">Tomar turno</h2>
                <JoinForm business={b} now={new Date().toISOString()} canBook={canBook} />
              </>
            ) : (
              <ClosedNotice
                slug={b.slug}
                nextOpening={b.nextOpening}
                canBook={canBook}
                menuTrigger={menu}
              />
            )}
          </div>
        </main>
        <footer className="text-muted mx-auto hidden w-full max-w-6xl px-16 pt-10 pb-8 text-sm lg:block">
          Fila con TurnOS
        </footer>
      </div>
    </LiveStatusProvider>
  );
}
