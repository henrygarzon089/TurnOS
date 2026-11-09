import { signOut } from "@/lib/actions/auth";
import type { StaffSession } from "@/lib/auth/session";
import { businessInitials } from "@/lib/domain/admin-nav";
import { businessDayBogota, formatLongDayCO } from "@/lib/domain/time";

/**
 * Encabezado del personal. El barbero lo ve en azul marino con su nombre adelante (tablero
 * Barbero-Fila); su menú es la barra inferior (`BarberNav`). El dueño (REQ-078.21, design §22.7):
 * barra azul marino de 56 px a todo el ancho, por encima del menú lateral, con el cuadro de
 * iniciales y el negocio; desde 1024 px, a la derecha, la fecha larga y su nombre con "▾", que abre
 * "Salir". En el celular "Salir" está en "Más" (`AdminNav`).
 */
export function StaffHeader({
  session,
  day = businessDayBogota(),
}: {
  session: StaffSession;
  /** Día del negocio para la fecha de la barra; se pasa en las pruebas. */
  day?: string;
}) {
  if (session.role !== "barber") return <OwnerBar session={session} day={day} />;
  return (
    <header className="bg-brand text-brand-ink sticky top-0 z-10">
      <div className="mx-auto flex w-full max-w-md items-center justify-between px-4 py-3">
        <div className="min-w-0">
          <p className="truncate font-bold">{session.barberName ?? "Barbero"}</p>
          <p className="truncate text-sm opacity-80">{session.business.name}</p>
        </div>
        <form action={signOut}>
          <button type="submit" className="min-h-12 px-2 text-sm font-medium opacity-80">
            Salir
          </button>
        </form>
      </div>
    </header>
  );
}

function OwnerBar({ session, day }: { session: StaffSession; day: string }) {
  return (
    <header className="bg-brand text-brand-ink sticky top-0 z-30">
      <div className="flex h-14 items-center gap-3 px-4 lg:px-5">
        <span
          aria-hidden="true"
          className="bg-card text-brand grid size-8 shrink-0 place-items-center rounded-sm text-sm font-bold"
        >
          {businessInitials(session.business.name)}
        </span>
        <p className="min-w-0 truncate font-bold">{session.business.name}</p>
        <div className="ml-auto hidden items-center gap-4 lg:flex">
          <p className="text-sm opacity-70">{formatLongDayCO(day)}</p>
          <details className="group relative">
            <summary className="flex min-h-12 cursor-pointer list-none items-center px-2 text-sm font-semibold [&::-webkit-details-marker]:hidden">
              {`${session.barberName ?? "Dueño"} ▾`}
            </summary>
            <div className="border-line bg-card text-ink shadow-overlay absolute top-full right-0 mt-1 w-44 rounded-md border p-1">
              <form action={signOut}>
                <button
                  type="submit"
                  className="hover:bg-surface flex min-h-12 w-full items-center rounded-sm px-3 text-left text-base"
                >
                  Salir
                </button>
              </form>
            </div>
          </details>
        </div>
      </div>
    </header>
  );
}
