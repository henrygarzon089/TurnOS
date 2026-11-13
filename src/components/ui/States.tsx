import { Icon, type IconName } from "./Icon";

/**
 * Vacío y error (REQ-078.11, design §22.3). El vacío dice qué pasa y qué hacer. El error dice
 * qué pasó, promete que los datos están a salvo solo si es cierto (`dataSafe`) y ofrece
 * "Intentar de nuevo".
 */
export function EmptyState({
  icon = "qr",
  title,
  text,
  action,
}: {
  icon?: IconName;
  title: string;
  text: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-2 px-4 py-8 text-center">
      <Icon name={icon} className="text-muted size-8" />
      <p className="text-ink text-lg font-bold">{title}</p>
      <p className="text-muted max-w-xs text-base">{text}</p>
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

export function ErrorState({
  title,
  text = "Puede ser la señal.",
  dataSafe = false,
  onRetry,
}: {
  title: string;
  text?: string;
  dataSafe?: boolean;
  onRetry?: () => void;
}) {
  return (
    <div role="alert" className="flex flex-col items-center gap-2 px-4 py-8 text-center">
      <Icon name="offline" className="text-danger size-8" />
      <p className="text-ink text-lg font-bold">{title}</p>
      <p className="text-muted max-w-xs text-base">
        {text}
        {dataSafe && " Tus datos no se perdieron."}
      </p>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="bg-brand text-brand-ink desk:min-h-10 desk:text-base mt-2 inline-flex min-h-12 items-center rounded-md px-5 text-lg font-semibold active:opacity-90"
        >
          Intentar de nuevo
        </button>
      )}
    </div>
  );
}
