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
  primary = true,
}: {
  url: string;
  slug: string;
  businessName: string;
  template: string;
  /** Descargar relleno; junto al horario en /admin/horario va en contorno (REQ-078.4). */
  primary?: boolean;
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
    <div className="@container flex flex-col gap-4 p-4 sm:flex-row sm:items-start">
      <figure className="border-line mx-auto flex w-48 shrink-0 flex-col items-center gap-2 rounded-md border p-3 text-center">
        <figcaption className="font-bold">{businessName}</figcaption>
        {png ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={png}
            alt={`Código QR de la fila de ${businessName}`}
            width={160}
            height={160}
            className="size-40"
          />
        ) : (
          <div className="bg-skeleton size-40 rounded-sm" />
        )}
        <p className="text-muted text-sm">Escanea y toma turno. Espera en tu casa.</p>
      </figure>
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <p className="text-muted text-sm">
          Lleva a la página <span className="text-ink font-bold">/{slug}.</span> Imprímelo en carta
          y pégalo en la entrada y en cada espejo.
        </p>
        <p className="text-muted text-sm break-all">{url}</p>
        <a
          href={png ?? "#"}
          download={`qr-${slug}.png`}
          className={primary ? "btn-primary" : "btn-secondary"}
          aria-disabled={!png}
        >
          Descargar QR para imprimir
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
