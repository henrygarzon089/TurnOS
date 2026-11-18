import Image from "next/image";
import Link from "next/link";
import { GammaMark } from "@/components/brand/GammaMark";
import { Icon } from "@/components/ui/Icon";
import type { SiteHomeData } from "@/lib/actions/site";
import { INSTAGRAM_URL, SHOP_WHATSAPP_E164, SITE_TAGLINE, SITE_URL } from "@/lib/brand";
import { mediaUrl } from "@/lib/media/paths";
import { formatCOP } from "@/lib/domain/money";
import { hhmmTo12h } from "@/lib/domain/public-view";
import {
  barberShopJsonLd,
  heroCtas,
  loyaltyLine,
  mapsUrl,
  weekHoursLines,
  whatsappLink,
  type SiteCta,
} from "@/lib/domain/site";
import { StickyCta } from "./StickyCta";

/**
 * Web del negocio en la portada `/` (REQ-101, ADR-077; diseño de REQ-101.12, ADR-078). Todo sale
 * de la base (REQ-101.4); sin celulares ni nombres de la fila (REQ-101.6). Héroe navy a pantalla
 * completa con la foto del local, menú flotante, títulos grandes, franja de servicios que corre y
 * bloques que aparecen al bajar (`.reveal`, solo CSS). Sin degradados ni desenfoque (REQ-078.14).
 */
