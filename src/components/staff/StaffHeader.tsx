import { signOut } from "@/lib/actions/auth";
import type { StaffSession } from "@/lib/auth/session";

/**
 * Encabezado del personal. El barbero lo ve en azul marino con su nombre adelante (tablero
 * Barbero-Fila); su menú es la barra inferior (`BarberNav`). El dueño, en blanco con su menú aparte.
 */
export function StaffHeader({ session }: { session: StaffSession }) {
  const barber = session.role === "barber";
  return (
    <header
      className={`sticky top-0 z-10 ${barber ? "bg-brand text-brand-ink" : "border-line bg-card border-b"}`}
    >
      <div className="mx-auto flex w-full max-w-md items-center justify-between px-4 py-3">
        {barber ? (
          <div className="min-w-0">
            <p className="truncate font-bold">{session.barberName ?? "Barbero"}</p>
            <p className="truncate text-sm opacity-80">{session.business.name}</p>
          </div>
        ) : (
          <div className="min-w-0">
            <p className="truncate font-semibold">{session.business.name}</p>
            <p className="text-muted truncate text-sm">
              Dueño{session.barberName ? ` · ${session.barberName}` : ""}
            </p>
          </div>
        )}
        <form action={signOut}>
          <button
            type="submit"
            className={`min-h-12 px-2 text-sm font-medium ${barber ? "opacity-80" : "text-muted"}`}
          >
            Salir
          </button>
        </form>
      </div>
    </header>
  );
}
