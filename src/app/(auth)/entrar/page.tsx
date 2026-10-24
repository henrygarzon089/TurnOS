import type { Metadata } from "next";
import { LoginForm } from "@/components/auth/LoginForm";

export const metadata: Metadata = { title: "Entrar" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const volver = typeof params.volver === "string" ? params.volver : undefined;
  const tab = params.rol === "dueno" ? "owner" : "barber";

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col px-4 py-8">
      <h1 className="text-2xl font-bold">Entrar</h1>
      <p className="text-muted mt-1">Solo para el personal del negocio.</p>
      <LoginForm initialTab={tab} volver={volver} />
    </main>
  );
}
