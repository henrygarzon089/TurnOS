import Image from "next/image";
import Link from "next/link";
import { GammaMark } from "@/components/brand/GammaMark";
import { Icon, type IconName } from "@/components/ui/Icon";
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
} from "@/lib/domain/site";
import { StickyCta } from "./StickyCta";

/**
 * Web del negocio en la portada `/` (REQ-101, ADR-077, design §33.3). Todo sale de la base
 * (REQ-101.4); sin celulares ni nombres de la fila (REQ-101.6). Marca de Gamma Club: crema y blanco
 * de fondo, navy para la acción y la banda de fidelidad, sin el rojo de "atención ahora".
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

  return (
    <div className="flex flex-1 flex-col pb-24 lg:pb-0">
      <script
        type="application/ld+json"
        // JSON-LD de schema.org (REQ-101.7); `<` escapado para no cerrar la etiqueta
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }}
      />
      <SiteHeader name={b.name} logoPath={b.logoPath} />

      <main className="flex flex-1 flex-col">
        {/* REQ-101.2: lo primero que se ve en el celular */}
        <section
          id="inicio"
          data-testid="site-hero"
          className="mx-auto grid w-full max-w-6xl lg:grid-cols-2 lg:items-center lg:gap-12 lg:px-16 lg:py-12"
        >
          {b.coverPath && (
            <div className="relative aspect-[16/9] w-full overflow-hidden lg:order-2 lg:aspect-[4/3] lg:rounded-lg">
              <Image
                src={mediaUrl(b.coverPath)}
                alt={`Foto de ${b.name}`}
                fill
                priority
                unoptimized
                sizes="(min-width: 1024px) 50vw, 100vw"
                className="object-cover"
              />
            </div>
          )}
          <div className="flex flex-col gap-4 px-4 py-6 lg:px-0">
            <OpenState isOpen={b.isOpen} closesAt={b.closesAt} nextOpening={b.nextOpening} />
            <div>
              <h1 className="text-3xl leading-tight font-semibold tracking-[0.2em] uppercase lg:text-5xl">
                {b.name}
              </h1>
              <p className="text-muted mt-2 text-lg">{b.description ?? SITE_TAGLINE}</p>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row" id="reservar">
              {ctas.map((c) => (
                <Link
                  key={c.href}
                  href={c.href}
                  className={c.primary ? "btn-primary sm:w-auto" : "btn-secondary sm:w-auto"}
                >
                  {c.label}
                </Link>
              ))}
            </div>
            {b.isOpen && (
              <p className="text-muted text-sm">
                {b.waitingCount === 0
                  ? "Nadie en la fila ahora mismo."
                  : `${b.waitingCount} en la fila${
                      b.estimatedWaitMin ? ` · unos ${b.estimatedWaitMin} min de espera` : ""
                    }`}
              </p>
            )}
          </div>
        </section>

        <Section id="servicios" title="Servicios" intro="Precio y duración de cada servicio.">
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {b.services.map((s) => (
              <li key={s.id} className="border-line bg-card overflow-hidden rounded-lg border">
                {s.photoPath && (
                  <div className="relative aspect-[4/3] w-full">
                    <Image
                      src={mediaUrl(s.photoPath)}
                      alt={s.name}
                      fill
                      unoptimized
                      loading="lazy"
                      sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
                      className="object-cover"
                    />
                  </div>
                )}
                <div className="flex flex-col gap-1 p-4">
                  <div className="flex items-baseline justify-between gap-3">
                    <h3 className="text-lg font-semibold">{s.name}</h3>
                    <span className="text-lg font-semibold whitespace-nowrap tabular-nums">
                      {formatCOP(s.price)}
                    </span>
                  </div>
                  <p className="text-muted text-sm">{s.durationMin} min</p>
                  {s.description && <p className="text-muted">{s.description}</p>}
                </div>
              </li>
            ))}
          </ul>
        </Section>

        <Section id="como-funciona" title="Cómo funciona" tone="card">
          <ol className="grid gap-4 sm:grid-cols-3">
            <Step icon="qr" title="Toma turno sin hacer fila">
              Escanea el QR del local o entra desde aquí. Ves cuántos van delante y cuánto falta.
            </Step>
            <Step icon="calendar" title="O reserva tu hora">
              {canBook
                ? "Escoge servicio, barbero, día y hora. Llegas y te atendemos."
                : "Pronto podrás reservar tu hora desde aquí."}
            </Step>
            <Step icon="bell" title="Te avisamos">
              Sigue tu turno desde el celular. Te avisamos cuando sea tu momento.
            </Step>
          </ol>
        </Section>

        {team.length > 0 && (
          <Section id="equipo" title="Nuestro equipo">
            <ul className="flex flex-wrap gap-6">
              {team.map((t) => (
                <li key={t.id} className="flex w-24 flex-col items-center gap-2 text-center">
                  {t.photoPath ? (
                    <Image
                      src={mediaUrl(t.photoPath)}
                      alt={`Foto de ${t.name}`}
                      width={96}
                      height={96}
                      unoptimized
                      loading="lazy"
                      className="bg-card size-24 rounded-full object-cover"
                    />
                  ) : (
                    <span
                      aria-hidden="true"
                      className="bg-brand-soft text-ink flex size-24 items-center justify-center rounded-full text-2xl font-semibold"
                    >
                      {initials(t.name)}
                    </span>
                  )}
                  <span className="font-semibold">{t.name}</span>
                </li>
              ))}
            </ul>
          </Section>
        )}

        {reward && (
          <section id="fidelidad" className="bg-brand text-brand-ink">
            <div className="mx-auto flex w-full max-w-6xl flex-col gap-2 px-4 py-10 lg:px-16">
              <h2 className="text-sm font-semibold tracking-[0.3em] uppercase">Fidelidad</h2>
              <p className="text-2xl font-semibold lg:text-3xl">{reward}</p>
              <p>Tus visitas se suman solas con tu número de celular. No necesitas tarjeta.</p>
            </div>
          </section>
        )}

        {products.length > 0 && (
          <Section
            id="menu"
            title="Menú"
            intro="Helados y bebidas para la espera. Se pagan en caja."
          >
            <ul className="divide-line border-line bg-card divide-y rounded-lg border">
              {products.map((p) => (
                <li key={p.id} className="flex min-h-14 items-center gap-3 px-4 py-2">
                  {p.photoPath && (
                    <Image
                      src={mediaUrl(p.photoPath)}
                      alt={p.name}
                      width={48}
                      height={48}
                      unoptimized
                      loading="lazy"
                      className="size-12 shrink-0 rounded-md object-cover"
                    />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold">{p.name}</p>
                    {p.description && <p className="text-muted text-sm">{p.description}</p>}
                  </div>
                  <span className="font-semibold whitespace-nowrap tabular-nums">
                    {formatCOP(p.price)}
                  </span>
                </li>
              ))}
            </ul>
          </Section>
        )}

        <Section id="horario" title="Horario y ubicación" tone="card">
          <div className="grid gap-8 lg:grid-cols-2">
            {hours.length > 0 && (
              <dl className="divide-line divide-y">
                {weekHoursLines(hours).map((h) => (
                  <div key={h.day} className="flex justify-between gap-4 py-2">
                    <dt className="font-semibold">{h.day}</dt>
                    <dd className={h.text === "Cerrado" ? "text-muted" : "tabular-nums"}>
                      {h.text}
                    </dd>
                  </div>
                ))}
              </dl>
            )}
            <div className="flex flex-col gap-3">
              {b.address && (
                <p className="flex items-start gap-2 text-lg">
                  <Icon name="pin" className="mt-1 size-5 shrink-0" />
                  {b.address}
                </p>
              )}
              {maps && (
                <a href={maps} target="_blank" rel="noopener" className="btn-secondary sm:w-auto">
                  Cómo llegar
                </a>
              )}
            </div>
          </div>
        </Section>

        <Section id="contacto" title="Contacto">
          <ul className="flex flex-col gap-3 sm:flex-row">
            {whatsapp && (
              <li>
                <a
                  href={whatsapp}
                  target="_blank"
                  rel="noopener"
                  className="btn-secondary sm:w-auto"
                >
                  Escríbenos por WhatsApp
                </a>
              </li>
            )}
            <li>
              <a
                href={INSTAGRAM_URL}
                target="_blank"
                rel="noopener"
                className="btn-secondary sm:w-auto"
              >
                Síguenos en Instagram
              </a>
            </li>
            {reviewUrl && (
              <li>
                <a
                  href={reviewUrl}
                  target="_blank"
                  rel="noopener"
                  className="btn-secondary sm:w-auto"
                >
                  Déjanos tu reseña
                </a>
              </li>
            )}
          </ul>
        </Section>
      </main>

      <footer className="border-line text-muted border-t">
        <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-6 text-sm lg:px-16">
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

function SiteHeader({ name, logoPath }: { name: string; logoPath: string | null }) {
  return (
    <header className="border-line bg-card sticky top-0 z-20 border-b">
      <div className="mx-auto flex h-14 w-full max-w-6xl items-center gap-3 px-4 lg:px-16">
        <Link href="/" className="flex min-w-0 items-center gap-2" aria-label={`${name}, inicio`}>
          {logoPath ? (
            <Image
              src={mediaUrl(logoPath)}
              alt=""
              width={36}
              height={36}
              unoptimized
              className="size-9 rounded-md object-cover"
            />
          ) : (
            <span className="bg-brand flex size-9 items-center justify-center rounded-md">
              <GammaMark variant="negativo" size={28} decorative />
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
          className="text-link ml-auto flex min-h-12 items-center text-sm font-semibold lg:ml-6"
        >
          Entrar
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
    <p className="flex items-center gap-2 text-sm font-semibold" data-testid="open-state">
      <span
        aria-hidden="true"
        className={`size-2.5 rounded-full ${isOpen ? "bg-ok" : "bg-line-strong"}`}
      />
      {isOpen ? (
        <span className="text-ok">Abierto{closesAt ? ` hasta ${hhmmTo12h(closesAt)}` : ""}</span>
      ) : (
        <span className="text-muted">
          Cerrado{nextOpening ? ` · ${lowerFirst(nextOpening)}` : ""}
        </span>
      )}
    </p>
  );
}

function Section({
  id,
  title,
  intro,
  tone = "surface",
  children,
}: {
  id: string;
  title: string;
  intro?: string;
  tone?: "surface" | "card";
  children: React.ReactNode;
}) {
  return (
    <section
      id={id}
      aria-labelledby={`${id}-titulo`}
      className={`scroll-mt-14 ${tone === "card" ? "bg-card" : ""}`}
    >
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-4 py-10 lg:px-16">
        <div>
          <h2 id={`${id}-titulo`} className="text-2xl font-semibold">
            {title}
          </h2>
          {intro && <p className="text-muted mt-1">{intro}</p>}
        </div>
        {children}
      </div>
    </section>
  );
}

function Step({
  icon,
  title,
  children,
}: {
  icon: IconName;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <li className="flex gap-3">
      <span className="bg-brand-soft text-ink flex size-12 shrink-0 items-center justify-center rounded-full">
        <Icon name={icon} className="size-6" />
      </span>
      <div>
        <h3 className="font-semibold">{title}</h3>
        <p className="text-muted">{children}</p>
      </div>
    </li>
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
