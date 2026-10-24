import { redirect } from "next/navigation";
import { getStaffSession } from "@/lib/auth/session";

/** /admin/* es solo para el dueño (REQ-030, design.md §6.1). */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await getStaffSession();
  if (session?.role !== "owner") {
    redirect("/app");
  }
  return <>{children}</>;
}
