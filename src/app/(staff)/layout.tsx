import { redirect } from "next/navigation";
import { AdminNav } from "@/components/admin/AdminNav";
import { StaffHeader } from "@/components/staff/StaffHeader";
import { getStaffSession } from "@/lib/auth/session";

/**
 * Todas las rutas del personal (/app/*, /admin/*) exigen sesión y membresía en un negocio.
 * Sin membresía (dueño recién registrado) → asistente de creación (REQ-030.1).
 * El dueño tiene su menú (REQ-077) en todas sus pantallas, también en /app/clientes: barra
 * inferior en el celular (el contenido deja 56 px más abajo) y menú lateral desde 1024 px.
 */
export default async function StaffLayout({ children }: { children: React.ReactNode }) {
  const session = await getStaffSession();
  if (!session) {
    redirect("/crear-negocio");
  }
  const owner = session.role === "owner";
  return (
    <div className={`flex flex-1 flex-col ${owner ? "lg:pl-60" : ""}`}>
      <StaffHeader session={session} />
      <div
        className={`mx-auto flex w-full max-w-md flex-1 flex-col px-4 ${owner ? "pt-6 pb-40 lg:pb-24" : "pb-24"}`}
      >
        {children}
      </div>
      {owner && <AdminNav />}
    </div>
  );
}
