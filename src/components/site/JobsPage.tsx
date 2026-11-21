import Image from "next/image";
import Link from "next/link";
import { GammaMark } from "@/components/brand/GammaMark";
import { Icon, type IconName } from "@/components/ui/Icon";
import type { PublicBusiness } from "@/lib/queue/public-queue";
import { HIRING_WHATSAPP_E164, SITE_URL } from "@/lib/brand";
import { formatPhoneCO } from "@/lib/domain/phone";
import { hiringWhatsappLink, jobPostingJsonLd } from "@/lib/domain/jobs";
import { mediaUrl } from "@/lib/media/paths";
import { JobApplicationForm } from "./JobApplicationForm";

/** Fecha del aviso para `JobPosting` (REQ-102.8): el día en que se publicó la página. */
export const JOB_POSTED_ON = "2026-11-20";

const BENEFITS: { icon: IconName; title: string; text: string }[] = [
  { icon: "clock", title: "Horario flexible", text: "Organiza tu agenda a tu ritmo." },
  { icon: "cash", title: "% negociable", text: "Gana bien por tu talento en cada servicio." },
  { icon: "chart", title: "Únete al club", text: "Un lugar en crecimiento, para crecer con él." },
];

/** PA-H28-1 (ADR-079). */
const LOOKING_FOR = [
  "Mínimo 1 año de experiencia, o un portafolio que lo muestre.",
  "Buena actitud, puntualidad y buen trato con el cliente.",
  "Para estilistas: blower, corte y peinado.",
  "Ganas de crecer con el club.",
];

/** PA-H28-2 (ADR-079). */
const STEPS: [string, string][] = [
  ["Te postulas aquí", "Llenas el formulario en dos minutos, desde el celular."],
  ["Te escribimos", "Por WhatsApp, en máximo 3 días hábiles."],
  ["Nos conocemos", "Vienes al local, conoces el espacio y haces una prueba de corte."],
  ["Acordamos", "Tu horario y tu porcentaje. Y empiezas."],
];

const FAQ: [string, string][] = [
  [
    "¿Cómo se paga?",
    "Ganas un porcentaje de cada servicio que haces. El porcentaje es negociable y lo acordamos cuando nos conozcamos.",
  ],
  [
    "¿Tengo que cumplir un horario fijo?",
    "No. Organizas tu agenda a tu ritmo dentro del horario del local.",
  ],
  [
    "¿De dónde salen los clientes?",
    "Del local, de la web y de Instagram: los clientes toman turno con el QR y reservan citas en línea.",
  ],
  [
    "¿También atienden mujeres?",
    "Sí. Barbería premium para él; blower, corte y estilo para ella. Por eso buscamos barberos y estilistas.",
  ],
  [
    "¿Puedo postularme si soy de otro país?",
    "Sí. En el formulario escoge «Mi celular es de otro país» y escribe tu número con el indicativo.",
  ],
];

/**
 * "Trabaja con nosotros" (REQ-102, ADR-079, design §34.3) con el estilo de la web (REQ-101.12):
 * héroe navy con la foto del local, beneficios del aviso, qué buscamos, proceso, preguntas,
 * formulario y WhatsApp. Sobre el pago solo "% negociable" (REQ-102.1).
 */
