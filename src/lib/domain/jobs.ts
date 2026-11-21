/**
 * "Trabaja con nosotros" (REQ-102, ADR-079, design §34.2). Lógica pura: validar la postulación,
 * enlaces de WhatsApp y datos estructurados `JobPosting`.
 */
import { normalizeBarberPhone, waMeNumber, type PhoneCountry } from "./phone";

export const JOB_ROLES = ["barbero", "estilista", "ambos"] as const;
export type JobRole = (typeof JOB_ROLES)[number];
export const JOB_AVAILABILITY = ["tiempo_completo", "medio_tiempo", "fines_de_semana"] as const;
export type JobAvailability = (typeof JOB_AVAILABILITY)[number];
export const JOB_STATUSES = ["nueva", "contactada", "descartada"] as const;
export type JobStatus = (typeof JOB_STATUSES)[number];

export const ROLE_LABEL: Record<JobRole, string> = {
  barbero: "Barbero",
  estilista: "Estilista",
  ambos: "Barbero y estilista",
};
export const AVAILABILITY_LABEL: Record<JobAvailability, string> = {
  tiempo_completo: "Tiempo completo",
  medio_tiempo: "Medio tiempo",
  fines_de_semana: "Fines de semana",
};
export const STATUS_LABEL: Record<JobStatus, string> = {
  nueva: "Nueva",
  contactada: "Contactada",
  descartada: "Descartada",
};

export type JobApplicationInput = {
  name: string;
  phone: string;
  phoneCountry: PhoneCountry;
  role: string;
  years: string;
  portfolio: string;
  availability: string;
  message: string;
  privacyAccepted: boolean;
  /** Campo trampa oculto: una persona lo deja vacío (REQ-102.5). */
  website: string;
};

export type JobApplication = {
  name: string;
  phoneE164: string;
  role: JobRole;
  years: number;
  portfolioUrl: string | null;
  availability: JobAvailability;
  message: string | null;
};

export type JobField = "name" | "phone" | "role" | "years" | "portfolio" | "availability" | "message" | "privacy";

/**
 * REQ-102.4 enlace con su trabajo: `https://…` tal cual; `@usuario` o `usuario` → Instagram;
 * `instagram.com/usuario` → con https. Vacío → null. Cualquier otra cosa → undefined (inválido).
 */
export function portfolioUrl(raw: string): string | null | undefined {
  const v = raw.trim();
  if (!v) return null;
  let url: string;
  if (/^https:\/\//i.test(v)) url = v;
  else if (/^(www\.)?instagram\.com\//i.test(v)) url = `https://${v.replace(/^www\./i, "")}`;
  else if (/^@?[a-z0-9._]{1,30}$/i.test(v)) url = `https://instagram.com/${v.replace(/^@/, "")}`;
  else return undefined;
  if (url.length > 200 || /\s/.test(url)) return undefined;
  return url;
}

/** REQ-102.3 / REQ-102.4: datos válidos o un mensaje claro por campo. `spam` si llenó la trampa. */
export function parseJobApplication(
  i: JobApplicationInput,
): { ok: true; data: JobApplication } | { ok: false; spam?: true; errors: Partial<Record<JobField, string>> } {
  if (i.website.trim()) return { ok: false, spam: true, errors: {} };
  const errors: Partial<Record<JobField, string>> = {};
  const name = i.name.trim().replace(/\s+/g, " ");
  if (name.length < 2 || name.length > 80) errors.name = "Escribe tu nombre (2 a 80 letras).";
  const phone = normalizeBarberPhone(i.phone, i.phoneCountry);
  if (!phone)
    errors.phone =
      i.phoneCountry === "co"
        ? "Escribe un celular colombiano de 10 dígitos que empiece por 3."
        : "Escribe el número con + y el indicativo del país.";
  const role = (JOB_ROLES as readonly string[]).includes(i.role) ? (i.role as JobRole) : null;
  if (!role) errors.role = "Escoge si eres barbero, estilista o las dos.";
  const years = /^\d{1,2}$/.test(i.years.trim()) ? Number(i.years.trim()) : NaN;
  if (!Number.isInteger(years) || years < 0 || years > 60)
    errors.years = "Escribe tus años de experiencia (0 a 60).";
  const portfolio = portfolioUrl(i.portfolio);
  if (portfolio === undefined)
    errors.portfolio = "Escribe tu usuario de Instagram (@usuario) o un enlace que empiece por https://.";
  const availability = (JOB_AVAILABILITY as readonly string[]).includes(i.availability)
    ? (i.availability as JobAvailability)
    : null;
  if (!availability) errors.availability = "Escoge tu disponibilidad.";
  const message = i.message.trim() || null;
  if (message && message.length > 500) errors.message = "El mensaje puede tener hasta 500 letras.";
  if (!i.privacyAccepted) errors.privacy = "Para enviar, acepta el aviso de privacidad.";
  if (Object.keys(errors).length > 0) return { ok: false, errors };
  return {
    ok: true,
    data: {
      name,
      phoneE164: phone!,
      role: role!,
      years,
      portfolioUrl: portfolio ?? null,
      availability: availability!,
      message,
    },
  };
}

/** REQ-102.2 botón de la página: WhatsApp de contratación con un mensaje listo. */
export function hiringWhatsappLink(e164: string, businessName: string): string {
  const text = `Hola, vi el aviso de ${businessName} y quiero trabajar con ustedes.`;
  return `https://wa.me/${waMeNumber(e164)}?text=${encodeURIComponent(text)}`;
}

/** REQ-102.6 botón del dueño: escribirle a quien se postuló con un saludo listo. */
export function applicantWhatsappLink(e164: string, name: string, businessName: string): string {
  const first = name.trim().split(/\s+/)[0] ?? "";
  const text = `Hola ${first}, te escribimos de ${businessName} por tu postulación.`;
  return `https://wa.me/${waMeNumber(e164)}?text=${encodeURIComponent(text)}`;
}

/** REQ-102.8 datos estructurados `JobPosting` (sin salario: el pago es "% negociable"). */
export function jobPostingJsonLd(i: {
  businessName: string;
  url: string;
  siteUrl: string;
  address: string | null;
  datePosted: string;
  description: string;
}) {
  return {
    "@context": "https://schema.org",
    "@type": "JobPosting",
    title: "Barbero o estilista",
    description: i.description,
    datePosted: i.datePosted,
    employmentType: ["FULL_TIME", "PART_TIME", "CONTRACTOR"],
    url: i.url,
    hiringOrganization: { "@type": "Organization", name: i.businessName, sameAs: i.siteUrl },
    jobLocation: {
      "@type": "Place",
      address: {
        "@type": "PostalAddress",
        ...(i.address ? { streetAddress: i.address } : {}),
        addressLocality: "Sabaneta",
        addressRegion: "Antioquia",
        addressCountry: "CO",
      },
    },
  };
}

/** Días desde que llegó una postulación, para la lista del dueño ("Hoy", "Hace 3 días"). */
export function receivedLabel(createdAt: string, now: Date = new Date()): string {
  const days = Math.floor((now.getTime() - new Date(createdAt).getTime()) / 86_400_000);
  if (days <= 0) return "Hoy";
  if (days === 1) return "Ayer";
  return `Hace ${days} días`;
}
