import Image from "next/image";
import { Avatar } from "@/components/media/Avatar";
import { Icon } from "@/components/ui/Icon";
import { formatCOP } from "@/lib/domain/money";
import { mediaUrl } from "@/lib/media/paths";

/**
 * Piezas de los pasos de tomar turno y reservar (REQ-088, REQ-089, REQ-086.2, REQ-085.5, design.md
 * §26.3). Las tarjetas son radios: tocar una escoge y pasa al paso siguiente (REQ-088.3).
 */

/** "Paso 2 de 3", el título del paso, la barra de avance y "Atrás". */
export function StepHeader({
  step,
  total,
  title,
  onBack,
}: {
  step: number;
  total: number;
  title: string;
  onBack: () => void;
}) {
  return (
    <div className="flex flex-col gap-2" data-testid="step-header">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onBack}
          className="text-ink -ml-2 flex min-h-12 items-center gap-1 rounded-md px-2 font-semibold"
        >
          <Icon name="back" className="size-5" />
          Atrás
        </button>
        <p className="text-muted ml-auto text-sm font-semibold tabular-nums">
          Paso {step} de {total}
        </p>
      </div>
      <div
        role="progressbar"
        aria-label={`Paso ${step} de ${total}`}
        aria-valuemin={1}
        aria-valuemax={total}
        aria-valuenow={step}
        className="bg-line h-1.5 overflow-hidden rounded-full"
      >
        <div
          className="bg-brand h-full rounded-full transition-[width] duration-300"
          style={{ width: `${(step / total) * 100}%` }}
        />
      </div>
      <h2 className="mt-2 text-2xl font-bold">{title}</h2>
    </div>
  );
}

const CARD =
  "focus-visible:ring-brand flex w-full items-center gap-3 rounded-lg p-3 text-left focus-visible:ring-2 focus-visible:outline-none";
const cardState = (checked: boolean, disabled: boolean) =>
  disabled
    ? "border-line bg-surface text-muted cursor-not-allowed border"
    : checked
      ? "border-brand bg-brand-soft border-2"
      : "border-line-strong bg-card active:bg-surface border";

/** REQ-086.2: foto (o tijeras), nombre, precio y duración. */
export function ServiceCard({
  name,
  price,
  durationMin,
  photoPath,
  checked,
  disabled = false,
  disabledText,
  onPick,
}: {
  name: string;
  price: number;
  durationMin: number;
  photoPath: string | null | undefined;
  checked: boolean;
  disabled?: boolean;
  disabledText?: string;
  onPick: () => void;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={checked}
      aria-disabled={disabled || undefined}
      disabled={disabled}
      onClick={onPick}
      className={`${CARD} ${cardState(checked, disabled)}`}
    >
      {photoPath ? (
        <Image
          src={mediaUrl(photoPath)}
          alt=""
          width={96}
          height={64}
          unoptimized
          loading="lazy"
          className={`h-16 w-24 shrink-0 rounded-md object-cover ${disabled ? "opacity-50 grayscale" : ""}`}
        />
      ) : (
        <span
          aria-hidden="true"
          className="bg-brand-soft text-brand flex h-16 w-24 shrink-0 items-center justify-center rounded-md"
        >
          <Icon name="scissors" className="size-7" />
        </span>
      )}
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="text-lg leading-tight font-semibold break-words">{name}</span>
        <span className="text-muted text-sm tabular-nums">
          {disabled && disabledText ? disabledText : `${formatCOP(price)} · ${durationMin} min`}
        </span>
      </span>
    </button>
  );
}

/** REQ-085.5 / REQ-088.2: foto, nombre y "Libre", "n antes · ~ N min" o "En pausa". */
export function BarberCard({
  name,
  photoPath,
  text,
  checked,
  disabled = false,
  badge,
  onPick,
}: {
  name: string;
  photoPath: string | null | undefined;
  text: string;
  checked: boolean;
  disabled?: boolean;
  /** "Tu barbero de siempre" (REQ-088.5). */
  badge?: string;
  onPick: () => void;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={checked}
      aria-disabled={disabled || undefined}
      aria-label={`${name}, ${text}`}
      disabled={disabled}
      onClick={onPick}
      className={`${CARD} ${cardState(checked, disabled)}`}
    >
      <Avatar name={name} photoPath={photoPath} size="lg" dimmed={disabled} />
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="text-lg leading-tight font-semibold break-words">{name}</span>
        <span
          className={`text-sm tabular-nums ${text === "Libre" ? "text-ok font-semibold" : text === "En pausa" ? "text-warn font-semibold" : "text-muted"}`}
        >
          {text}
        </span>
        {badge && <span className="text-brand text-xs font-semibold">{badge}</span>}
      </span>
    </button>
  );
}

/** "El primero libre", primero en el paso 2, con su espera. */
export function AnyBarberCard({
  title = "El primero libre",
  text,
  checked,
  onPick,
}: {
  /** "El que esté libre" en la cita (REQ-089.1). */
  title?: string;
  text: string;
  checked: boolean;
  onPick: () => void;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={checked}
      aria-label={`${title}, ${text}`}
      onClick={onPick}
      className={`${CARD} ${cardState(checked, false)}`}
    >
      <span
        aria-hidden="true"
        className="bg-brand text-brand-ink flex size-20 shrink-0 items-center justify-center rounded-full"
      >
        <Icon name="users" className="size-8" />
      </span>
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="text-lg leading-tight font-semibold">{title}</span>
        <span className="text-muted text-sm tabular-nums">{text}</span>
      </span>
    </button>
  );
}
