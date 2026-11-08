import { notFound } from "next/navigation";
import { Showcase } from "./Showcase";

/**
 * Muestra de los componentes base (T-161, design §22.3) para revisarlos contra el tablero
 * Componentes y probarlos con Playwright. Solo existe en desarrollo.
 */
export const metadata = { title: "Componentes" };

export default function DesignPage() {
  if (process.env.NODE_ENV === "production") notFound();
  return <Showcase />;
}
