import type { Metadata } from "next";
import { OwnerQueue } from "@/components/queue/OwnerQueue";
import { getBusinessQueue } from "@/lib/actions/queue";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Fila" };

/** REQ-012: la fila del negocio para el dueño. */
export default async function OwnerQueuePage() {
  const view = await getBusinessQueue();
  if (!view) return null;
  return <OwnerQueue initial={view} />;
}
