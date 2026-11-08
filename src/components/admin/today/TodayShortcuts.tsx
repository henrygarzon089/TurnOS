import Link from "next/link";
import { NewSaleButton } from "@/components/cash/NewSaleSheet";

/**
 * REQ-076.8 accesos directos de "Hoy": "Nueva venta" (el único botón relleno de la pantalla,
 * REQ-078.4) abre la hoja de cobro ahí mismo; "Fila" y "Cerrar caja" llevan a su módulo. En el
 * celular es una barra fija encima del menú (como la de la fila del dueño); en escritorio va junto
 * al título.
 */
/** En el celular caben los tres en una línea de 375 px; en escritorio, a su ancho. */
const FIT = "whitespace-nowrap max-lg:px-3 max-lg:text-base lg:w-auto";

export function TodayShortcuts() {
  return (
    <div
      role="group"
      aria-label="Accesos directos"
      className="bg-surface fixed inset-x-0 bottom-[calc(3.5rem+1px+env(safe-area-inset-bottom))] z-10 grid grid-cols-[auto_auto_1fr] gap-2 p-4 lg:static lg:flex lg:bg-transparent lg:p-0"
    >
      <Link href="/admin/fila" className={`btn-secondary ${FIT}`}>
        Fila
      </Link>
      <Link href="/admin/caja" className={`btn-secondary ${FIT}`}>
        Cerrar caja
      </Link>
      <NewSaleButton className={`btn-primary ${FIT}`} toast />
    </div>
  );
}
