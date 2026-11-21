/**
 * Web del negocio en la portada `/` (REQ-101, ADR-077, design §33.2). Lógica pura.
 */
import { formatCOP } from "./money";
import { hhmmTo12h } from "./public-view";

export type SiteHours = {
  /** 0 = domingo … 6 = sábado, como `business_hours`. */
  weekday: number;
  opensAt: string;
  closesAt: string;
  isClosed: boolean;
}[];

export type SiteLoyalty = {
  visitsRequired: number;
  rewardType: "free_service" | "discount";
  rewardServiceName: string | null;
  rewardAmount: number | null;
} | null;

export type SiteTeamMember = {
  id: string;
  name: string;
  photoPath: string | null;
  /** REQ-103.4: descripción opcional que escribe el dueño. */
  bio: string | null;
};

/** REQ-103.5: producto a la venta en el menú de la web, con su categoría de la vitrina. */
export type SiteMenuItem = {
  id: string;
  name: string;
  price: number;
  photoPath: string | null;
  description?: string | null;
  category?: string | null;
};

const OTHER_CATEGORY = "Otros";

/**
 * REQ-103.5: agrupa el menú por categoría, en el orden del primer producto de cada una (el del
 * dueño); los que no tienen categoría van al final en "Otros".
 */
export function groupProductsByCategory<T extends { category?: string | null }>(
  products: T[],
): { category: string; items: T[] }[] {
  const groups = new Map<string, T[]>();
  const others: T[] = [];
  for (const p of products) {
    const c = p.category?.trim();
    if (!c) {
      others.push(p);
      continue;
    }
    const list = groups.get(c) ?? [];
    list.push(p);
    groups.set(c, list);
  }
  const out = [...groups].map(([category, items]) => ({ category, items }));
  if (others.length > 0) out.push({ category: OTHER_CATEGORY, items: others });
  return out;
}

export type SiteCta = { href: string; label: string; primary: boolean };

const DAY_NAMES = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
const SCHEMA_DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
/** Lunes primero, domingo al final (como se lee el horario en Colombia). */
const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0];

/** REQ-101.2: "Reservar una cita" solo si se puede reservar; si no, "Tomar turno" es el principal. */
export function heroCtas({ canBook, slug }: { canBook: boolean; slug: string }): SiteCta[] {
  const turn = { href: `/${slug}`, label: "Tomar turno" };
  if (!canBook) return [{ ...turn, primary: true }];
  return [
    { href: `/${slug}/cita`, label: "Reservar una cita", primary: true },
    { ...turn, primary: false },
  ];
}

/** REQ-101.3: 7 líneas, lunes primero; un día sin fila en la base se muestra cerrado. */
export function weekHoursLines(hours: SiteHours): { day: string; text: string }[] {
  return WEEK_ORDER.map((wd) => {
    const h = hours.find((x) => x.weekday === wd);
    const text =
      !h || h.isClosed ? "Cerrado" : `${hhmmTo12h(h.opensAt)} – ${hhmmTo12h(h.closesAt)}`;
    return { day: DAY_NAMES[wd], text };
  });
}

function lowerFirst(s: string): string {
  return s.charAt(0).toLocaleLowerCase("es-CO") + s.slice(1);
}

/** REQ-101.3: la regla de fidelidad en una línea, o null si está apagada. */
export function loyaltyLine(l: SiteLoyalty): string | null {
  if (!l) return null;
  const every = `Cada ${l.visitsRequired} visitas`;
  if (l.rewardType === "discount" && l.rewardAmount)
    return `${every}, ${formatCOP(l.rewardAmount)} de descuento`;
  return l.rewardServiceName
    ? `${every}, tu ${lowerFirst(l.rewardServiceName)} gratis`
    : `${every}, un servicio gratis`;
}

/** REQ-101.3 "Cómo llegar": búsqueda de Google Maps por la dirección. */
export function mapsUrl(address: string | null): string | null {
  if (!address?.trim()) return null;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address.trim())}`;
}

/** REQ-101.3 WhatsApp del local con un mensaje listo. Sin datos del visitante. */
export function whatsappLink(e164: string | null, text: string): string | null {
  if (!e164) return null;
  return `https://wa.me/${e164.replace(/\D/g, "")}?text=${encodeURIComponent(text)}`;
}

/** REQ-101.7: "$ 15.000 – $ 45.000", un solo precio si todos valen igual, o null. */
export function priceRange(services: { price: number }[]): string | null {
  if (services.length === 0) return null;
  const prices = services.map((s) => s.price);
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  return min === max ? formatCOP(min) : `${formatCOP(min)} – ${formatCOP(max)}`;
}

type JsonLdInput = {
  name: string;
  description: string | null;
  address: string | null;
  url: string;
  imageUrl: string | null;
  telephone: string | null;
  hours: SiteHours;
  services: { price: number }[];
};

/** REQ-101.7: datos estructurados schema.org `BarberShop` para Google. */
export function barberShopJsonLd(i: JsonLdInput) {
  const ld: Record<string, unknown> & {
    openingHoursSpecification: Record<string, string>[];
  } = {
    "@context": "https://schema.org",
    "@type": "BarberShop",
    name: i.name,
    url: i.url,
    openingHoursSpecification: WEEK_ORDER.flatMap((wd) => {
      const h = i.hours.find((x) => x.weekday === wd);
      if (!h || h.isClosed) return [];
      return [
        {
          "@type": "OpeningHoursSpecification",
          dayOfWeek: `https://schema.org/${SCHEMA_DAYS[wd]}`,
          opens: h.opensAt,
          closes: h.closesAt,
        },
      ];
    }),
  };
  if (i.description) ld.description = i.description;
  if (i.imageUrl) ld.image = i.imageUrl;
  if (i.telephone) ld.telephone = i.telephone;
  if (i.address)
    ld.address = {
      "@type": "PostalAddress",
      streetAddress: i.address,
      addressLocality: "Sabaneta",
      addressRegion: "Antioquia",
      addressCountry: "CO",
    };
  const range = priceRange(i.services);
  if (range) ld.priceRange = range;
  return ld;
}

const NOT_TRACKED = new Set([
  "admin",
  "app",
  "entrar",
  "diseno",
  "salud",
  "api",
  "crear-negocio",
  "t",
  "c",
  "regalo",
  "invitacion",
]);

/**
 * REQ-101.8: se mide la portada y las páginas públicas del negocio. Las del personal no se miden, y
 * las que llevan un token en la dirección (Mi turno, Mi cita, regalo, invitación) tampoco.
 */
export function shouldTrackPath(pathname: string): boolean {
  const first = pathname.split(/[?#]/)[0].split("/").filter(Boolean)[0];
  return first === undefined || !NOT_TRACKED.has(first);
}
