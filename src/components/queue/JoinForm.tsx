"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { ErrorText } from "@/components/auth/LoginForm";
import { MenuSheet } from "@/components/public/MenuSheet";
import { JoinBar } from "@/components/public/PublicHome";
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
import { barbersForService, serviceAvailability } from "@/lib/domain/barber-services";
import { MONTH_NAMES } from "@/lib/domain/birthday";
import { formatCOP } from "@/lib/domain/money";
import { formatPhoneCO, normalizePhoneCO } from "@/lib/domain/phone";
import { estimateNewTicket } from "@/lib/domain/queue-estimate";
import { mediaUrl } from "@/lib/media/paths";
import type { PublicBusiness } from "@/lib/queue/public-queue";
import { useBrowserOnline } from "@/lib/realtime/use-browser-online";
import { readPrefs, writePrefs } from "@/lib/storage/customer-prefs";

type Props = {
  business: PublicBusiness;
  now: string;
  /** REQ-050.1: citas encendidas con alguien que las reciba ("Reservar una cita" en la barra). */
  canBook?: boolean;
};

/**
 * REQ-003.1 formulario de 4 campos + aviso de privacidad (REQ-002), montado en la portada (T-173,
 * ADR-052): "¿Qué te vas a hacer?" en rejilla de 2, "¿Con quién?" con "El primero libre" primero,
 * nombre, celular, lo que la app tiene y el tablero no, la privacidad en una línea y "Tomar turno"
 * en la barra fija, que pasa a "Guardando…" (REQ-078.9) y se deshabilita sin señal (REQ-078.10).
 */
