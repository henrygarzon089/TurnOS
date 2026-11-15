"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { ErrorText } from "@/components/auth/LoginForm";
import { MenuSheet } from "@/components/public/MenuSheet";
import { AnyBarberCard, BarberCard, ServiceCard, StepHeader } from "@/components/public/JoinSteps";
import { ClosedNotice, JoinBar, LiveBlock } from "@/components/public/PublicHome";
import { PublicHero } from "@/components/public/PublicHero";
import { BarberCutsSheet } from "@/components/queue/BarberCutsSheet";
import { Field } from "@/components/ui/Field";
import { Icon } from "@/components/ui/Icon";
import { PhoneField } from "@/components/ui/PhoneField";
import {
  customerHasBirthday,
  customerHasWhatsappConsent,
  getPreferredBarber,
  joinQueue,
} from "@/lib/actions/public";
import { serviceAvailability } from "@/lib/domain/barber-services";
import {
  barberChoices,
  joinStepQuery,
  joinSummary,
  previousStep,
  readJoinView,
  stepNumber,
  stepOfField,
  type JoinStep,
  type JoinView,
} from "@/lib/domain/join-steps";
import { MONTH_NAMES } from "@/lib/domain/birthday";
import { formatPhoneCO, formatPhoneTyping, normalizePhoneCO } from "@/lib/domain/phone";
import { minutes, type PublicBarberLine } from "@/lib/domain/public-view";
import { estimateNewTicket } from "@/lib/domain/queue-estimate";
import { mediaUrl } from "@/lib/media/paths";
import type { PublicBusiness } from "@/lib/queue/public-queue";
import { useBrowserOnline } from "@/lib/realtime/use-browser-online";
import { readPrefs, writePrefs } from "@/lib/storage/customer-prefs";

type Props = {
  business: PublicBusiness;
  now: string;
  /** REQ-050.1 / REQ-084.2: citas encendidas con alguien que las reciba. */
  canBook?: boolean;
  /** Líneas del bloque en vivo (REQ-078.21, REQ-088.1). */
  lines: PublicBarberLine[];
  /** "Abierto hasta …" o "Cerrado · …". */
  stateText: React.ReactNode;
};

const TITLES: Record<JoinStep, string> = {
  servicio: "¿Qué te vas a hacer?",
  barbero: "¿Con quién?",
  datos: "Tus datos",
};

/**
 * Hito 20 (REQ-088, ADR-063, design.md §26.3): la portada con "Tomar turno" y "Reservar una cita",
 * y tomar turno en 3 pasos (Servicio → Barbero → Tus datos) con el paso en la dirección. Las reglas
 * de siempre (REQ-003, REQ-035, REQ-037, REQ-038, REQ-041, REQ-002) no cambian: mismo `joinQueue`,
 * mismos mensajes; un error lleva al paso donde está el dato (REQ-088.6).
 */
