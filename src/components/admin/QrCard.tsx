"use client";

import QRCode from "qrcode";
import { useEffect, useState } from "react";
import { renderTemplate } from "@/lib/notifications/render";

/** REQ-001.2 / REQ-001.3: QR imprimible, copiar enlace, compartir por WhatsApp. */
export function QrCard({
  url,
  slug,
  businessName,
  template,
}: {
  url: string;
  slug: string;
  businessName: string;
  template: string;
}) {
  const [png, setPng] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let alive = true;
    QRCode.toDataURL(url, { width: 1024, margin: 2, errorCorrectionLevel: "M" })
      .then((d) => alive && setPng(d))
      .catch(() => alive && setPng(null));
    return () => {
      alive = false;
    };
  }, [url]);

  const waText = renderTemplate(template, { negocio: businessName, enlace: url });
  const wa = `https://wa.me/?text=${encodeURIComponent(waText)}`;

  return (
    <div className="mt-4 flex flex-col items-center gap-4">
      {png ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={png}
          alt={`Código QR de la fila de ${businessName}`}
          className="bg-card border-line w-64 rounded-2xl border p-2"
        />
      ) : (
        <div className="bg-card border-line h-64 w-64 animate-pulse rounded-2xl border" />
      )}
      <p className="text-muted text-center text-sm break-all">{url}</p>
      <div className="flex w-full flex-col gap-2">
        <a
          href={png ?? "#"}
          download={`qr-${slug}.png`}
          className="btn-primary"
          aria-disabled={!png}
        >
          Descargar QR para imprimir (PNG)
        </a>
        <button
          type="button"
          className="btn-secondary"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(url);
              setCopied(true);
              setTimeout(() => setCopied(false), 2000);
            } catch {
              setCopied(false);
            }
          }}
        >
          {copied ? "Enlace copiado ✓" : "Copiar enlace"}
        </button>
        <a href={wa} target="_blank" rel="noopener" className="btn-secondary">
          Compartir por WhatsApp
        </a>
      </div>
    </div>
  );
}
