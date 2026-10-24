import { redirect } from "next/navigation";
import { StaffHeader } from "@/components/staff/StaffHeader";
import { getStaffSession } from "@/lib/auth/session";

/**
 * Todas las rutas del personal (/app/*, /admin/*) exigen sesión y membresía en un negocio.
 * Sin membresía (dueño recién registrado) → asistente de creación (REQ-030.1).
 */
export default async function StaffLayout({ children }: { children: React.ReactNode }) {
  const session = await getStaffSession();
  if (!session) {
    redirect("/crear-negocio");
  }
  return (
    <>
      <StaffHeader session={session} />
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col px-4 pb-24">{children}</div>
    </>
  );
}
