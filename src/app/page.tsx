import Link from "next/link";
import { redirect } from "next/navigation";
import { HOME_SLUG, isEssentialMode } from "@/lib/domain/modules";

// El modo se lee al servir, no al compilar (TURNOS_MODULES puede cambiar sin recompilar)
export const dynamic = "force-dynamic";

export default function HomePage() {
  // REQ-080.2: en modo esencial la portada es la página pública del único negocio.
  if (isEssentialMode()) redirect(`/${HOME_SLUG}`);

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-6 px-4 py-10">
      <div>
        <h1 className="text-3xl font-bold">TurnOS</h1>
        <p className="text-muted mt-2">
          Fila virtual para negocios de barrio. Toma tu turno con el QR del local o con el enlace
          que te compartieron por WhatsApp.
        </p>
      </div>
      <Link href="/entrar" className="btn-primary">
        Entrar (dueños y barberos)
      </Link>
    </main>
  );
}
