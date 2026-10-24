import { redirect } from "next/navigation";

/** El inicio del dueño es la fila (design.md §6.1). */
export default function AdminHomePage() {
  redirect("/admin/fila");
}
