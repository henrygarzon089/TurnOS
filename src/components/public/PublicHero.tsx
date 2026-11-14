import Image from "next/image";
import { businessMark } from "@/lib/domain/public-view";
import { mediaUrl } from "@/lib/media/paths";

/**
 * REQ-087.2 / REQ-088.1 (design.md §26.3): la cabecera de la portada. La foto del local arriba (si
 * la hay; es la imagen grande del primer pantallazo, por eso `priority`), el logo o la marca en
 * azul marino, el nombre (el `h1`) y el estado. `compact` la deja en una línea durante los pasos.
 * Colores de TurnOS (REQ-087.3, PA-H20-1).
 */
export function PublicHero({
  name,
  subtitle,
  logoPath,
  coverPath,
  compact = false,
  aside,
}: {
  name: string;
  subtitle?: React.ReactNode;
  logoPath: string | null;
  coverPath: string | null;
  compact?: boolean;
  aside?: React.ReactNode;
}) {
  const showCover = Boolean(coverPath) && !compact;
  return (
    <header className="border-line bg-card border-b" data-testid="public-hero">
      {showCover && (
        <div className="relative mx-auto aspect-[2/1] max-h-72 w-full max-w-6xl overflow-hidden lg:mt-6 lg:aspect-[4/1] lg:rounded-lg">
          <Image
            src={mediaUrl(coverPath!)}
            alt={`Foto del local de ${name}`}
            fill
            priority
            unoptimized
            sizes="(min-width: 1152px) 1152px, 100vw"
            className="object-cover"
          />
        </div>
      )}
      <div className="mx-auto flex min-h-12 w-full max-w-6xl items-center gap-3 px-4 py-3 lg:px-16">
        {logoPath ? (
          <Image
            src={mediaUrl(logoPath)}
            alt={`Logo de ${name}`}
            width={compact ? 48 : 64}
            height={compact ? 48 : 64}
            unoptimized
            className={`${compact ? "size-12" : `size-16 ${showCover ? "ring-card -mt-10 ring-4" : ""}`} bg-card shrink-0 rounded-md object-cover`}
          />
        ) : (
          <span
            aria-hidden="true"
            className={`${compact ? "size-12 text-lg" : `size-16 text-xl ${showCover ? "ring-card -mt-10 ring-4" : ""}`} bg-brand text-brand-ink flex shrink-0 items-center justify-center rounded-md font-bold tabular-nums`}
          >
            {businessMark(name)}
          </span>
        )}
        <div className="min-w-0 flex-1">
          <h1 className={`truncate leading-tight font-bold ${compact ? "text-lg" : "text-2xl"}`}>
            {name}
          </h1>
          {subtitle && <p className="text-muted truncate text-sm">{subtitle}</p>}
        </div>
        {aside}
      </div>
    </header>
  );
}
