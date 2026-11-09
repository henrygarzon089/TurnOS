"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  ProductForm,
  ServiceForm,
  type BarberOption,
  type ProductRow,
  type ServiceRow,
} from "@/components/admin/ItemForms";
import { Button } from "@/components/ui/Button";
import { Sheet } from "@/components/ui/Sheet";
import { Switch } from "@/components/ui/Switch";
import { toggleService } from "@/lib/actions/admin";
import { formatCOP } from "@/lib/domain/money";
import { mediaUrl } from "@/lib/media/paths";

/**
 * Servicios y productos del dueño como en el tablero Dueno-Config / Dueno-Local: una fila (o
 * tarjeta) por ítem para leer de un vistazo y "Editar" que abre la hoja con el formulario. Así la
 * pantalla tiene un solo botón principal: "Nuevo …" (REQ-078.4).
 */

export function NewServiceButton({ barbers }: { barbers: BarberOption[] }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button onClick={() => setOpen(true)}>Nuevo servicio</Button>
      <Sheet open={open} onClose={() => setOpen(false)} title="Nuevo servicio">
        <ServiceForm barbers={barbers} onDone={() => setOpen(false)} />
      </Sheet>
    </>
  );
}

const SERVICE_COLS = "lg:grid-cols-[1fr_8rem_7rem_6rem_9rem_6rem]";

/**
 * REQ-078.33 "Visible al público" del tablero Dueno-Config: hace lo mismo que "Activar" /
 * "Desactivar" de la hoja (REQ-018.3: desactivado deja de ofrecerse, se conserva en el historial).
 */
function ServiceVisibleSwitch({ service }: { service: ServiceRow }) {
  const router = useRouter();
  const [busy, startTransition] = useTransition();
  const [on, setOn] = useState(service.is_active);
  return (
    <Switch
      label={`${service.name} visible al público`}
      checked={on}
      disabled={busy}
      onChange={(e) => {
        const next = e.target.checked;
        setOn(next);
        startTransition(async () => {
          const res = await toggleService(service.id, next);
          if (res?.error) setOn(!next);
          router.refresh();
        });
      }}
    />
  );
}

export function ServiceList({
  services,
  barbers,
}: {
  services: ServiceRow[];
  barbers: BarberOption[];
}) {
  return (
    <div className="overflow-hidden rounded-b-md">
      <div
        aria-hidden="true"
        className={`bg-brand text-brand-ink hidden px-4 py-2 text-sm font-semibold lg:grid lg:gap-3 ${SERVICE_COLS}`}
      >
        <span>Servicio</span>
        <span className="text-right">Precio</span>
        <span className="text-right">Duración</span>
        <span className="text-right">Lo hacen</span>
        <span>Visible al público</span>
        <span />
      </div>
      <ul className="divide-line divide-y">
        {services.map((s) => (
          <li key={s.id}>
            <ServiceLine service={s} barbers={barbers} />
          </li>
        ))}
      </ul>
    </div>
  );
}

function ServiceLine({ service, barbers }: { service: ServiceRow; barbers: BarberOption[] }) {
  const [open, setOpen] = useState(false);
  const who = (service.barber_ids ?? []).length;
  return (
    <article
      aria-label={`Servicio ${service.name}`}
      className={`grid grid-cols-[1fr_auto] items-center gap-x-3 px-4 py-2 lg:gap-3 ${SERVICE_COLS}`}
    >
      <div className="min-w-0">
        <p className={`font-semibold ${service.is_active ? "" : "text-muted"}`}>{service.name}</p>
        <p className="text-muted text-sm lg:hidden">
          {formatCOP(service.price)} · {service.duration_min} min · lo hacen {who}
          {!service.is_active && " · Desactivado"}
        </p>
      </div>
      <span className="hidden text-right tabular-nums lg:block">{formatCOP(service.price)}</span>
      <span className="hidden text-right tabular-nums lg:block">{service.duration_min} min</span>
      <span className="hidden text-right tabular-nums lg:block">{who}</span>
      <span className="hidden lg:block">
        <ServiceVisibleSwitch key={String(service.is_active)} service={service} />
      </span>
      <Button variant="text" className="justify-self-end" onClick={() => setOpen(true)}>
        Editar
      </Button>
      <Sheet open={open} onClose={() => setOpen(false)} title={`Editar ${service.name}`}>
        <ServiceForm service={service} barbers={barbers} onDone={() => setOpen(false)} />
      </Sheet>
    </article>
  );
}

export function NewProductButton({
  businessId,
  categories,
}: {
  businessId: string;
  categories: string[];
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button onClick={() => setOpen(true)}>Nuevo producto</Button>
      <Sheet open={open} onClose={() => setOpen(false)} title="Nuevo producto">
        <ProductForm
          businessId={businessId}
          categories={categories}
          onDone={() => setOpen(false)}
        />
      </Sheet>
    </>
  );
}

/** Existencias de la vitrina por producto (inventario, REQ-072); `low` en su mínimo o menos. */
export type ProductStock = Record<string, { qty: number; low: boolean }>;

export function ProductGrid({
  products,
  stock = {},
  businessId,
  categories,
}: {
  products: ProductRow[];
  stock?: ProductStock;
  businessId: string;
  categories: string[];
}) {
  return (
    <ul className="grid grid-cols-2 gap-3 p-4 sm:grid-cols-3 lg:grid-cols-5">
      {products.map((p) => (
        <li key={p.id} className="min-w-0">
          <ProductCard
            product={p}
            stock={stock[p.id]}
            businessId={businessId}
            categories={categories}
          />
        </li>
      ))}
    </ul>
  );
}

function ProductCard({
  product,
  stock,
  businessId,
  categories,
}: {
  product: ProductRow;
  stock?: { qty: number; low: boolean };
  businessId: string;
  categories: string[];
}) {
  const [open, setOpen] = useState(false);
  const tags = [
    product.category,
    stock && !stock.low ? String(stock.qty) : null,
    product.is_courtesy ? "De cortesía" : null,
    product.for_sale ? null : "No se vende",
    product.is_active ? null : "Desactivado",
  ].filter(Boolean);
  return (
    <article
      aria-label={`Producto ${product.name}`}
      className="border-line bg-card flex h-full flex-col overflow-hidden rounded-md border"
    >
      {product.photo_path ? (
        <Image
          src={mediaUrl(product.photo_path)}
          alt={product.name}
          width={320}
          height={240}
          unoptimized
          className="aspect-[4/3] w-full object-cover"
        />
      ) : (
        <div aria-hidden="true" className="bg-skeleton aspect-[4/3] w-full" />
      )}
      <div className="flex flex-1 flex-col gap-0.5 px-3 pt-2">
        <p className={`font-semibold break-words ${product.is_active ? "" : "text-muted"}`}>
          {product.name}
        </p>
        <p className="tabular-nums">{formatCOP(product.price)}</p>
        {tags.length > 0 && <p className="text-muted text-sm">{tags.join(" · ")}</p>}
        {stock?.low && (
          <p className="text-warn text-sm font-semibold">
            {stock.qty <= 0 ? "Agotado" : `quedan ${stock.qty}`}
          </p>
        )}
      </div>
      <Button variant="text" className="self-start" onClick={() => setOpen(true)}>
        Editar
      </Button>
      <Sheet open={open} onClose={() => setOpen(false)} title={`Editar ${product.name}`}>
        <ProductForm
          product={product}
          businessId={businessId}
          categories={categories}
          onDone={() => setOpen(false)}
        />
      </Sheet>
    </article>
  );
}
