import { Montserrat } from "next/font/google";

/**
 * Letra de Gamma Club (REQ-091.4, design §27.2). `next/font` la descarga al compilar y la sirve
 * desde el dominio de la app: el celular no le pide nada a Google. La letra de reemplazo queda
 * ajustada (por defecto) para que el cambio no mueva la página (CLS ≤ 0,1).
 */
export const montserrat = Montserrat({
  weight: ["400", "600", "700"],
  subsets: ["latin"],
  display: "swap",
  variable: "--font-montserrat",
});