export function JoinFlow({ business, now, canBook = false, lines, stateText }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const view = readJoinView(params, business);
  const { step, serviceId, barberId } = view;
  const { online } = useBrowserOnline();
  const [pending, startTransition] = useTransition();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  // REQ-088.5: el barbero de siempre, marcado en el paso 2
  const [preferredId, setPreferredId] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const pushes = useRef(0);
  const [privacy, setPrivacy] = useState(false);
  const [alreadyAccepted, setAlreadyAccepted] = useState(false);
  const [error, setError] = useState<{ message: string; field?: string } | null>(null);
  const [birthdayDay, setBirthdayDay] = useState("");
  const [birthdayMonth, setBirthdayMonth] = useState("");
  // REQ-038.3: si la escogida se acaba (se relee tras el error), vuelve "No, gracias"
  const [courtesyId, setCourtesyId] = useState<string | null>(null);
  const shownCourtesyId = business.courtesies.some((c) => c.id === courtesyId) ? courtesyId : null;
  const [cutsOf, setCutsOf] = useState<{ id: string; name: string } | null>(null);
  const [birthdayOnFile, setBirthdayOnFile] = useState<{ phone: string; has: boolean } | null>(
    null,
  );
  const [whatsappOnFile, setWhatsappOnFile] = useState<{ phone: string; has: boolean } | null>(
    null,
  );
  // REQ-041.1: la casilla marcada vale para ese celular; otro celular la encuentra sin marcar
  const [whatsappOptInPhone, setWhatsappOptInPhone] = useState<string | null>(null);

  /** REQ-088.3 / REQ-088.4: cambia de paso sin pedirle nada al servidor; "atrás" del celular sirve. */
  function go(next: JoinView, replace = false) {
    const url = `${pathname}${joinStepQuery(next)}`;
    if (replace) window.history.replaceState(null, "", url);
    else {
      window.history.pushState(null, "", url);
      pushes.current += 1;
    }
    window.scrollTo({ top: 0 });
  }
  useEffect(() => {
    const onPop = () => {
      pushes.current = Math.max(0, pushes.current - 1);
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);
  function back() {
    if (!step) return;
    // Si llegamos aquí desde el paso anterior, "Atrás" es lo mismo que el botón del celular
    if (pushes.current > 0) return window.history.back();
    go({ ...view, step: previousStep(step) }, true);
  }

  // REQ-037.2: se pregunta por el celular escrito o prellenado. Mientras no se sepa, el campo no
  // aparece: así a quien ya lo dio no le salta y desaparece bajo el dedo.
  const e164 = normalizePhoneCO(phone);
  useEffect(() => {
    if (!e164) return;
    let stale = false;
    void customerHasBirthday(business.slug, e164).then((has) => {
      if (!stale) setBirthdayOnFile({ phone: e164, has });
    });
    return () => {
      stale = true;
    };
  }, [business.slug, e164]);
  const askBirthday = birthdayOnFile?.phone === e164 && !birthdayOnFile?.has;

  // REQ-041.1 / REQ-041.3: casilla o línea, con la misma espera que el cumpleaños
  const whatsappEnabled = business.whatsappAutoEnabled;
  useEffect(() => {
    if (!whatsappEnabled || !e164) return;
    let stale = false;
    void customerHasWhatsappConsent(business.slug, e164).then((has) => {
      if (!stale) setWhatsappOnFile({ phone: e164, has });
    });
    return () => {
      stale = true;
    };
  }, [business.slug, whatsappEnabled, e164]);
  const whatsappKnown = whatsappEnabled && whatsappOnFile?.phone === e164;
  const askWhatsapp = whatsappKnown && !whatsappOnFile?.has;
  const whatsappOptIn = askWhatsapp && !!e164 && whatsappOptInPhone === e164;

  // REQ-003.7 / REQ-002.4 / REQ-088.5: prellenar desde el navegador
  useEffect(() => {
    // En un celular lento se alcanza a escribir antes de hidratar: el campo controlado lo borraría
    // en el siguiente render. Lo escrito se pasa al estado y gana sobre lo guardado.
    const field = (n: string) =>
      (formRef.current?.elements.namedItem(n) as HTMLInputElement | null)?.value.trim() ?? "";
    const typedName = field("name");
    const typedPhone = field("phone");
    if (typedName) setName(typedName);
    if (typedPhone) setPhone(formatPhoneTyping(typedPhone));
    // Tras hidratar (evita desajuste servidor/cliente): leer el navegador en el siguiente frame
    const id = requestAnimationFrame(() => {
      const p = readPrefs();
      if (p.name && !typedName) setName(p.name);
      if (p.phone && !typedPhone) {
        setPhone(formatPhoneCO(p.phone));
        // REQ-022.1: su barbero preferido, si atiende hoy y no está en pausa
        void getPreferredBarber(business.slug, p.phone).then((id) => {
          const ok = business.barbersToday.some((b) => b.id === id && b.status !== "paused");
          if (id && ok) setPreferredId(id);
        });
      }
      const v = p.privacyAccepted?.[business.slug];
      if (v && business.privacyVersion && v >= business.privacyVersion) {
        setAlreadyAccepted(true);
        setPrivacy(true);
      }
    });
    return () => cancelAnimationFrame(id);
  }, [business.slug, business.privacyVersion, business.barbersToday]);

  const service = business.services.find((s) => s.id === serviceId);
  const choices = serviceId
    ? barberChoices(business, serviceId, new Date(now))
    : { anyWaitMin: null, barbers: [] };
  const barber = choices.barbers.find((b) => b.id === barberId);
  // REQ-088.5: sin barbero escogido en la dirección, el de siempre sale marcado (si hace el servicio)
  const markedBarberId =
    params.get("barbero") !== null
      ? barberId
      : choices.barbers.some((b) => b.id === preferredId && !b.paused)
        ? preferredId
        : null;

  const estimate = service
    ? estimateNewTicket(
        { now: new Date(now), ...business.queue },
        service.durationMin,
        barberId,
        service.barberIds ?? null,
      ).waitMin
    : null;

  // REQ-017.3: ¿alcanzamos a atenderte hoy?
  const warning = (() => {
    if (!service || !business.closesAt || estimate === null) return null;
    const [h, m] = business.closesAt.split(":").map(Number);
    const closes = new Date(now);
    closes.setHours(h, m, 0, 0); // el navegador del cliente está en Colombia
    const minutesLeft = (closes.getTime() - new Date(now).getTime()) / 60_000;
    return estimate + service.durationMin > minutesLeft
      ? "Es posible que no alcancemos a atenderte hoy: la espera supera el tiempo que falta para cerrar."
      : null;
  })();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!serviceId) return go({ step: "servicio", serviceId: null, barberId: null });
    setError(null);
    startTransition(async () => {
      // Sin respuesta de la acción (red caída, servidor): el recuadro de error, nunca un turno a medias
      const r = await joinQueue({
        slug: business.slug,
        name,
        phone,
        serviceId,
        preferredBarberId: barberId,
        privacyAccepted: privacy,
        privacyVersion: business.privacyVersion,
        source: "qr",
        birthday: askBirthday ? { day: birthdayDay, month: birthdayMonth } : null,
        courtesyProductId: shownCourtesyId,
        whatsappOptIn,
      }).catch(() => ({ ok: false as const, error: JOIN_FAILED, field: undefined }));
      if (!r.ok) {
        setError({ message: r.error, field: r.field });
        if (r.field === "courtesyProductId") router.refresh(); // REQ-038.6
        // REQ-088.6: el error se ve en el paso del dato
        const at = stepOfField(r.field);
        if (at !== "datos") go({ ...view, step: at });
        return;
      }
      writePrefs({
        name: name.trim(),
        phone: e164 ?? undefined,
        privacyAccepted: business.privacyVersion
          ? { [business.slug]: business.privacyVersion }
          : undefined,
        lastTicket: { [business.slug]: r.token },
      });
      router.push(`/t/${r.token}${r.existing ? "?ya=1" : ""}`);
    });
  }

  const menu =
    business.products.length > 0 ? (
      <MenuSheet address={business.address} products={business.products} />
    ) : null;
  const inSteps = step !== null && business.isOpen;
  const citaHref = `/${business.slug}/cita`;
  const errorFor = (f: string) => (error?.field === f ? error.message : null);

  return (
    <>
      <PublicHero
        name={business.name}
        subtitle={stateText}
        logoPath={business.logoPath}
        coverPath={business.coverPath}
        compact={inSteps}
        aside={
          <div className="hidden items-center gap-8 lg:flex">
            {/* REQ-088.8: en la portada ya está el botón; arriba solo durante los pasos */}
            {canBook && inSteps && (
              <Link
                href={citaHref}
                className="text-ink inline-flex min-h-12 items-center font-semibold underline underline-offset-4"
              >
                Reservar una cita
              </Link>
            )}
            {menu}
          </div>
        }
      />
      <main className="mx-auto grid w-full max-w-md flex-1 grid-cols-[minmax(0,1fr)] content-start gap-5 px-4 pt-4 lg:max-w-6xl lg:grid-cols-[minmax(0,1fr)_440px] lg:items-start lg:gap-14 lg:px-16 lg:pt-10">
        {/* REQ-088.7: en el celular, durante los pasos, solo el paso */}
        <div className={inSteps ? "hidden lg:block" : ""}>
          <LiveBlock
            waiting={business.waitingCount}
            lines={lines}
            whatsapp={business.whatsappAutoEnabled}
            photos={business.barberPhotos}
          />
        </div>
        <div className="lg:border-line lg:bg-card lg:rounded-lg lg:border lg:p-6">
          {!business.isOpen ? (
            <ClosedNotice
              slug={business.slug}
              nextOpening={business.nextOpening}
              canBook={canBook}
              menuTrigger={menu}
            />
          ) : step === null ? (
            <HomeActions
              onJoin={() => go({ step: "servicio", serviceId: null, barberId: null })}
              canBook={canBook}
              citaHref={citaHref}
              menu={menu}
            />
          ) : (
            <div className="flex flex-col gap-4 pb-6 lg:pb-0">
              <StepHeader step={stepNumber(step)} total={3} title={TITLES[step]} onBack={back} />
              {step === "servicio" && (
                <div role="radiogroup" aria-label="Servicio" className="flex flex-col gap-2">
                  {business.services.map((s) => {
                    // REQ-035.7: en gris si hoy ninguno de los presentes lo hace
                    const nobody = serviceAvailability(s, business.barbersToday) === "nobody_today";
                    return (
                      <ServiceCard
                        key={s.id}
                        name={s.name}
                        price={s.price}
                        durationMin={s.durationMin}
                        photoPath={s.photoPath}
                        description={s.description}
                        checked={serviceId === s.id}
                        disabled={nobody || pending}
                        disabledText="Hoy no hay quién lo haga"
                        onPick={() => {
                          if (error?.field === "serviceId") setError(null);
                          go({ step: "barbero", serviceId: s.id, barberId });
                        }}
                      />
                    );
                  })}
                  {errorFor("serviceId") && <ErrorText>{errorFor("serviceId")}</ErrorText>}
                </div>
              )}
              {step === "barbero" && (
                <div role="radiogroup" aria-label="Barbero" className="flex flex-col gap-2">
                  <AnyBarberCard
                    text={
                      choices.anyWaitMin === null
                        ? "Te atiende el que se desocupe"
                        : choices.anyWaitMin === 0
                          ? "Te atienden ya"
                          : `~ ${minutes(choices.anyWaitMin)}`
                    }
                    checked={markedBarberId === null}
                    onPick={() => {
                      if (error?.field === "preferredBarberId") setError(null);
                      go({ step: "datos", serviceId, barberId: null });
                    }}
                  />
                  {choices.barbers.map((b) => (
                    <div key={b.id} className="flex flex-col">
                      <BarberCard
                        name={b.name}
                        photoPath={b.photoPath}
                        text={b.text}
                        checked={markedBarberId === b.id}
                        disabled={b.paused || pending}
                        badge={b.id === preferredId ? "Tu barbero de siempre" : undefined}
                        onPick={() => {
                          if (error?.field === "preferredBarberId") setError(null);
                          go({ step: "datos", serviceId, barberId: b.id });
                        }}
                      />
                      {/* REQ-039.5: los cortes del barbero, si tiene fotos */}
                      {business.photoCounts[b.id] > 0 && (
                        <button
                          type="button"
                          aria-label={`Ver cortes de ${b.name}`}
                          className="text-link min-h-12 self-start text-sm font-medium underline"
                          onClick={() => setCutsOf({ id: b.id, name: b.name })}
                        >
                          Ver cortes
                        </button>
                      )}
                    </div>
                  ))}
                  {errorFor("preferredBarberId") && (
                    <ErrorText>{errorFor("preferredBarberId")}</ErrorText>
                  )}
                </div>
              )}
              {cutsOf && (
                <BarberCutsSheet
                  slug={business.slug}
                  barber={cutsOf}
                  onClose={() => setCutsOf(null)}
                />
              )}
              {step === "datos" && service && (
                <form
                  ref={formRef}
                  onSubmit={submit}
                  className="flex flex-col gap-5 pb-34 lg:pb-0"
                  aria-label="Tomar turno"
                >
                  <Field
                    id="name"
                    name="name"
                    label="Tu nombre"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                    minLength={2}
                    maxLength={60}
                    autoComplete="name"
                    disabled={pending}
                  />
                  <PhoneField
                    id="phone"
                    name="phone"
                    label="Tu celular"
                    value={phone}
                    onChange={setPhone}
                    required
                    disabled={pending}
                    error={errorFor("phone") ?? undefined}
                  />
                  {askBirthday && (
                    <BirthdayFields
                      day={birthdayDay}
                      month={birthdayMonth}
                      onDay={setBirthdayDay}
                      onMonth={setBirthdayMonth}
                      disabled={pending}
                      error={errorFor("birthday")}
                    />
                  )}
                  {(business.courtesies.length > 0 || error?.field === "courtesyProductId") && (
                    <CourtesyFields
                      options={business.courtesies}
                      value={shownCourtesyId}
                      onChange={setCourtesyId}
                      disabled={pending}
                      error={errorFor("courtesyProductId")}
                    />
                  )}
                  {warning && (
                    <p
                      role="status"
                      className="text-warn bg-warn-soft rounded-md p-3 text-sm font-medium"
                    >
                      {warning}
                    </p>
                  )}
                  {askWhatsapp && (
                    <label className="flex min-h-12 items-start gap-3 text-sm">
                      <input
                        type="checkbox"
                        name="whatsappOptIn"
                        checked={whatsappOptIn}
                        disabled={pending}
                        onChange={(e) => setWhatsappOptInPhone(e.target.checked ? e164 : null)}
                        className="mt-0.5 h-6 w-6 shrink-0"
                      />
                      <span>Avísame por WhatsApp cuando falte poco</span>
                    </label>
                  )}
                  {whatsappKnown && !askWhatsapp && (
                    <p className="text-muted text-sm">Te avisamos por WhatsApp cuando falte poco</p>
                  )}
                  {alreadyAccepted ? (
                    <p className="text-muted text-sm">
                      Ya aceptaste nuestra política de datos.{" "}
                      <Link href={`/${business.slug}/privacidad`} className="text-link underline">
                        Leerla
                      </Link>
                    </p>
                  ) : (
                    // REQ-002.1: texto corto y el enlace al aviso (ADR-052)
                    <label className="flex min-h-12 items-center gap-3 text-sm">
                      <input
                        type="checkbox"
                        name="privacyAccepted"
                        checked={privacy}
                        disabled={pending}
                        onChange={(e) => setPrivacy(e.target.checked)}
                        className="accent-brand size-6 shrink-0"
                      />
                      <span>
                        Acepto el{" "}
                        <Link
                          href={`/${business.slug}/privacidad`}
                          className="underline underline-offset-2"
                          target="_blank"
                        >
                          aviso de privacidad
                        </Link>{" "}
                        (Ley 1581)
                      </span>
                    </label>
                  )}
                  {errorFor("privacyAccepted") && (
                    <ErrorText>{errorFor("privacyAccepted")}</ErrorText>
                  )}
                  {error && !error.field && <JoinError message={error.message} />}
                  <JoinBar
                    slug={business.slug}
                    pending={pending}
                    disabled={pending || !privacy || !online}
                    online={online}
                    label="Confirmar turno"
                    summary={joinSummary(service.name, barber?.name ?? null, estimate)}
                    hint={
                      !privacy && !alreadyAccepted
                        ? "Marca la casilla de privacidad para continuar."
                        : null
                    }
                    canBook={false}
                    menuTrigger={null}
                  />
                </form>
              )}
            </div>
          )}
        </div>
      </main>
    </>
  );
}

