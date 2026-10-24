import type { Metadata } from "next";

export const metadata: Metadata = { title: "Crear negocio" };

/** Placeholder de T-006; el asistente de 3 pasos llega en T-007. */
export default function CreateBusinessPage() {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col px-4 py-8">
      <h1 className="text-2xl font-bold">Crear mi negocio</h1>
      <p className="text-muted mt-2">Asistente en construcción (T-007).</p>
    </main>
  );
}
