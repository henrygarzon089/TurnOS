import Image from "next/image";
import { initials } from "@/lib/domain/my-ticket";
import { mediaUrl } from "@/lib/media/paths";

const SIZES = {
  sm: "size-10 text-sm",
  md: "size-14 text-base",
  lg: "size-20 text-xl",
} as const;
const PX = { sm: 40, md: 56, lg: 80 } as const;

/**
 * REQ-085.4 / REQ-085.5: la foto del barbero en un círculo; sin foto, sus iniciales. Las fotos ya
 * vienen reducidas a 400 px desde el celular (§26.2): no pasan por el optimizador.
 */
export function Avatar({
  name,
  photoPath,
  size = "md",
  dimmed = false,
}: {
  name: string;
  photoPath: string | null | undefined;
  size?: keyof typeof SIZES;
  dimmed?: boolean;
}) {
  const base = `${SIZES[size]} shrink-0 rounded-full ${dimmed ? "opacity-50 grayscale" : ""}`;
  if (photoPath) {
    return (
      <Image
        src={mediaUrl(photoPath)}
        alt={`Foto de ${name}`}
        width={PX[size]}
        height={PX[size]}
        unoptimized
        loading="lazy"
        className={`${base} object-cover`}
      />
    );
  }
  return (
    <span
      aria-hidden="true"
      data-testid="avatar-initials"
      className={`${base} bg-brand-soft text-brand flex items-center justify-center font-bold`}
    >
      {initials(name)}
    </span>
  );
}