export function SiteHome({ data }: { data: SiteHomeData }) {
  const { business: b, hours, loyalty, team, products, canBook, reviewUrl } = data;
  const ctas = heroCtas({ canBook, slug: b.slug });
  const reward = loyaltyLine(loyalty);
  const maps = mapsUrl(b.address);
  const whatsapp = whatsappLink(SHOP_WHATSAPP_E164, `Hola, quiero información de ${b.name}.`);
  const jsonLd = barberShopJsonLd({
    name: b.name,
    description: b.description ?? SITE_TAGLINE,
    address: b.address,
    url: `${SITE_URL}/`,
    imageUrl: b.coverPath ? mediaUrl(b.coverPath) : null,
    telephone: SHOP_WHATSAPP_E164,
    hours,
    services: b.services,
  });
  const ribbon = [
    ...b.services.map((s) => s.name),
    "Fila virtual",
    ...(canBook ? ["Citas a tu hora"] : []),
    ...(reward ? ["Fidelidad"] : []),
  ];
  const dots = Math.min(loyalty?.visitsRequired ?? 0, 12);
  const howPhoto = b.services.find((s) => s.photoPath)?.photoPath ?? null;

  return (
    <div className="bg-surface flex flex-1 flex-col pb-24 lg:pb-0">
      <script
        type="application/ld+json"
        // JSON-LD de schema.org (REQ-101.7); `<` escapado para no cerrar la etiqueta
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }}
      />
      <SiteHeader name={b.name} logoPath={b.logoPath} cta={ctas[0]} />

      <main className="flex flex-1 flex-col">
        {/* REQ-101.2: lo primero que se ve en el celular */}
        <section
          id="inicio"
          data-testid="site-hero"
          className="bg-brand text-brand-ink relative isolate flex min-h-[100svh] flex-col justify-end overflow-hidden"
        >
          {b.coverPath ? (
            <Image
              src={mediaUrl(b.coverPath)}
              alt={`Foto de ${b.name}`}
              fill
              priority
              unoptimized
              sizes="100vw"
              className="-z-20 object-cover"
            />
          ) : (
            <GammaMark
              variant="negativo"
              size={520}
              decorative
              className="absolute -right-24 -bottom-16 -z-20 opacity-10"
            />
          )}
          <div aria-hidden="true" className="bg-brand/70 absolute inset-0 -z-10" />
          <div className="mx-auto flex w-full max-w-6xl flex-col gap-5 px-5 pt-28 pb-10 lg:px-16 lg:pb-20">
            <OpenState isOpen={b.isOpen} closesAt={b.closesAt} nextOpening={b.nextOpening} />
            <div className="flex flex-col gap-3">
              <p className="text-brand-ink/80 text-xs font-semibold tracking-[0.3em] uppercase">
                Barbería · San Remo, Sabaneta
              </p>
              <h1 className="text-[clamp(2.5rem,11vw,7rem)] leading-[0.95] font-bold tracking-[0.04em] uppercase">
                {b.name}
              </h1>
              <p className="text-2xl leading-tight font-semibold sm:text-4xl">
                Tu corte, <span className="text-accent-on-brand">sin hacer fila.</span>
              </p>
            </div>
            <p className="text-brand-ink/85 hidden max-w-xl text-lg sm:block">
              {b.description ?? SITE_TAGLINE}
            </p>
            <div className="grid max-w-lg grid-cols-2 gap-3" id="reservar">
              {ctas.map((c) => (
                <Link
                  key={c.href}
                  href={c.href}
                  className={`flex min-h-12 items-center justify-center rounded-full px-3 text-center text-sm leading-tight font-semibold sm:text-base ${
                    ctas.length === 1 ? "col-span-2 sm:col-span-1" : ""
                  } ${
                    c.primary
                      ? "bg-card text-ink active:opacity-90"
                      : "text-brand-ink ring-brand-ink/60 ring-1 ring-inset active:opacity-90"
                  }`}
                >
                  {c.label}
                </Link>
              ))}
            </div>
            {b.isOpen && (
              <p className="text-brand-ink/80 text-sm">
                {b.waitingCount === 0
                  ? "Nadie en la fila ahora mismo."
                  : `${b.waitingCount} en la fila${
                      b.estimatedWaitMin ? ` · unos ${b.estimatedWaitMin} min de espera` : ""
                    }`}
              </p>
            )}
          </div>
        </section>

        {/* Franja que corre con los servicios (REQ-101.12); la copia es solo para el bucle */}
        <div className="border-line bg-card overflow-hidden border-b" aria-hidden="true">
          <div className="animate-marquee flex w-max">
            {[0, 1].map((copy) => (
              <ul key={copy} className="flex shrink-0 items-center gap-10 py-5 pr-10">
                {ribbon.map((r, i) => (
                  <li
                    key={`${copy}-${i}`}
                    className="flex items-center gap-10 text-xl font-semibold tracking-[0.2em] whitespace-nowrap uppercase"
                  >
                    {r}
                    <GammaMark variant="positivo" size={22} decorative />
                  </li>
                ))}
              </ul>
            ))}
          </div>
        </div>

        <Section id="servicios" eyebrow="Servicios" title="Hechos con calma," muted="a tu medida.">
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {b.services.map((s) => (
              <li
                key={s.id}
                className="reveal bg-brand text-brand-ink relative flex min-h-72 flex-col justify-end overflow-hidden rounded-[2rem]"
              >
                {s.photoPath && (
                  <Image
                    src={mediaUrl(s.photoPath)}
                    alt={s.name}
                    fill
                    unoptimized
                    loading="lazy"
                    sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
                    className="object-cover"
                  />
                )}
                <div
                  className={`relative flex flex-col gap-1 ${
                    s.photoPath ? "bg-card text-ink m-3 rounded-3xl p-5" : "p-6"
                  }`}
                >
                  <div className="flex items-baseline justify-between gap-3">
                    <h3 className="text-xl font-bold">{s.name}</h3>
                    <span className="text-lg font-semibold whitespace-nowrap tabular-nums">
                      {formatCOP(s.price)}
                    </span>
                  </div>
                  <p className={`text-sm ${s.photoPath ? "text-muted" : "text-brand-ink/80"}`}>
                    {s.durationMin} min
                  </p>
                  {s.description && (
                    <p className={s.photoPath ? "text-muted" : "text-brand-ink/85"}>
                      {s.description}
                    </p>
                  )}
                </div>
              </li>
            ))}
          </ul>
          <CtaLink cta={ctas[0]} className="reveal self-start" />
        </Section>

        <section
          id="como-funciona"
          aria-labelledby="como-funciona-titulo"
          className="bg-card scroll-mt-24"
        >
          <div className="mx-auto grid w-full max-w-6xl gap-10 px-5 py-20 lg:grid-cols-2 lg:items-center lg:px-16 lg:py-28">
            <div className="reveal flex flex-col gap-4">
              <Eyebrow id="como-funciona-titulo">Cómo funciona</Eyebrow>
              <p className="text-4xl leading-tight font-bold lg:text-5xl">
                No esperes en el local.
                <br />
                <span className="text-muted">Espera donde quieras.</span>
              </p>
              <ol className="mt-6 flex flex-col gap-8">
                <Step n="01" title="Toma turno">
                  Escanea el QR del local o entra desde aquí. Ves cuántos van delante y cuánto
                  falta.
                </Step>
                <Step n="02" title="O reserva tu hora">
                  {canBook
                    ? "Escoge servicio, barbero, día y hora. Llegas y te atendemos."
                    : "Pronto podrás reservar tu hora desde aquí."}
                </Step>
                <Step n="03" title="Te avisamos">
                  Sigue tu turno desde el celular. Te avisamos cuando sea tu momento.
                </Step>
              </ol>
            </div>
            {howPhoto && (
              <div className="reveal relative hidden aspect-[4/5] overflow-hidden rounded-[2rem] lg:block">
                <Image
                  src={mediaUrl(howPhoto)}
                  alt=""
                  fill
                  unoptimized
                  loading="lazy"
                  sizes="50vw"
                  className="object-cover"
                />
              </div>
            )}
          </div>
        </section>

        {team.length > 0 && (
          <Section id="equipo" eyebrow="Nuestro equipo" title="Manos que" muted="saben lo que hacen.">
            <ul className="grid grid-cols-2 gap-4 lg:grid-cols-4">
              {team.map((t) => (
                <li
                  key={t.id}
                  className="reveal bg-brand relative flex aspect-[3/4] flex-col justify-end overflow-hidden rounded-[2rem]"
                >
                  {t.photoPath ? (
                    <Image
                      src={mediaUrl(t.photoPath)}
                      alt={`Foto de ${t.name}`}
                      fill
                      unoptimized
                      loading="lazy"
                      sizes="(min-width: 1024px) 25vw, 50vw"
                      className="object-cover"
                    />
                  ) : (
                    <span
                      aria-hidden="true"
                      className="text-brand-ink absolute inset-0 flex items-center justify-center text-5xl font-bold tracking-[0.1em]"
                    >
                      {initials(t.name)}
                    </span>
                  )}
                  <span className="bg-card text-ink relative m-2 truncate rounded-full px-3 py-2 text-center text-sm font-semibold">
                    {t.name}
                  </span>
                </li>
              ))}
            </ul>
          </Section>
        )}

        {reward && loyalty && (
          <section
            id="fidelidad"
            aria-labelledby="fidelidad-titulo"
            className="bg-brand text-brand-ink scroll-mt-24"
          >
            <div className="mx-auto grid w-full max-w-6xl gap-8 px-5 py-20 lg:grid-cols-2 lg:items-center lg:px-16 lg:py-28">
              <div className="reveal flex flex-col gap-4">
                <h2
                  id="fidelidad-titulo"
                  className="text-brand-ink/80 text-xs font-semibold tracking-[0.3em] uppercase"
                >
                  Fidelidad
                </h2>
                <p className="text-4xl leading-tight font-bold lg:text-5xl">{reward}</p>
                <p className="text-brand-ink/85 text-lg">
                  Tus visitas se suman solas con tu número de celular. No necesitas tarjeta.
                </p>
              </div>
              <div className="reveal flex flex-col gap-6" aria-hidden="true">
                <p className="text-[clamp(6rem,30vw,12rem)] leading-none font-bold tabular-nums">
                  {loyalty.visitsRequired}
                </p>
                <div className="flex flex-wrap gap-2">
                  {Array.from({ length: dots }, (_, i) => (
                    <span
                      key={i}
                      className={`size-6 rounded-full ${
                        i === dots - 1
                          ? "bg-accent-mark"
                          : "ring-brand-ink/50 ring-2 ring-inset"
                      }`}
                    />
                  ))}
                </div>
              </div>
            </div>
          </section>
        )}

        {products.length > 0 && (
          <Section
            id="menu"
            eyebrow="Menú"
            title="Algo rico"
            muted="mientras esperas."
            intro="Helados y bebidas para la espera. Se pagan en caja."
          >
            <ul className="-mx-5 flex snap-x gap-4 overflow-x-auto px-5 pb-2 lg:mx-0 lg:grid lg:grid-cols-4 lg:overflow-visible lg:px-0">
              {products.map((p) => (
                <li
                  key={p.id}
                  className="bg-card border-line flex w-60 shrink-0 snap-start flex-col overflow-hidden rounded-[2rem] border lg:w-auto"
                >
                  <div className="bg-brand-soft relative flex aspect-square items-center justify-center">
                    {p.photoPath ? (
                      <Image
                        src={mediaUrl(p.photoPath)}
                        alt={p.name}
                        fill
                        unoptimized
                        loading="lazy"
                        sizes="240px"
                        className="object-cover"
                      />
                    ) : (
                      <Icon name="cup" className="text-ink size-12" />
                    )}
                  </div>
                  <div className="flex flex-col gap-1 p-4">
                    <div className="flex items-baseline justify-between gap-3">
                      <p className="font-semibold">{p.name}</p>
                      <span className="font-semibold whitespace-nowrap tabular-nums">
                        {formatCOP(p.price)}
                      </span>
                    </div>
                    {p.description && <p className="text-muted text-sm">{p.description}</p>}
                  </div>
                </li>
              ))}
            </ul>
          </Section>
        )}

        <Section
          id="horario"
          eyebrow="Horario y ubicación"
          title="Te esperamos"
          muted="en San Remo."
          tone="card"
        >
          <div className="grid gap-4 lg:grid-cols-2">
            {hours.length > 0 && (
              <dl className="reveal bg-brand text-brand-ink divide-brand-ink/15 divide-y rounded-[2rem] px-6 py-4">
                {weekHoursLines(hours).map((h) => (
                  <div key={h.day} className="flex justify-between gap-4 py-3">
                    <dt className="font-semibold">{h.day}</dt>
                    <dd className={h.text === "Cerrado" ? "text-brand-ink/70" : "tabular-nums"}>
                      {h.text}
                    </dd>
                  </div>
                ))}
              </dl>
            )}
            <div className="reveal border-line bg-surface flex flex-col justify-between gap-6 rounded-[2rem] border p-6">
              {b.address && (
                <p className="flex items-start gap-3 text-2xl leading-snug font-semibold">
                  <Icon name="pin" className="mt-1 size-6 shrink-0" />
                  {b.address}
                </p>
              )}
              {maps && (
                <a
                  href={maps}
                  target="_blank"
                  rel="noopener"
                  className="bg-brand text-brand-ink flex min-h-12 items-center justify-center self-start rounded-full px-6 font-semibold"
                >
                  Cómo llegar
                </a>
              )}
            </div>
          </div>
        </Section>

        <section id="contacto" aria-labelledby="contacto-titulo" className="scroll-mt-24">
          <div className="mx-auto w-full max-w-6xl px-5 py-20 lg:px-16 lg:py-28">
            <div className="reveal bg-brand text-brand-ink flex flex-col gap-8 rounded-[2rem] px-6 py-12 lg:px-16 lg:py-20">
              <div className="flex flex-col gap-3">
                <h2
                  id="contacto-titulo"
                  className="text-brand-ink/80 text-xs font-semibold tracking-[0.3em] uppercase"
                >
                  Contacto
                </h2>
                <p className="text-4xl leading-tight font-bold lg:text-6xl">
                  ¿Listo para tu <span className="text-accent-on-brand">próximo corte?</span>
                </p>
              </div>
              <div className="flex flex-col gap-3 sm:flex-row">
                {ctas.map((c) => (
                  <Link
                    key={c.href}
                    href={c.href}
                    className={`flex min-h-12 items-center justify-center rounded-full px-6 font-semibold ${
                      c.primary
                        ? "bg-card text-ink"
                        : "text-brand-ink ring-brand-ink/60 ring-1 ring-inset"
                    }`}
                  >
                    {c.label}
                  </Link>
                ))}
              </div>
              <ul className="flex flex-wrap gap-x-6 gap-y-1">
                {whatsapp && (
                  <li>
                    <ExtLink href={whatsapp}>Escríbenos por WhatsApp</ExtLink>
                  </li>
                )}
                <li>
                  <ExtLink href={INSTAGRAM_URL}>Síguenos en Instagram</ExtLink>
                </li>
                {reviewUrl && (
                  <li>
                    <ExtLink href={reviewUrl}>Déjanos tu reseña</ExtLink>
                  </li>
                )}
              </ul>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-line text-muted border-t">
        <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center gap-x-6 gap-y-2 px-5 py-6 text-sm lg:px-16">
          <span>© {b.name}</span>
          <Link href={`/${b.slug}/privacidad`} className="text-link min-h-12 content-center">
            Política de privacidad
          </Link>
          <Link href="/entrar" className="text-link min-h-12 content-center">
            Entrar (dueño y barberos)
          </Link>
          <span>Fila con TurnOS</span>
        </div>
      </footer>

      {/* REQ-101.5: en el celular, reservar o tomar turno siempre a mano */}
      <StickyCta cta={ctas[0]} />
    </div>
  );
}

