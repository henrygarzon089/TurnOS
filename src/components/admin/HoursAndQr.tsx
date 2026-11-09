import { Panel } from "@/components/admin/PageHeader";
import { HoursForm, type HoursRow } from "@/components/admin/HoursForm";
import { QrCard } from "@/components/admin/QrCard";
import type { StaffSession } from "@/lib/auth/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * Horario y QR lado a lado como el tablero Dueno-Config (design §22.8). Lo pintan /admin/horario y
 * /admin/qr: la pantalla abierta va primero en el celular y su botón es el principal (REQ-078.4).
 */
export async function HoursAndQr({
  session,
  focus,
}: {
  session: StaffSession;
  focus: "hours" | "qr";
}) {
  const supabase = await createSupabaseServerClient();
  const [{ data: hours }, { data: tpl }] = await Promise.all([
    supabase
      .from("business_hours")
      .select("weekday, opens_at, closes_at, is_closed")
      .eq("business_id", session.business.id)
      .order("weekday"),
    supabase
      .from("message_templates")
      .select("body")
      .eq("business_id", session.business.id)
      .eq("key", "share_queue")
      .maybeSingle(),
  ]);
  const base = process.env.NEXT_PUBLIC_APP_URL ?? "";
  const url = `${base}/${session.business.slug}`;

  return (
    <div className="mt-4 grid items-start gap-4 lg:grid-cols-2">
      <Panel
        title="Horario"
        aria-label="Horario"
        className={focus === "qr" ? "order-last lg:order-none" : ""}
      >
        <HoursForm hours={(hours ?? []) as HoursRow[]} primary={focus === "hours"} />
      </Panel>
      <Panel title="QR del local" aria-label="QR del local">
        <QrCard
          url={url}
          slug={session.business.slug}
          businessName={session.business.name}
          template={tpl?.body ?? "Toma tu turno en {negocio}: {enlace}"}
          primary={focus === "qr"}
        />
      </Panel>
    </div>
  );
}
