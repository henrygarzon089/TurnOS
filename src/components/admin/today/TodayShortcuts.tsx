import Link from "next/link";
import { NewSaleButton } from "@/components/cash/NewSaleSheet";

/**
 * REQ-076.8, REQ-078.29 accesos directos de "Hoy": "Nueva venta" (el único botón relleno de la
 * pantalla, REQ-078.4) abre la hoja de cobro ahí mismo; "Fila" y "Cerrar caja" llevan a su
 * módulo. Escritorio: junto al título. Tablet: los tres fijos abajo, a la derecha. Celular: solo
 * "Cerrar caja" y "Nueva venta" fijos sobre el menú ("Fila" ya está en el menú, design §22.8). El
 * tablero dice "Llamar al siguiente", pero el dueño llama desde la fila con "Llamar con".
 */
const FIT = "whitespace-nowrap max-md:px-3 max-lg:text-base md:w-auto";

export function TodayShortcuts() {
  return (
    <div
      role="group"
      aria-label="Accesos directos"
      className="bg-surface border-line fixed inset-x-0 bottom-[calc(3.5rem+1px+env(safe-area-inset-bottom))] z-10 grid grid-cols-[2fr_3fr] gap-2 border-t p-4 md:flex md:justify-end lg:static lg:border-0 lg:bg-transparent lg:p-0"
    >
      <Link href="/admin/fila" className={`btn-secondary max-md:hidden ${FIT}`}>
        Fila
      </Link>
      <Link href="/admin/caja" className={`btn-secondary ${FIT}`}>
        Cerrar caja
      </Link>
      <NewSaleButton className={`btn-primary ${FIT}`} toast />
    </div>
  );
}