/** REQ-088.1: "Tomar turno" y "Reservar una cita", grandes y al alcance del pulgar. */
function HomeActions({
  onJoin,
  canBook,
  citaHref,
  menu,
}: {
  onJoin: () => void;
  canBook: boolean;
  citaHref: string;
  menu: React.ReactNode;
}) {
  return (
    <>
      <div className="h-40 lg:hidden" aria-hidden="true" />
      <div className="border-line bg-card fixed inset-x-0 bottom-0 z-10 border-t px-4 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] lg:static lg:border-0 lg:bg-transparent lg:p-0">
        <div className="mx-auto flex max-w-md flex-col gap-2 lg:max-w-none">
          <h2 className="mb-2 hidden text-xl font-bold lg:block">¿Qué quieres hacer?</h2>
          <button type="button" className="btn-primary min-h-14 text-xl" onClick={onJoin}>
            Tomar turno
          </button>
          {canBook && (
            <Link href={citaHref} className="btn-secondary min-h-14 text-xl">
              Reservar una cita
            </Link>
          )}
          {menu && <div className="flex justify-center lg:hidden">{menu}</div>}
        </div>
      </div>
    </>
  );
}

function BirthdayFields({
  day,
  month,
  onDay,
  onMonth,
  disabled,
  error,
}: {
  day: string;
  month: string;
  onDay: (v: string) => void;
  onMonth: (v: string) => void;
  disabled: boolean;
  error: string | null;
}) {
  return (
    <fieldset className="min-w-0">
      <legend className="mb-2 text-sm font-semibold">¿Cuándo cumples años? (opcional)</legend>
      <div className="flex gap-2">
        <label className="flex w-24 flex-col gap-1 text-sm">
          Día
          <input
            name="birthdayDay"
            type="text"
            inputMode="numeric"
            maxLength={2}
            disabled={disabled}
            value={day}
            onChange={(e) => onDay(e.target.value)}
            className="input"
            aria-invalid={Boolean(error)}
          />
        </label>
        <label className="flex min-w-0 flex-1 flex-col gap-1 text-sm">
          Mes
          <select
            name="birthdayMonth"
            value={month}
            disabled={disabled}
            onChange={(e) => onMonth(e.target.value)}
            className="input"
            aria-invalid={Boolean(error)}
          >
            <option value="">Sin elegir</option>
            {MONTH_NAMES.map((m, i) => (
              <option key={m} value={i + 1}>
                {m}
              </option>
            ))}
          </select>
        </label>
      </div>
      {error && <ErrorText>{error}</ErrorText>}
    </fieldset>
  );
}

