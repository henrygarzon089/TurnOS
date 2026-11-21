import type { Metadata } from "next";
import { PageHeader } from "@/components/admin/PageHeader";
import { JobApplications, type JobApplicationRow } from "@/components/admin/JobApplications";
import { getStaffSession } from "@/lib/auth/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Postulaciones" };

/** REQ-102.6 / REQ-102.7: lo que llega de "Trabaja con nosotros"; solo el dueño (RLS). */
export default async function JobApplicationsPage() {
  const session = (await getStaffSession())!;
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("job_applications")
    .select(
      "id, full_name, phone_e164, role, years_experience, portfolio_url, availability, message, status, created_at",
    )
    .eq("business_id", session.business.id)
    .order("created_at", { ascending: false });

  return (
    <main className="pb-6">
      <PageHeader
        title="Postulaciones"
        subtitle={
          <>
            Barberos y estilistas que quieren trabajar contigo, desde la página Trabaja con
            nosotros. Se borran solas a los 12 meses.
          </>
        }
      />
      <JobApplications rows={(data ?? []) as JobApplicationRow[]} businessName={session.business.name} />
    </main>
  );
}
