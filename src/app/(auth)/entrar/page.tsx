import type { Metadata } from "next";
import { AuthCard } from "@/components/auth/AuthCard";
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
    <AuthCard title="Entrar" subtitle="Solo para el personal del negocio.">
      <LoginForm initialTab={tab} volver={volver} />
    </AuthCard>
  );
}
