import { redirect } from "next/navigation";
import { Suspense } from "react";
import { AdminNav } from "@/components/admin/AdminNav";
import { NavAlertBadge } from "@/components/admin/today/NavAlertBadge";
import { NavCount } from "@/components/admin/today/NavCount";
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
 * inferior en el celular (el contenido deja 56 px más abajo) y menú lateral desde 1024 px, debajo
 * de su barra azul (REQ-078.27). Desde 1024 px todas sus pantallas usan el ancho de escritorio
 * (`lg:max-w-6xl`, ADR-053); `data-tablet` ensancha desde 768 px (la caja, REQ-078.15).
 * El barbero, su barra inferior (T-163) en todos los tamaños y sin encabezado: cada pantalla empieza
 * con su título y Mi fila trae su franja azul (T-169, ADR-051).
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
    // Por debajo de 1024 px, una pantalla del dueño con su propia cabecera azul (`data-screen-header`,
    // design §22.8) oculta la barra del negocio para no mostrar dos barras azules.
    <div
      className={`flex flex-1 flex-col ${owner ? "max-lg:has-[[data-screen-header]]:[&>header]:hidden" : ""}`}
    >
      {owner && <StaffHeader session={session} />}
      <div className={`flex flex-1 flex-col ${owner ? "lg:pl-60" : ""}`}>
        <div
          className={`mx-auto flex w-full max-w-md flex-1 flex-col px-4 ${owner ? "pt-6 pb-40 md:max-lg:has-[[data-tablet]]:max-w-3xl lg:max-w-6xl lg:pb-24" : "pb-28"}`}
        >
          {children}
        </div>
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
          badges={{
            ...Object.fromEntries(
              ["/admin/fila", "/admin/citas"].map((href) => [
                href,
                <Suspense key={href} fallback={null}>
                  <NavCount href={href} />
                </Suspense>,
              ]),
            ),
            ...Object.fromEntries(
              ["/admin/limpieza", "/admin/inventario"].map((href) => [
                href,
                <Suspense key={href} fallback={null}>
                  <NavAlertBadge href={href} testId={`nav-badge-${href.split("/").at(-1)}`} />
                </Suspense>,
              ]),
            ),
          }}
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
