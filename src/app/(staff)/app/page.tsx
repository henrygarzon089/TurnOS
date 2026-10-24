import { redirect } from "next/navigation";
import { getStaffSession } from "@/lib/auth/session";

/** /app redirige según rol: dueño → /admin; barbero → /app/fila (REQ-030). */
export default async function AppIndexPage() {
  const session = await getStaffSession();
  if (session?.role === "owner" && !session.barberId) {
    redirect("/admin");
  }
  redirect("/app/fila");
}