function CourtesyFields({
  options,
  value,
  onChange,
  disabled,
  error,
}: {
  options: PublicBusiness["courtesies"];
  value: string | null;
  onChange: (id: string | null) => void;
  disabled: boolean;
  error: string | null;
}) {
  return (
    <fieldset className="min-w-0">
      <legend className="mb-2 text-sm font-semibold">Bebida de cortesía</legend>
      <div className="flex flex-col gap-2">
        {[{ id: null, name: "No, gracias", photoPath: null }, ...options].map((c) => (
          <label
            key={c.id ?? "ninguna"}
            className={`flex min-h-12 cursor-pointer items-center gap-2 rounded-md border px-3 py-2 ${value === c.id ? "border-brand bg-brand-soft border-2" : "border-line-strong bg-card"}`}
          >
            <input
              type="radio"
              name="courtesyProductId"
              checked={value === c.id}
              disabled={disabled}
              onChange={() => onChange(c.id)}
              className="h-5 w-5 shrink-0"
            />
            {c.photoPath && (
              <Image
                src={mediaUrl(c.photoPath)}
                alt=""
                width={32}
                height={32}
                unoptimized
                className="h-8 w-8 shrink-0 rounded-sm object-cover"
              />
            )}
            <span className="min-w-0 break-words">{c.name}</span>
          </label>
        ))}
      </div>
      {error && <ErrorText>{error}</ErrorText>}
    </fieldset>
  );
}

