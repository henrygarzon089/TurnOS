import Link from "next/link";
import { signOut } from "@/lib/actions/auth";
import type { StaffSession } from "@/lib/auth/session";

export function StaffHeader({ session }: { session: StaffSession }) {
  return (
    <header className="border-line bg-card sticky top-0 z-10 border-b">
      <div className="mx-auto flex w-full max-w-md items-center justify-between px-4 py-3">
        <div className="min-w-0">
          <p className="truncate font-semibold">{session.business.name}</p>
          <p className="text-muted truncate text-sm">
            {session.role === "owner" ? "Dueño" : "Barbero"}
            {session.barberName ? ` · ${session.barberName}` : ""}
          </p>
        </div>
        <form action={signOut}>
          <button type="submit" className="text-muted min-h-12 px-2 text-sm font-medium">
            Salir
          </button>
        </form>
      </div>
      {session.role === "barber" && (
        <nav aria-label="Barbero" className="mx-auto flex w-full max-w-md gap-2 px-4 pb-2">
          <Link href="/app/fila" className="text-accent min-h-10 px-2 py-2 text-sm font-semibold">
            Mi fila
          </Link>
          <Link
            href="/app/clientes"
            className="text-accent min-h-10 px-2 py-2 text-sm font-semibold"
          >
            Clientes
          </Link>
        </nav>
      )}
    </header>
  );
}