function SiteHeader({
  name,
  logoPath,
  cta,
}: {
  name: string;
  logoPath: string | null;
  cta: SiteCta;
}) {
  return (
    <header className="fixed inset-x-0 top-3 z-30 px-3">
      <div className="bg-card ring-line mx-auto flex h-14 w-full max-w-6xl items-center gap-2 rounded-full pr-2 pl-2 shadow-[0_8px_30px_rgb(20_37_74/0.18)] ring-1">
        <Link href="/" className="flex min-w-0 items-center gap-2" aria-label={`${name}, inicio`}>
          {logoPath ? (
            <Image
              src={mediaUrl(logoPath)}
              alt=""
              width={40}
              height={40}
              unoptimized
              className="size-10 rounded-full object-cover"
            />
          ) : (
            <span className="bg-brand flex size-10 items-center justify-center rounded-full">
              <GammaMark variant="negativo" size={26} decorative />
            </span>
          )}
          <span className="truncate text-sm font-semibold tracking-[0.3em] uppercase">{name}</span>
        </Link>
        <nav aria-label="Secciones" className="ml-auto hidden gap-6 text-sm font-semibold lg:flex">
          <a href="#servicios">Servicios</a>
          <a href="#equipo">Equipo</a>
          <a href="#horario">Horario</a>
          <a href="#contacto">Contacto</a>
        </nav>
        <Link
          href="/entrar"
          className="text-link ml-auto flex min-h-12 items-center px-3 text-sm font-semibold lg:ml-4"
        >
          Entrar
        </Link>
        <Link
          href={cta.href}
          className="bg-brand text-brand-ink hidden h-10 items-center rounded-full px-5 text-sm font-semibold sm:flex"
        >
          {cta.label}
        </Link>
      </div>
    </header>
  );
}