export function JobsPage({ business: b }: { business: PublicBusiness }) {
  const whatsapp = hiringWhatsappLink(HIRING_WHATSAPP_E164, b.name);
  const photos = [b.coverPath, ...b.services.map((s) => s.photoPath)]
    .filter((p): p is string => Boolean(p))
    .slice(0, 4);
  const jsonLd = jobPostingJsonLd({
    businessName: b.name,
    url: `${SITE_URL}/trabaja-con-nosotros`,
    siteUrl: SITE_URL,
    address: b.address,
    datePosted: JOB_POSTED_ON,
    description:
      "Buscamos barberos y estilistas en San Remo, Sabaneta. Barbería premium para él; blower, corte y estilo para ella. Horario flexible y porcentaje negociable.",
  });

  return (
    <div className="bg-surface flex flex-1 flex-col">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }}
      />
      <header className="fixed inset-x-0 top-3 z-30 px-3">
        <div className="bg-card ring-line mx-auto flex h-14 w-full max-w-6xl items-center gap-2 rounded-full pr-2 pl-2 shadow-[0_8px_30px_rgb(20_37_74/0.18)] ring-1">
          <Link href="/" className="flex min-w-0 items-center gap-2" aria-label={`${b.name}, inicio`}>
            <span className="bg-brand flex size-10 shrink-0 items-center justify-center rounded-full">
              <GammaMark variant="negativo" size={26} decorative />
            </span>
            <span className="truncate text-sm font-semibold tracking-[0.3em] uppercase">{b.name}</span>
          </Link>
          <a
            href="#postular"
            className="bg-brand text-brand-ink ml-auto flex h-10 shrink-0 items-center rounded-full px-5 text-sm font-semibold"
          >
            Postularme
          </a>
        </div>
      </header>

      <main className="flex flex-1 flex-col">
        <section
          data-testid="jobs-hero"
          className="bg-brand text-brand-ink relative isolate flex min-h-[100svh] flex-col justify-end overflow-hidden"
        >
          {b.coverPath && (
            <Image
              src={mediaUrl(b.coverPath)}
              alt={`Foto de ${b.name}`}
              fill
              priority
              unoptimized
              sizes="100vw"
              className="-z-20 object-cover"
            />
          )}
          <div aria-hidden="true" className="bg-brand/75 absolute inset-0 -z-10" />
          <div className="mx-auto flex w-full max-w-6xl flex-col gap-5 px-5 pt-28 pb-10 lg:px-16 lg:pb-20">
            <p className="text-accent-on-brand ring-accent-on-brand self-start rounded-full px-3 py-1 text-xs font-bold tracking-[0.3em] uppercase ring-1 ring-inset">
              Oportunidad laboral
            </p>
            <div className="flex flex-col gap-3">
              <p className="text-brand-ink/80 text-xs font-semibold tracking-[0.3em] uppercase">
                Buscamos
              </p>
              <h1 className="text-[clamp(2.5rem,12vw,7rem)] leading-[0.95] font-bold">
                Barberos <span className="text-accent-on-brand">&amp;</span>
                <br />
                Estilistas
              </h1>
              <p className="text-lg font-semibold sm:text-2xl">
                Barbería premium para él · Blower, corte y estilo para ella
              </p>
              <p className="text-brand-ink/85">
                Espacio de cuidado personal en San Remo, Sabaneta.
              </p>
            </div>
            <div className="grid max-w-lg grid-cols-2 gap-3">
              <a
                href="#postular"
                className="bg-card text-ink flex min-h-12 items-center justify-center rounded-full px-3 text-center text-sm font-semibold sm:text-base"
              >
                Postularme
              </a>
              <a
                href={whatsapp}
                target="_blank"
                rel="noopener"
                className="text-brand-ink ring-brand-ink/60 flex min-h-12 items-center justify-center rounded-full px-3 text-center text-sm leading-tight font-semibold ring-1 ring-inset sm:text-base"
              >
                Escribir por WhatsApp
              </a>
            </div>
          </div>
        </section>

        <section aria-labelledby="beneficios-titulo" className="bg-card">
          <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-5 py-20 lg:px-16">
            <Heading id="beneficios-titulo" eyebrow="Por qué Gamma Club">
              Tu talento, <span className="text-muted">tu agenda.</span>
            </Heading>
            <ul className="grid gap-4 sm:grid-cols-3">
              {BENEFITS.map((x) => (
                <li key={x.title} className="reveal bg-brand text-brand-ink flex flex-col gap-4 rounded-[2rem] p-6">
                  <span className="bg-card text-ink flex size-12 items-center justify-center rounded-full">
                    <Icon name={x.icon} className="size-6" />
                  </span>
                  <h3 className="text-2xl font-bold">{x.title}</h3>
                  <p className="text-brand-ink/85">{x.text}</p>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section aria-labelledby="buscamos-titulo">
          <div className="mx-auto grid w-full max-w-6xl gap-10 px-5 py-20 lg:grid-cols-2 lg:px-16">
            <div className="flex flex-col gap-6">
              <Heading id="buscamos-titulo" eyebrow="Qué buscamos">
                Gente que ama <span className="text-muted">el oficio.</span>
              </Heading>
              <ul className="flex flex-col gap-3">
                {LOOKING_FOR.map((t) => (
                  <li key={t} className="flex items-start gap-3 text-lg">
                    <span className="bg-brand text-brand-ink mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full">
                      <Icon name="check" className="size-4" />
                    </span>
                    {t}
                  </li>
                ))}
              </ul>
            </div>
            {photos.length > 0 && (
              <ul className="grid grid-cols-2 gap-3" aria-label={`Fotos de ${b.name}`}>
                {photos.map((p, i) => (
                  <li
                    key={p}
                    className={`reveal relative overflow-hidden rounded-[1.5rem] ${
                      i === 0 ? "col-span-2 aspect-[16/9]" : "aspect-square"
                    }`}
                  >
                    <Image
                      src={mediaUrl(p)}
                      alt=""
                      fill
                      unoptimized
                      loading="lazy"
                      sizes="(min-width: 1024px) 25vw, 50vw"
                      className="object-cover"
                    />
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>

        <section aria-labelledby="proceso-titulo" className="bg-card">
          <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-5 py-20 lg:px-16">
            <Heading id="proceso-titulo" eyebrow="Cómo es el proceso">
              Cuatro pasos <span className="text-muted">y estás dentro.</span>
            </Heading>
            <ol className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
              {STEPS.map(([title, text], i) => (
                <li key={title} className="reveal flex flex-col gap-2">
                  <span className="text-link text-sm font-semibold tabular-nums">0{i + 1}</span>
                  <h3 className="text-2xl font-bold">{title}</h3>
                  <p className="text-muted text-lg">{text}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section id="postular" aria-labelledby="postular-titulo" className="scroll-mt-24">
          <div className="mx-auto grid w-full max-w-6xl gap-10 px-5 py-20 lg:grid-cols-[1fr_1.2fr] lg:px-16">
            <div className="flex flex-col gap-4">
              <Heading id="postular-titulo" eyebrow="Postúlate">
                Cuéntanos <span className="text-muted">quién eres.</span>
              </Heading>
              <p className="text-muted text-lg">
                Dos minutos. Te escribimos por WhatsApp en máximo 3 días hábiles.
              </p>
            </div>
            <div className="bg-card border-line rounded-[2rem] border p-5 sm:p-8">
              <JobApplicationForm slug={b.slug} privacyVersion={b.privacyVersion} />
            </div>
          </div>
        </section>

        <section aria-labelledby="preguntas-titulo" className="bg-card">
          <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-5 py-20">
            <Heading id="preguntas-titulo" eyebrow="Preguntas frecuentes">
              Lo que <span className="text-muted">nos preguntan.</span>
            </Heading>
            <div className="divide-line border-line divide-y border-y">
              {FAQ.map(([q, a]) => (
                <details key={q} className="group py-2">
                  <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-4 text-lg font-semibold">
                    {q}
                    <Icon name="plus" className="size-5 shrink-0 transition-transform group-open:rotate-45" />
                  </summary>
                  <p className="text-muted pb-3 text-lg">{a}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        <section aria-labelledby="contacto-titulo">
          <div className="mx-auto w-full max-w-6xl px-5 py-20 lg:px-16">
            <div className="bg-brand text-brand-ink flex flex-col gap-6 rounded-[2rem] px-6 py-12 lg:px-16">
              <h2
                id="contacto-titulo"
                className="text-brand-ink/80 text-xs font-semibold tracking-[0.3em] uppercase"
              >
                Llama o escribe
              </h2>
              <p className="text-4xl font-bold tabular-nums lg:text-6xl">
                {formatPhoneCO(HIRING_WHATSAPP_E164)}
              </p>
              <div className="flex flex-col gap-3 sm:flex-row">
                <a
                  href={whatsapp}
                  target="_blank"
                  rel="noopener"
                  className="bg-card text-ink flex min-h-12 items-center justify-center rounded-full px-6 font-semibold"
                >
                  Escribir por WhatsApp
                </a>
                <a
                  href={`tel:${HIRING_WHATSAPP_E164}`}
                  className="text-brand-ink ring-brand-ink/60 flex min-h-12 items-center justify-center rounded-full px-6 font-semibold ring-1 ring-inset"
                >
                  Llamar
                </a>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-line text-muted border-t">
        <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center gap-x-6 gap-y-2 px-5 py-6 text-sm lg:px-16">
          <span>© {b.name}</span>
          <Link href="/" className="text-link min-h-12 content-center">
            Volver al inicio
          </Link>
          <Link href={`/${b.slug}/privacidad`} className="text-link min-h-12 content-center">
            Política de privacidad
          </Link>
        </div>
      </footer>
    </div>
  );
}

function Heading({
  id,
  eyebrow,
  children,
}: {
  id: string;
  eyebrow: string;
  children: React.ReactNode;
}) {
  return (
    <div className="reveal flex flex-col gap-3">
      <h2 id={id} className="text-link text-xs font-semibold tracking-[0.3em] uppercase">
        {eyebrow}
      </h2>
      <p className="text-4xl leading-tight font-bold lg:text-5xl">{children}</p>
    </div>
  );
}
