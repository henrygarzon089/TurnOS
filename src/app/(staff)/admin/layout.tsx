import { Suspense } from "react";
import { redirect } from "next/navigation";
import { SkeletonBlock, SkeletonScreen } from "@/components/ui/Skeleton";
import { getStaffSession } from "@/lib/auth/session";

/**
 * /admin/* es solo para el dueño (REQ-030, design.md §6.1). La verificación de rol va dentro de un
 * Suspense, igual que la sesión en `(staff)/layout.tsx` (REQ-075.1).
 */
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense
      fallback={
        <SkeletonScreen className="space-y-3 py-6">
          <SkeletonBlock className="h-8 w-2/3" />
          <SkeletonBlock className="h-24 w-full rounded-2xl" />
          <SkeletonBlock className="h-24 w-full rounded-2xl" />
        </SkeletonScreen>
      }
    >
      <AdminGate>{children}</AdminGate>
    </Suspense>
  );
}

async function AdminGate({ children }: { children: React.ReactNode }) {
  const session = await getStaffSession();
  if (session?.role !== "owner") {
    redirect("/app");
  }
  return <>{children}</>;
}
