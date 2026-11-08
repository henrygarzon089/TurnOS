import { notFound } from "next/navigation";
import { Showcase } from "./Showcase";

/**
 * Muestra de los componentes base (T-161, design §22.3) para revisarlos contra el tablero
 * Componentes y probarlos con Playwright. Solo existe en desarrollo y en el build del CI de las
 * E2E (`DESIGN_SHOWCASE=1`); en producción da 404.
 */
export const metadata = { title: "Componentes" };

export default function DesignPage() {
  if (process.env.NODE_ENV === "production" && process.env.DESIGN_SHOWCASE !== "1") notFound();
  return <Showcase />;
}
