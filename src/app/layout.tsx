import type { Metadata, Viewport } from "next";
import { ServiceWorker } from "@/components/ui/ServiceWorker";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "TurnOS",
    template: "%s · TurnOS",
  },
  description: "Toma tu turno sin esperar en el local.",
  applicationName: "TurnOS",
  // REQ-032.1 iOS Safari "Agregar a inicio" (la app del personal; las públicas usan la del negocio)
  appleWebApp: { capable: true, title: "TurnOS", statusBarStyle: "default" },
  icons: { apple: "/icons/apple-touch-icon.png" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#1f2937",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="es-CO" className="h-full antialiased">
      <body className="bg-surface text-ink flex min-h-full flex-col">
        {children}
        <ServiceWorker />
      </body>
    </html>
  );
}
