"use client";

import Image from "next/image";
import { useActionState, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckList } from "@/components/admin/CheckList";
import { ErrorText } from "@/components/auth/LoginForm";
import {
  saveProduct,
  toggleProduct,
  toggleService,
  upsertService,
  type FormState,
} from "@/lib/actions/admin";
import { formatCOP } from "@/lib/domain/money";
import { mediaUrl, newProductPhotoPath } from "@/lib/media/paths";
import { resizePhoto } from "@/lib/media/resize";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export type ServiceRow = {
  id: string;
  name: string;
  duration_min: number;
  price: number;
  is_active: boolean;
  counts_for_loyalty: boolean;
  /** REQ-035.2: quién lo hace (ids de barbero) */
  barber_ids?: string[];
};
export type BarberOption = { id: string; name: string };
export type ProductRow = {
  id: string;
  name: string;
  price: number;
  is_active: boolean;
  for_sale: boolean;
  is_courtesy: boolean;
  photo_path: string | null;
};

function useRefreshOnOk(state: FormState) {
  const router = useRouter();
  const [seen, setSeen] = useState<FormState>(undefined);
  if (state?.ok && state !== seen) {
    setSeen(state);
    router.refresh();
  }
}

/** Fila editable de servicio (REQ-015.1) con activar/desactivar (REQ-015.2). */
export function ServiceForm({
  service,
  barbers = [],
}: {
  service?: ServiceRow;
  barbers?: BarberOption[];
}) {
  const [state, action, pending] = useActionState<FormState, FormData>(upsertService, undefined);
  const [busy, startTransition] = useTransition();
  const router = useRouter();
  useRefreshOnOk(state);
  const isNew = !service;

  return (
    <form
      action={action}
      className={`border-line bg-card flex flex-col gap-2 rounded-xl border p-3 ${
        service && !service.is_active ? "opacity-60" : ""
      }`}
      aria-label={isNew ? "Nuevo servicio" : `Servicio ${service.name}`}
    >
      {service && <input type="hidden" name="id" value={service.id} />}
      <div className="grid grid-cols-[1fr_72px_96px] gap-2">
        <label className="flex flex-col text-xs">
          Servicio
          <input
            name="name"
            defaultValue={service?.name ?? ""}
            required
            maxLength={60}
            className="input"
          />
        </label>
        <label className="flex flex-col text-xs">
          Minutos
          <input
            name="duration_min"
            type="number"
            step={5}
            min={5}
            inputMode="numeric"
            defaultValue={service?.duration_min ?? 20}
            required
            className="input"
          />
        </label>
        <label className="flex flex-col text-xs">
          Precio
          <input
            name="price"
            inputMode="numeric"
            defaultValue={service ? formatCOP(service.price).replace("$ ", "") : ""}
            placeholder="25.000"
            required
            className="input"
          />
        </label>
      </div>
      <label className="flex min-h-10 items-center gap-2 text-sm">
        <input
          type="checkbox"
          name="counts_for_loyalty"
          defaultChecked={service?.counts_for_loyalty ?? true}
          className="h-5 w-5"
        />
        Suma para la tarjeta de fidelidad
      </label>
      <CheckList
        legend="Quién lo hace"
        name="barber_ids"
        shown="barbers_shown"
        options={barbers.map((b) => ({ id: b.id, label: b.name }))}
        checked={service ? (service.barber_ids ?? []) : null}
      />
      {state?.error && <ErrorText>{state.error}</ErrorText>}
      <div className="flex gap-2">
        <button type="submit" className="btn-secondary" disabled={pending}>
          {pending ? "Guardando…" : isNew ? "Agregar servicio" : "Guardar"}
        </button>
        {service && (
          <button
            type="button"
            className="btn-secondary"
            disabled={busy}
            onClick={() =>
              startTransition(async () => {
                await toggleService(service.id, !service.is_active);
                router.refresh();
              })
            }
          >
            {service.is_active ? "Desactivar" : "Activar"}
          </button>
        )}
      </div>
    </form>
  );
}

/**
 * REQ-038.1: la foto se sube desde el navegador con la sesión del dueño (políticas de `media`);
 * el formulario guarda solo la ruta. Subida y sin guardar queda un huérfano inofensivo (§11.3).
 */
