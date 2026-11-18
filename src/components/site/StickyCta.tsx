"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { SiteCta } from "@/lib/domain/site";

/**
 * REQ-101.5: en el celular, cuando el héroe sale de la vista, una barra fija abajo deja a mano
 * "Reservar una cita" o "Tomar turno". Desde 1024 px no hace falta (el encabezado tiene las anclas).
 */
export function StickyCta({ cta }: { cta: SiteCta }) {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const hero = document.querySelector('[data-testid="site-hero"]');
    if (!hero || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(([e]) => setShow(!e.isIntersecting), { threshold: 0 });
    io.observe(hero);
    return () => io.disconnect();
  }, []);

  return (
    <div
      data-testid="sticky-cta"
      aria-hidden={!show}
      className={`border-line bg-card fixed inset-x-0 bottom-0 z-20 border-t p-3 transition-transform lg:hidden ${
        show ? "translate-y-0" : "pointer-events-none translate-y-full"
      }`}
    >
      <Link href={cta.href} className="btn-primary" tabIndex={show ? 0 : -1}>
        {cta.label}
      </Link>
    </div>
  );
}
