import Link from "next/link";
import { useId } from "react";
import { SkeletonBlock, SkeletonScreen } from "@/components/ui/Skeleton";

/**
 * Bloque de "Hoy" (design §21.1): región con título y, si hay, enlace al módulo. Cada bloque carga
 * por su cuenta, con su propio esqueleto y su propio error (REQ-076.10).
 */
export function TodayCard({
  title,
  badge,
  link,
  children,
}: {
  title: string;
  /** Insignia de conteo junto al título (fuera del nombre de la región). */
  badge?: React.ReactNode;
  link?: { href: string; label: string };
  children: React.ReactNode;
}) {
  const id = useId();
  return (
    <section aria-labelledby={id} className="bg-card border-line rounded-md border">
      <div className="border-line flex min-h-14 items-center justify-between gap-3 border-b px-4">
        <div className="flex items-center gap-2">
          <h2 id={id} className="text-lg font-bold">
            {title}
          </h2>
          {badge}
        </div>
        {link && (
          <Link
            href={link.href}
            className="text-ink inline-flex min-h-12 items-center font-semibold underline underline-offset-4"
          >
            {link.label}
          </Link>
        )}
      </div>
      {children}
    </section>
  );
}

/** Esqueleto de un bloque: título y `rows` filas, mientras llegan los datos (REQ-075.2). */
export function TodayCardSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <SkeletonScreen className="bg-card border-line rounded-md border">
      <div className="border-line flex min-h-14 items-center border-b px-4">
        <SkeletonBlock className="h-5 w-32" />
      </div>
      <div className="flex flex-col gap-3 p-4">
        <SkeletonBlock className="h-10 w-40" />
        {Array.from({ length: rows }, (_, i) => (
          <SkeletonBlock key={i} className="h-6 w-full" />
        ))}
      </div>
    </SkeletonScreen>
  );
}
