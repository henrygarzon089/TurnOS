import { Suspense } from "react";
import { redirect } from "next/navigation";
import { StaffHeader } from "@/components/staff/StaffHeader";
import { SkeletonBlock, SkeletonScreen } from "@/components/ui/Skeleton";
import { getStaffSession } from "@/lib/auth/session";

/**
 * Todas las rutas del personal (/app/*, /admin/*) exigen sesión y membresía en un negocio.
 * Sin membresía (dueño recién registrado) → asistente de creación (REQ-030.1).
 * REQ-075.1 (design §19.1): la espera de la sesión va dentro de un Suspense para que al abrir el
 * link directo se vea el esqueleto y no una pantalla en blanco.
 */
export default function StaffLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<StaffShellSkeleton />}>
      <StaffGate>{children}</StaffGate>
    </Suspense>
  );
}

async function StaffGate({ children }: { children: React.ReactNode }) {
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

/** Encabezado y tres bloques, sin datos (REQ-075.2). */
function StaffShellSkeleton() {
  return (
    <SkeletonScreen className="flex flex-1 flex-col">
      <div className="border-line bg-card border-b">
        <div className="mx-auto w-full max-w-md px-4 py-3">
          <SkeletonBlock className="h-5 w-1/2" />
          <SkeletonBlock className="mt-2 h-4 w-1/3" />
        </div>
      </div>
      <div className="mx-auto w-full max-w-md space-y-3 px-4 py-6">
        <SkeletonBlock className="h-8 w-2/3" />
        <SkeletonBlock className="h-24 w-full rounded-2xl" />
        <SkeletonBlock className="h-24 w-full rounded-2xl" />
      </div>
    </SkeletonScreen>
  );
}
