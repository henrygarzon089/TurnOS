import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader, Panel } from "@/components/admin/PageHeader";
import { PrivacyForm } from "@/components/admin/PrivacyForm";
import { getStaffSession } from "@/lib/auth/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Aviso de privacidad" };

export default async function PrivacyAdminPage() {
  const session = (await getStaffSession())!;
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("privacy_policy_versions")
    .select("version, body, published_at")
    .eq("business_id", session.business.id)
    .order("version", { ascending: false });
  const versions = (data ?? []) as { version: number; body: string; published_at: string }[];

  return (
    <main className="pb-6">
      <PageHeader
        title="Aviso de privacidad"
        subtitle={
          <>
            Ley 1581 de 2012. Al publicar una versión nueva, todos los clientes la vuelven a aceptar
            en su siguiente turno. La plantilla inicial debe revisarla un abogado.
          </>
        }
      />
      {/* Tarjetas lado a lado desde 1024 px (tablero Dueno-Config, design §22.8) */}
      <div data-two-up className="grid items-start gap-x-4 lg:grid-cols-2">
        <PrivacyForm current={versions[0]} history={versions.slice(1)} />
        <Panel title="Si un cliente pide borrar sus datos" className="mt-4">
          <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-base">
              Búscalo y abre su ficha en Clientes; abajo está &ldquo;Eliminar datos del
              cliente&rdquo;. Te pedimos confirmar antes de borrar y no se puede deshacer.
            </p>
            <Link href="/app/clientes" className="btn-secondary shrink-0 sm:w-auto sm:px-5">
              Ir a Clientes
            </Link>
          </div>
        </Panel>
      </div>
    </main>
  );
}
