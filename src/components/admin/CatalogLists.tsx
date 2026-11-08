"use client";

import Image from "next/image";
import { useState } from "react";
import {
  ProductForm,
  ServiceForm,
  type BarberOption,
  type ProductRow,
  type ServiceRow,
} from "@/components/admin/ItemForms";
import { Button } from "@/components/ui/Button";
import { Sheet } from "@/components/ui/Sheet";
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

export function ServiceList({
  services,
  barbers,
}: {
  services: ServiceRow[];
  barbers: BarberOption[];
}) {
  return (
    <div className="border-line bg-card mt-4 overflow-hidden rounded-md border">
      <div
        aria-hidden="true"
        className={`bg-brand text-brand-ink hidden px-4 py-2 text-sm font-semibold lg:grid lg:gap-3 ${SERVICE_COLS}`}
      >
        <span>Servicio</span>
        <span className="text-right">Precio</span>
        <span className="text-right">Duración</span>
        <span className="text-right">Lo hacen</span>
        <span>Estado</span>
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
      <span className={`hidden text-sm lg:block ${service.is_active ? "text-ok" : "text-muted"}`}>
        {service.is_active ? "Se ofrece" : "Desactivado"}
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

export function ProductGrid({
  products,
  businessId,
  categories,
}: {
  products: ProductRow[];
  businessId: string;
  categories: string[];
}) {
  return (
    <ul className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
      {products.map((p) => (
        <li key={p.id}>
          <ProductCard product={p} businessId={businessId} categories={categories} />
        </li>
      ))}
    </ul>
  );
}

function ProductCard({
  product,
  businessId,
  categories,
}: {
  product: ProductRow;
  businessId: string;
  categories: string[];
}) {
  const [open, setOpen] = useState(false);
  const tags = [
    product.category,
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
        <p className={`font-semibold ${product.is_active ? "" : "text-muted"}`}>{product.name}</p>
        <p className="tabular-nums">{formatCOP(product.price)}</p>
        {tags.length > 0 && <p className="text-muted text-sm">{tags.join(" · ")}</p>}
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
