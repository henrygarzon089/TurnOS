import type { Metadata } from "next";
import { AdminNav } from "@/components/admin/AdminNav";
import {
  LoyaltyForm,
  type LoyaltyProgramRow,
  type LoyaltyServiceRow,
} from "@/components/admin/LoyaltyForm";
import { getStaffSession } from "@/lib/auth/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Fidelidad" };

const DEFAULTS: LoyaltyProgramRow = {
  enabled: false,
  visits_required: 10,
  reward_type: "free_service",
  reward_service_id: null,
  reward_amount: null,
};

/** REQ-019.1, REQ-019.6: tarjeta de fidelidad del negocio. */
export default async function LoyaltyPage() {
  const session = (await getStaffSession())!;
  const supabase = await createSupabaseServerClient();
  const biz = session.business.id;
  const [progRes, servicesRes, cardsRes] = await Promise.all([
    supabase
      .from("loyalty_programs")
      .select("enabled, visits_required, reward_type, reward_service_id, reward_amount")
      .eq("business_id", biz)
      .maybeSingle(),
    supabase
      .from("services")
      .select("id, name, counts_for_loyalty")
      .eq("business_id", biz)
      .eq("is_active", true)
      .order("sort_order")
      .order("name"),
    supabase
      .from("loyalty_cards")
      .select("stamps, status")
      .eq("business_id", biz)
      .in("status", ["active", "completed"]),
  ]);
  const program = (progRes.data as LoyaltyProgramRow | null) ?? DEFAULTS;
  const services = (servicesRes.data ?? []) as LoyaltyServiceRow[];
  const cards = (cardsRes.data ?? []) as { stamps: number; status: string }[];
  const stamps = cards.reduce((s, c) => s + c.stamps, 0);
  const rewards = cards.filter((c) => c.status === "completed").length;

  return (
    <main className="pb-6">
      <AdminNav current="/admin/fidelidad" />
      <h1 className="text-2xl font-bold">Tarjeta de fidelidad</h1>
      <p className="text-muted mt-1 text-sm">
        Cada servicio que suma es un sello. Al completar la tarjeta, el cliente gana el premio.
      </p>
      <dl
        aria-label="Resumen de la tarjeta"
        className="border-line bg-card mt-4 grid grid-cols-3 gap-2 rounded-xl border p-4 text-center"
      >
        <div>
          <dt className="text-muted text-xs">Clientes con tarjeta</dt>
          <dd className="text-xl font-bold">{cards.length}</dd>
        </div>
        <div>
          <dt className="text-muted text-xs">Sellos acumulados</dt>
          <dd className="text-xl font-bold" data-testid="stamps-total">
            {stamps}
          </dd>
        </div>
        <div>
          <dt className="text-muted text-xs">Premios por canjear</dt>
          <dd className="text-xl font-bold">{rewards}</dd>
        </div>
      </dl>
      <LoyaltyForm program={program} services={services} />
    </main>
  );
}