/** Lo que dice el recuadro cuando la acción no respondió (red caída o error del servidor). */
export const JOIN_FAILED = "No pudimos darte el turno.";

/** Error sin campo, encima de la barra (REQ-078.21): qué pasó y que los datos siguen ahí. */
export function JoinError({ message }: { message: string }) {
  return (
    <div
      role="alert"
      className="border-danger bg-accent-soft text-ink animate-enter flex gap-2 rounded-md border-2 p-3 text-sm"
    >
      <Icon name="error" className="text-danger mt-0.5 size-5 shrink-0" />
      <p>
        <b className="text-danger">{message}</b>
        {message === JOIN_FAILED && " Revisa la señal y toca “Confirmar turno” otra vez."} Tus datos
        siguen ahí.
      </p>
    </div>
  );
}

export function Chip({
  selected,
  disabled,
  onClick,
  children,
}: {
  selected: boolean;
  disabled?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      aria-disabled={disabled}
      disabled={disabled}
      onClick={onClick}
      className={`text-ink min-h-12 shrink-0 rounded-md px-4 text-base font-medium whitespace-nowrap ${
        selected ? "border-brand bg-brand-soft border-2" : "border-line-strong bg-card border"
      } disabled:opacity-50`}
    >
      {children}
    </button>
  );
}