function ProductPhoto({
  businessId,
  name,
  path,
  onChange,
  onBusy,
}: {
  businessId: string;
  name: string;
  path: string | null;
  onChange: (path: string | null) => void;
  onBusy: (busy: boolean) => void;
}) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function upload(file: File) {
    setError(null);
    setUploading(true);
    onBusy(true);
    try {
      const blob = await resizePhoto(file);
      if (!blob) {
        setError("Esa foto pesa mucho. Prueba con otra.");
        return;
      }
      const next = newProductPhotoPath(businessId);
      const { error: failed } = await createSupabaseBrowserClient()
        .storage.from("media")
        .upload(next, blob, { contentType: blob.type });
      if (failed) setError("No se pudo subir la foto. Revisa tu conexión.");
      else onChange(next);
    } catch {
      setError("No pudimos leer esa foto. Prueba con otra.");
    } finally {
      setUploading(false);
      onBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <label className="flex flex-col text-xs">
        Foto (opcional)
        <input
          type="file"
          accept="image/*"
          disabled={uploading}
          className="input"
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = ""; // deja volver a escoger el mismo archivo
            if (file) void upload(file);
          }}
        />
      </label>
      {uploading && <p className="text-muted text-sm">Subiendo foto…</p>}
      {path && (
        <div className="flex items-center gap-3">
          <Image
            src={mediaUrl(path)}
            alt={name || "Foto del producto"}
            width={64}
            height={64}
            unoptimized
            className="h-16 w-16 rounded-lg object-cover"
          />
          <button
            type="button"
            className="text-accent min-h-12 text-sm underline"
            onClick={() => onChange(null)}
          >
            Quitar foto
          </button>
        </div>
      )}
      {error && <ErrorText>{error}</ErrorText>}
    </div>
  );
}

/** Fila editable de producto (REQ-024.1, REQ-038.1). */
export function ProductForm({ product, businessId }: { product?: ProductRow; businessId: string }) {
  const [state, action, pending] = useActionState<FormState, FormData>(saveProduct, undefined);
  const [busy, startTransition] = useTransition();
  const router = useRouter();
  useRefreshOnOk(state);
  const isNew = !product;
  // Controlados: React limpia el formulario al terminar la acción, también con error
  const [forSale, setForSale] = useState(product?.for_sale ?? true);
  const [isCourtesy, setIsCourtesy] = useState(product?.is_courtesy ?? false);
  const [photoPath, setPhotoPath] = useState(product?.photo_path ?? null);
  const [uploading, setUploading] = useState(false);
  const [handled, setHandled] = useState(state);
  if (state !== handled) {
    setHandled(state);
    if (state?.ok && isNew) {
      setForSale(true);
      setIsCourtesy(false);
      setPhotoPath(null);
    }
  }

  return (
    <form
      action={action}
      className={`border-line bg-card flex flex-col gap-2 rounded-xl border p-3 ${
        product && !product.is_active ? "opacity-60" : ""
      }`}
      aria-label={isNew ? "Nuevo producto" : `Producto ${product.name}`}
    >
      {product && <input type="hidden" name="id" value={product.id} />}
      <input type="hidden" name="photo_path" value={photoPath ?? ""} />
      <div className="grid grid-cols-[1fr_110px] gap-2">
        <label className="flex flex-col text-xs">
          Producto
          <input
            name="name"
            defaultValue={product?.name ?? ""}
            required
            maxLength={60}
            className="input"
          />
        </label>
        <label className="flex flex-col text-xs">
          Precio
          <input
            name="price"
            inputMode="numeric"
            defaultValue={product ? formatCOP(product.price).replace("$ ", "") : ""}
            placeholder="3.000"
            className="input"
          />
        </label>
      </div>
      <label className="flex min-h-10 items-center gap-2 text-sm">
        <input
          type="checkbox"
          name="for_sale"
          checked={forSale}
          onChange={(e) => setForSale(e.target.checked)}
          className="h-5 w-5"
        />
        A la venta
      </label>
      <label className="flex min-h-10 items-center gap-2 text-sm">
        <input
          type="checkbox"
          name="is_courtesy"
          checked={isCourtesy}
          onChange={(e) => setIsCourtesy(e.target.checked)}
          className="h-5 w-5"
        />
        De cortesía
      </label>
      <ProductPhoto
        businessId={businessId}
        name={product?.name ?? ""}
        path={photoPath}
        onChange={setPhotoPath}
        onBusy={setUploading}
      />
      {state?.error && <ErrorText>{state.error}</ErrorText>}
      <div className="flex gap-2">
        <button type="submit" className="btn-secondary" disabled={pending || uploading}>
          {pending ? "Guardando…" : isNew ? "Agregar producto" : "Guardar"}
        </button>
        {product && (
          <button
            type="button"
            className="btn-secondary"
            disabled={busy}
            onClick={() =>
              startTransition(async () => {
                await toggleProduct(product.id, !product.is_active);
                router.refresh();
              })
            }
          >
            {product.is_active ? "Desactivar" : "Activar"}
          </button>
        )}
      </div>
    </form>
  );
}
