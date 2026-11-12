import type { Metadata } from "next";
import { AuthCard } from "@/components/auth/AuthCard";
import { LoginForm } from "@/components/auth/LoginForm";
import { isModuleEnabled } from "@/lib/domain/modules";
import { NO_BUSINESS_MESSAGE, NO_BUSINESS_REASON } from "@/lib/domain/staff-entry";

export const metadata: Metadata = { title: "Entrar" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const volver = typeof params.volver === "string" ? params.volver : undefined;
  const tab = params.rol === "dueno" ? "owner" : "barber";

  const sinNegocio = params.motivo === NO_BUSINESS_REASON;

  return (
    <AuthCard title="Entrar" subtitle="Solo para el personal del negocio.">
      {sinNegocio && (
        <p role="alert" className="text-danger mt-4 text-sm font-medium">
          {NO_BUSINESS_MESSAGE}
        </p>
      )}
      <LoginForm initialTab={tab} volver={volver} canSignup={isModuleEnabled("signup")} />
    </AuthCard>
  );
}
