import { redirect } from "next/navigation";
import { Suspense } from "react";
import { AdminNav } from "@/components/admin/AdminNav";
import { TodayBadge } from "@/components/admin/today/TodayBadge";
import { CleaningDot } from "@/components/cleaning/CleaningDot";
import { BarberNav } from "@/components/staff/BarberNav";
import { StaffHeader } from "@/components/staff/StaffHeader";
import { SkeletonBlock, SkeletonScreen } from "@/components/ui/Skeleton";
import { getStaffSession } from "@/lib/auth/session";

/**
 * Todas las rutas del personal (/app/*, /admin/*) exigen sesión y membresía en un negocio.
 * Sin membresía (dueño recién registrado) → asistente de creación (REQ-030.1).
 * REQ-075.1 (design §19.1): la espera de la sesión va dentro de un Suspense para que al abrir el
 * link directo se vea el esqueleto y no una pantalla en blanco.
 * El dueño tiene su menú (REQ-077) en todas sus pantallas, también en /app/clientes: barra
 * inferior en el celular (el contenido deja 56 px más abajo) y menú lateral desde 1024 px. El
 * barbero, su barra inferior (T-163) en todos los tamaños y sin encabezado: cada pantalla empieza
 * con su título y Mi fila trae su franja azul (T-169, ADR-051). `data-wide` ensancha la página desde
 * 1024 px y `data-tablet` desde 768 px (la caja en tablet, REQ-078.15).
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
  const owner = session.role === "owner";
  return (
    <div className={`flex flex-1 flex-col ${owner ? "lg:pl-60" : ""}`}>
      {owner && <StaffHeader session={session} />}
      <div
        className={`mx-auto flex w-full max-w-md flex-1 flex-col px-4 ${owner ? "pt-6 pb-40 md:has-[[data-tablet]]:max-w-3xl lg:pb-24 lg:has-[[data-wide]]:max-w-6xl" : "pb-28"}`}
      >
        {children}
      </div>
      {session.role === "barber" && (
        <BarberNav
          cleaningDot={
            <Suspense fallback={null}>
              <CleaningDot />
            </Suspense>
          }
        />
      )}
      {owner && (
        <AdminNav
          todayBadge={
            <Suspense fallback={null}>
              <TodayBadge />
            </Suspense>
          }
        />
      )}
    </div>
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
        <SkeletonBlock className="h-24 w-full rounded-md" />
        <SkeletonBlock className="h-24 w-full rounded-md" />
      </div>
    </SkeletonScreen>
  );
}