function OpenState({
  isOpen,
  closesAt,
  nextOpening,
}: {
  isOpen: boolean;
  closesAt: string | null;
  nextOpening: string | null;
}) {
  return (
    <p
      className="ring-brand-ink/30 flex h-8 items-center gap-2 self-start rounded-full px-3 text-sm font-semibold ring-1 ring-inset"
      data-testid="open-state"
    >
      <span
        aria-hidden="true"
        className={`size-2.5 rounded-full ${isOpen ? "bg-ok-on-brand" : "bg-brand-ink/50"}`}
      />
      {isOpen ? (
        <span>Abierto{closesAt ? ` hasta ${hhmmTo12h(closesAt)}` : ""}</span>
      ) : (
        <span>Cerrado{nextOpening ? ` · ${lowerFirst(nextOpening)}` : ""}</span>
      )}
    </p>
  );
}

function Eyebrow({ id, children }: { id: string; children: React.ReactNode }) {
  return (
    <h2 id={id} className="text-link text-xs font-semibold tracking-[0.3em] uppercase">
      {children}
    </h2>
  );
}

function Section({
  id,
  eyebrow,
  title,
  muted,
  intro,
  tone = "surface",
  children,
}: {
  id: string;
  eyebrow: string;
  title: string;
  muted?: string;
  intro?: string;
  tone?: "surface" | "card";
  children: React.ReactNode;
}) {
  return (
    <section
      id={id}
      aria-labelledby={`${id}-titulo`}
      className={`scroll-mt-24 ${tone === "card" ? "bg-card" : ""}`}
    >
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-5 py-20 lg:px-16 lg:py-28">
        <div className="reveal flex flex-col gap-3">
          <Eyebrow id={`${id}-titulo`}>{eyebrow}</Eyebrow>
          <p className="text-4xl leading-tight font-bold lg:text-5xl">
            {title}
            {muted && (
              <>
                {" "}
                <span className="text-muted">{muted}</span>
              </>
            )}
          </p>
          {intro && <p className="text-muted text-lg">{intro}</p>}
        </div>
        {children}
      </div>
    </section>
  );
}

function Step({ n, title, children }: { n: string; title: string; children: React.ReactNode }) {
  return (
    <li className="flex gap-4">
      <span className="text-link pt-2 text-sm font-semibold tabular-nums">{n}</span>
      <div>
        <h3 className="text-2xl font-bold tracking-[0.04em] uppercase lg:text-3xl">{title}</h3>
        <p className="text-muted mt-1 text-lg">{children}</p>
      </div>
    </li>
  );
}

function CtaLink({ cta, className = "" }: { cta: SiteCta; className?: string }) {
  return (
    <Link
      href={cta.href}
      className={`bg-brand text-brand-ink flex min-h-12 items-center justify-center rounded-full px-6 font-semibold ${className}`}
    >
      {cta.label}
    </Link>
  );
}

function ExtLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener"
      className="flex min-h-12 items-center font-semibold underline underline-offset-4"
    >
      {children}
    </a>
  );
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toLocaleUpperCase("es-CO"))
    .join("");
}

function lowerFirst(s: string): string {
  return s.charAt(0).toLocaleLowerCase("es-CO") + s.slice(1);
}
