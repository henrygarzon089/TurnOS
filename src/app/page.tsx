import Link from "next/link";

export default function HomePage() {
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