export function JoinForm({ business, now, canBook = false }: Props) {
  const router = useRouter();
  const { online } = useBrowserOnline();
  const [pending, startTransition] = useTransition();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  // REQ-035.7: arranca en el primer servicio que hoy alguien hace
  const [serviceId, setServiceId] = useState(
    business.services.find((s) => serviceAvailability(s, business.barbersToday) === "available")
      ?.id ?? "",
  );
  const [barberId, setBarberId] = useState<string | null>(null);
  const pickedByUser = useRef(false);
  const pickBarber = (id: string | null) => {
    pickedByUser.current = true;
    setBarberId(id);
  };
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

  // REQ-003.7 / REQ-002.4: prellenar desde el navegador
  useEffect(() => {
    // Tras hidratar (evita desajuste servidor/cliente): leer el navegador en el siguiente frame
    const id = requestAnimationFrame(() => {
      const p = readPrefs();
      if (p.name) setName(p.name);
      if (p.phone) {
        setPhone(formatPhoneCO(p.phone));
        // REQ-022.1: preseleccionar su barbero preferido si atiende hoy (si no, "El que esté libre")
        void getPreferredBarber(business.slug, p.phone).then((id) => {
          const ok = business.barbersToday.some((b) => b.id === id && b.status !== "paused");
          // REQ-035.6: el preferido se queda solo si hace el servicio escogido (se revisa abajo)
          if (id && ok && !pickedByUser.current) setBarberId(id);
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
  // REQ-035.6: solo los presentes que hacen el servicio escogido
  const barbers = service
    ? barbersForService(service, business.barbersToday)
    : business.barbersToday;
  const shownBarberId = barberId && barbers.some((b) => b.id === barberId) ? barberId : null;
  function pickService(id: string) {
    setServiceId(id);
    const next = business.services.find((s) => s.id === id);
    // REQ-035.6: si el barbero escogido no hace el servicio nuevo, vuelve "El que esté libre"
    if (
      next &&
      barberId &&
      !barbersForService(next, business.barbersToday).some((b) => b.id === barberId)
    )
      setBarberId(null);
  }

  // REQ-017.3: ¿alcanzamos a atenderte hoy?
  const warning = useMemo(() => {
    if (!service || !business.closesAt) return null;
    const est = estimateNewTicket(
      { now: new Date(now), ...business.queue },
      service.durationMin,
      shownBarberId,
      service.barberIds ?? null,
    );
    if (est.waitMin === null) return null;
    const [h, m] = business.closesAt.split(":").map(Number);
    const closes = new Date(now);
    closes.setHours(h, m, 0, 0); // el navegador del cliente está en Colombia
    const minutesLeft = (closes.getTime() - new Date(now).getTime()) / 60_000;
    return est.waitMin + service.durationMin > minutesLeft
      ? "Es posible que no alcancemos a atenderte hoy: la espera supera el tiempo que falta para cerrar."
      : null;
  }, [service, shownBarberId, business, now]);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      // Sin respuesta de la acción (red caída, servidor): el recuadro de error, nunca un turno a medias
      const r = await joinQueue({
        slug: business.slug,
        name,
        phone,
        serviceId,
        preferredBarberId: shownBarberId,
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

  const citaQuery = new URLSearchParams({
    ...(serviceId ? { servicio: serviceId } : {}),
    ...(shownBarberId ? { barbero: shownBarberId } : {}),
  }).toString();
  const cutsBarber = shownBarberId ? barbers.find((b) => b.id === shownBarberId) : undefined;

  return (
    <form onSubmit={submit} className="flex flex-col gap-5 pb-34 lg:pb-0" aria-label="Tomar turno">
      <fieldset className="min-w-0">
        <legend className="mb-2 text-sm font-semibold">¿Qué te vas a hacer?</legend>
        <div className="grid grid-cols-2 gap-2">
          {business.services.map((s) => {
            // REQ-035.7: en gris si hoy ninguno de los presentes lo hace
            const nobody = serviceAvailability(s, business.barbersToday) === "nobody_today";
            const chosen = serviceId === s.id;
            return (
              <label
                key={s.id}
                title={`${s.name} · ${s.durationMin} min`}
                className={`has-[:focus-visible]:ring-brand relative flex min-h-15 flex-col justify-center rounded-md px-3 py-2 has-[:focus-visible]:ring-2 lg:flex-row lg:items-center lg:justify-between lg:gap-2 ${nobody ? "border-line bg-surface text-muted cursor-not-allowed border" : chosen ? "border-brand bg-brand-soft cursor-pointer border-2" : "border-line-strong bg-card cursor-pointer border"}`}
              >
                <input
                  type="radio"
                  name="serviceId"
                  value={s.id}
                  checked={chosen}
                  disabled={nobody || pending}
                  onChange={() => pickService(s.id)}
                  // transparente sobre toda la celda: se toca la celda entera
                  className="absolute inset-0 cursor-[inherit] appearance-none opacity-0"
                />
                <span className="leading-tight font-semibold break-words">{s.name}</span>
                <span className="text-sm tabular-nums">
                  {nobody ? "Hoy no hay quién lo haga" : formatCOP(s.price)}
                </span>
              </label>
            );
          })}
        </div>
        {error?.field === "serviceId" && <ErrorText>{error.message}</ErrorText>}
      </fieldset>
      <fieldset className="min-w-0">
        <legend className="mb-2 text-sm font-semibold">¿Con quién?</legend>
        {/* Se desliza la fila de fichas, no la página (REQ-078.15) */}
        <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 lg:mx-0 lg:flex-wrap lg:overflow-visible lg:px-0">
          <Chip selected={shownBarberId === null} onClick={() => pickBarber(null)}>
            El primero libre
          </Chip>
          {barbers.map((b) => {
            const unavailable = b.status === "paused";
            return (
              <Chip
                key={b.id}
                selected={shownBarberId === b.id}
                disabled={unavailable}
                onClick={() => pickBarber(b.id)}
              >
                {b.name}
                {unavailable && <span className="text-muted ml-1 text-xs">(en pausa)</span>}
              </Chip>
            );
          })}
        </div>
        {/* REQ-039.5: debajo de las fichas, para el elegido que tenga fotos */}
        {cutsBarber && business.photoCounts[cutsBarber.id] > 0 && (
          <button
            type="button"
            aria-label={`Ver cortes de ${cutsBarber.name}`}
            className="text-brand min-h-12 text-sm font-medium underline"
            onClick={() => setCutsOf(cutsBarber)}
          >
            Ver cortes
          </button>
        )}
        {error?.field === "preferredBarberId" && <ErrorText>{error.message}</ErrorText>}
      </fieldset>
      {cutsOf && (
        <BarberCutsSheet slug={business.slug} barber={cutsOf} onClose={() => setCutsOf(null)} />
      )}

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
        error={error?.field === "phone" ? error.message : undefined}
      />
      {askBirthday && (
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
                value={birthdayDay}
                onChange={(e) => setBirthdayDay(e.target.value)}
                className="input"
                aria-invalid={error?.field === "birthday"}
              />
            </label>
            <label className="flex min-w-0 flex-1 flex-col gap-1 text-sm">
              Mes
              <select
                name="birthdayMonth"
                value={birthdayMonth}
                onChange={(e) => setBirthdayMonth(e.target.value)}
                className="input"
                aria-invalid={error?.field === "birthday"}
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
          {error?.field === "birthday" && <ErrorText>{error.message}</ErrorText>}
        </fieldset>
      )}

      {(business.courtesies.length > 0 || error?.field === "courtesyProductId") && (
        <fieldset className="min-w-0">
          <legend className="mb-2 text-sm font-semibold">Bebida de cortesía</legend>
          <div className="flex flex-col gap-2">
            {[{ id: null, name: "No, gracias", photoPath: null }, ...business.courtesies].map(
              (c) => (
                <label
                  key={c.id ?? "ninguna"}
                  className={`flex min-h-12 cursor-pointer items-center gap-2 rounded-md border px-3 py-2 ${shownCourtesyId === c.id ? "border-brand bg-brand-soft border-2" : "border-line-strong bg-card"}`}
                >
                  <input
                    type="radio"
                    name="courtesyProductId"
                    checked={shownCourtesyId === c.id}
                    onChange={() => setCourtesyId(c.id)}
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
              ),
            )}
          </div>
          {error?.field === "courtesyProductId" && <ErrorText>{error.message}</ErrorText>}
        </fieldset>
      )}

      {warning && (
        <p role="status" className="text-warn bg-warn-soft rounded-md p-3 text-sm font-medium">
          {warning}
        </p>
      )}

      {askWhatsapp && (
        <label className="flex min-h-12 items-start gap-3 text-sm">
          <input
            type="checkbox"
            name="whatsappOptIn"
            checked={whatsappOptIn}
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
          <Link href={`/${business.slug}/privacidad`} className="text-brand underline">
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
      {error?.field === "privacyAccepted" && <ErrorText>{error.message}</ErrorText>}
      {error && !error.field && <JoinError message={error.message} />}

      <JoinBar
        slug={business.slug}
        pending={pending}
        disabled={pending || !privacy || !online}
        online={online}
        hint={
          !privacy && !alreadyAccepted ? "Marca la casilla de privacidad para continuar." : null
        }
        canBook={canBook}
        citaQuery={citaQuery}
        menuTrigger={
          business.products.length > 0 ? (
            <MenuSheet address={business.address} products={business.products} />
          ) : null
        }
      />
    </form>
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
        {message === JOIN_FAILED && ' Revisa la señal y toca "Tomar turno" otra vez.'} Tus datos
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
      className={`text-ink min-h-12 rounded-md px-4 text-base font-medium ${
        selected ? "border-brand bg-brand-soft border-2" : "border-line-strong bg-card border"
      } disabled:opacity-50`}
    >
      {children}
    </button>
  );
}
