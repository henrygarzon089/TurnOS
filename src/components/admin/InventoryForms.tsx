"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ErrorText } from "@/components/auth/LoginForm";
import { EmptyState } from "@/components/ui/States";
import {
  acceptYield,
  addBasicTemplate,
  recordCount,
  saveAlertPct,
  refillStation,
  registerPurchase,
  saveInventoryItem,
  setItemUsage,
  transferStock,
  type ActionResult,
  type CatalogItem,
  type CountResult,
  type InventoryCatalog,
  type InventoryLocation,
  type OverviewItem,
  type YieldSuggestion,
} from "@/lib/actions/inventory";
import {
  ADJUSTMENT_REASON_LABELS,
  ADJUSTMENT_REASONS,
  INVENTORY_GROUP_LABELS,
  INVENTORY_GROUPS,
  INVENTORY_USE_LABELS,
  type InventoryUse,
} from "@/lib/domain/inventory";

/** Un formulario que llama una acción de inventario, muestra el error y refresca al terminar. */
function ActionForm({
  action,
  label,
  submit,
  pendingText,
  done,
  children,
  resetOnDone = true,
  primary = false,
  className = "border-line bg-card flex flex-col gap-3 rounded-md border p-4",
}: {
  action: (prev: ActionResult, fd: FormData) => Promise<ActionResult>;
  label: string;
  submit: string;
  pendingText: string;
  done: string;
  children: React.ReactNode;
  resetOnDone?: boolean;
  /** La acción principal de la pantalla va rellena; las demás en contorno (REQ-078.4). */
  primary?: boolean;
  className?: string;
}) {
  const router = useRouter();
  const [state, setState] = useState<ActionResult>(undefined);
  const [pending, startTransition] = useTransition();

  // onSubmit y no `action`: React limpia el formulario al terminar una `action`, aunque falle.
  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    startTransition(async () => {
      const r = await action(state, new FormData(form));
      setState(r);
      if (r?.ok) {
        if (resetOnDone) form.reset();
        router.refresh();
      }
    });
  }

  return (
    <form onSubmit={onSubmit} aria-label={label} className={className}>
      {children}
      {state && !state.ok && state.error && <ErrorText>{state.error}</ErrorText>}
      {state?.ok && (
        <p role="status" className="text-ok text-sm font-medium">
          {done}
        </p>
      )}
      <button
        type="submit"
        className={primary ? "btn-primary" : "btn-secondary"}
        disabled={pending}
      >
        {pending ? pendingText : submit}
      </button>
    </form>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1 text-sm font-medium">
      {label}
      {children}
      {hint && <span className="text-muted text-sm font-normal">{hint}</span>}
    </label>
  );
}

function ItemSelect({ items, use }: { items: OverviewItem[]; use?: InventoryUse }) {
  return (
    <select name="itemId" required className="input h-12" defaultValue="">
      <option value="" disabled>
        Escoge un ítem
      </option>
      {items
        .filter((i) => !use || i.use === use)
        .map((i) => (
          <option key={i.id} value={i.id}>
            {i.name} ({i.presentation})
          </option>
        ))}
    </select>
  );
}

function locationLabel(l: InventoryLocation) {
  if (l.kind === "warehouse") return "Bodega";
  if (l.kind === "shelf") return "Vitrina";
  return `Estación de ${l.barberName ?? ""}`;
}

// ------------------------------------------------------------ movimientos ----

/** REQ-071.2 / REQ-071.3 / REQ-071.4 entrada a bodega, reposición y transferencia. */
export function InventoryMovements({
  items,
  locations,
}: {
  items: OverviewItem[];
  locations: InventoryLocation[];
}) {
  const [tab, setTab] = useState<"refill" | "purchase" | "transfer">("refill");
  const stations = locations.filter((l) => l.kind === "station" && l.status === "open");
  const tabs = [
    { id: "refill", label: "Reponer" },
    { id: "purchase", label: "Entrada a bodega" },
    { id: "transfer", label: "Transferir" },
  ] as const;

  return (
    <section className="mt-6" aria-labelledby="mov-title">
      <h2 id="mov-title" className="text-lg font-semibold">
        Movimientos
      </h2>
      <div className="mt-2 grid grid-cols-3 gap-2" role="tablist">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={tab === t.id}
            onClick={() => setTab(t.id)}
            className={`min-h-12 rounded-sm px-2 text-base ${
              tab === t.id
                ? "border-brand bg-brand-soft text-ink border-2 font-bold"
                : "border-line-strong bg-card text-ink border font-semibold"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="mt-3">
        {tab === "refill" && (
          <ActionForm
            action={refillStation}
            label="Reponer"
            submit="Reponer"
            pendingText="Reponiendo…"
            done="Listo: salió el vacío y entró el lleno."
          >
            <p className="text-muted text-sm">
              El barbero entrega el envase vacío y recibe uno lleno de la bodega.
            </p>
            <Field label="Barbero">
              <select name="barberId" required className="input h-12" defaultValue="">
                <option value="" disabled>
                  Escoge un barbero
                </option>
                {stations.map((s) => (
                  <option key={s.id} value={s.barberId!}>
                    {s.barberName}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Ítem">
              <ItemSelect items={items} use="internal" />
            </Field>
            <Field label="Cantidad">
              <input name="qty" inputMode="numeric" required defaultValue="1" className="input" />
            </Field>
            <label className="flex min-h-12 items-center gap-3 text-base font-semibold">
              <input type="checkbox" name="emptyReturned" required className="h-6 w-6" />
              Recibí el envase vacío
            </label>
          </ActionForm>
        )}

        {tab === "purchase" && (
          <ActionForm
            action={registerPurchase}
            label="Entrada a bodega"
            submit="Registrar entrada"
            pendingText="Guardando…"
            done="Entrada registrada en la bodega."
          >
            <Field label="Ítem">
              <ItemSelect items={items} />
            </Field>
            <Field label="Cantidad">
              <input name="qty" inputMode="numeric" required className="input" />
            </Field>
            <Field label="Precio pagado por unidad" hint="Queda como precio del ítem.">
              <input
                name="unitCost"
                inputMode="numeric"
                required
                placeholder="18.000"
                className="input"
              />
            </Field>
          </ActionForm>
        )}

        {tab === "transfer" && (
          <ActionForm
            action={transferStock}
            label="Transferir"
            submit="Transferir"
            pendingText="Transfiriendo…"
            done="Transferencia registrada."
          >
            <p className="text-muted text-sm">
              Bodega ↔ vitrina, bodega → estación (hasta la dotación) o estación → bodega.
            </p>
            <Field label="Ítem">
              <ItemSelect items={items} />
            </Field>
            <Field label="Desde">
              <select name="from" required className="input h-12" defaultValue="">
                <option value="" disabled>
                  Escoge el origen
                </option>
                {locations.map((l) => (
                  <option key={l.id} value={l.id}>
                    {locationLabel(l)}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Hacia">
              <select name="to" required className="input h-12" defaultValue="">
                <option value="" disabled>
                  Escoge el destino
                </option>
                {locations
                  .filter((l) => l.status === "open")
                  .map((l) => (
                    <option key={l.id} value={l.id}>
                      {locationLabel(l)}
                    </option>
                  ))}
              </select>
            </Field>
            <Field label="Cantidad">
              <input name="qty" inputMode="numeric" required defaultValue="1" className="input" />
            </Field>
          </ActionForm>
        )}
      </div>
    </section>
  );
}

/** REQ-073.5 aceptar o cambiar el rendimiento sugerido. */
export function YieldSuggestionForm({ s }: { s: YieldSuggestion }) {
  return (
    <ActionForm
      action={acceptYield}
      label={`Rendimiento de ${s.name}`}
      submit="Aceptar rendimiento"
      pendingText="Guardando…"
      done="Rendimiento guardado."
    >
      <p className="text-sm">
        <span className="font-semibold">{s.name}</span>: {s.services} servicios y {s.real_use}{" "}
        unidades en {s.windows} conteos.
      </p>
      <input type="hidden" name="itemId" value={s.item_id} />
      <Field label="Servicios por unidad">
        <input
          name="servicesPerUnit"
          inputMode="numeric"
          required
          defaultValue={s.suggested}
          className="input"
        />
      </Field>
    </ActionForm>
  );
}

// ------------------------------------------------------------- catálogo ----

/** REQ-070.1 / REQ-070.2 / REQ-070.6 crear o editar un ítem del catálogo. */
export function InventoryItemForm({
  item,
  products,
}: {
  item?: CatalogItem;
  products: InventoryCatalog["products"];
}) {
  const [use, setUse] = useState<InventoryUse>(item?.use ?? "internal");
  return (
    <ActionForm
      action={saveInventoryItem}
      primary={!item}
      label={item ? `Editar ${item.name}` : "Nuevo ítem"}
      submit={item ? "Guardar cambios" : "Crear ítem"}
      pendingText="Guardando…"
      done="Guardado."
      resetOnDone={!item}
    >
      {item && <input type="hidden" name="id" value={item.id} />}
      <Field label="Nombre">
        <input name="name" required maxLength={60} defaultValue={item?.name} className="input" />
      </Field>
      <fieldset className="flex flex-col gap-1">
        <legend className="text-sm font-semibold">Uso</legend>
        <div className="grid grid-cols-2 gap-2">
          {(["internal", "sale"] as const).map((u) => (
            <label
              key={u}
              className={`flex min-h-12 items-center justify-center rounded-sm text-base ${
                use === u
                  ? "border-brand bg-brand-soft text-ink border-2 font-bold"
                  : "border-line-strong bg-card text-ink border font-semibold"
              }`}
            >
              <input
                type="radio"
                name="use"
                value={u}
                checked={use === u}
                onChange={() => setUse(u)}
                className="sr-only"
              />
              {INVENTORY_USE_LABELS[u]}
            </label>
          ))}
        </div>
      </fieldset>
      <Field label="Grupo">
        <select
          name="group"
          required
          className="input h-12"
          defaultValue={item?.group ?? (use === "sale" ? "for_sale" : "")}
        >
          <option value="" disabled>
            Escoge un grupo
          </option>
          {INVENTORY_GROUPS.map((g) => (
            <option key={g} value={g}>
              {INVENTORY_GROUP_LABELS[g]}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Presentación" hint="Ej. Frasco 150 g, Caja 50 pares.">
        <input
          name="presentation"
          required
          maxLength={60}
          defaultValue={item?.presentation}
          className="input"
        />
      </Field>
      <Field label="Unidad de conteo" hint="Ej. frasco, caja, paquete.">
        <input
          name="unitLabel"
          required
          maxLength={20}
          defaultValue={item?.unit_label}
          className="input"
        />
      </Field>
      <Field label="Precio por unidad">
        <input
          name="unitCost"
          inputMode="numeric"
          defaultValue={item ? String(item.unit_cost) : ""}
          placeholder="18.000"
          className="input"
        />
      </Field>
      <Field label="Proveedor (opcional)">
        <input
          name="supplier"
          maxLength={60}
          defaultValue={item?.supplier ?? ""}
          className="input"
        />
      </Field>
      <div className="grid grid-cols-2 gap-2">
        <Field label="Mínimo en bodega">
          <input
            name="minQty"
            inputMode="numeric"
            defaultValue={item?.min_qty ?? 0}
            className="input"
          />
        </Field>
        <Field label="Máximo en bodega">
          <input
            name="maxQty"
            inputMode="numeric"
            defaultValue={item?.max_qty ?? 0}
            className="input"
          />
        </Field>
      </div>
      {use === "internal" ? (
        <Field label="Dotación por estación" hint="0 = solo vive en bodega.">
          <input
            name="stationQty"
            inputMode="numeric"
            defaultValue={item?.station_qty ?? 0}
            className="input"
          />
        </Field>
      ) : (
        <>
          <Field label="Producto de la caja">
            <select name="productId" className="input h-12" defaultValue={item?.product_id ?? ""}>
              <option value="">Sin enlazar</option>
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Mínimo en vitrina">
            <input
              name="shelfMin"
              inputMode="numeric"
              defaultValue={item?.shelf_min ?? ""}
              className="input"
            />
          </Field>
        </>
      )}
      {item && (
        <label className="flex min-h-12 items-center gap-3 text-sm font-semibold">
          <input
            type="checkbox"
            name="inactive"
            defaultChecked={!item.is_active}
            className="h-6 w-6"
          />
          Desactivado (sale de la dotación, los conteos y la orden de compra)
        </label>
      )}
    </ActionForm>
  );
}

/** REQ-073.1 servicios que gastan un insumo, con su rendimiento o "Midiendo". */
export function ItemUsageForm({ item, catalog }: { item: CatalogItem; catalog: InventoryCatalog }) {
  const current = new Map(
    catalog.usage
      .filter((u) => u.item_id === item.id)
      .map((u) => [u.service_id, u.services_per_unit]),
  );
  return (
    <ActionForm
      action={setItemUsage}
      label={`Servicios que gastan ${item.name}`}
      submit="Guardar servicios"
      pendingText="Guardando…"
      done="Servicios guardados."
      resetOnDone={false}
    >
      <input type="hidden" name="itemId" value={item.id} />
      <p className="text-muted text-sm">
        Marca los servicios que lo gastan. Rendimiento = cuántos servicios alcanza una unidad; vacío
        = &quot;Midiendo&quot;.
      </p>
      <ul className="flex flex-col gap-2">
        {catalog.services.map((s) => (
          <li key={s.id} className="grid grid-cols-[auto_1fr_6rem] items-center gap-2">
            <input
              type="checkbox"
              name="serviceId"
              value={s.id}
              defaultChecked={current.has(s.id)}
              aria-label={s.name}
              className="h-6 w-6"
            />
            <span className="text-sm">{s.name}</span>
            <input
              name={`yield:${s.id}`}
              inputMode="numeric"
              defaultValue={current.get(s.id) ?? ""}
              placeholder="Midiendo"
              aria-label={`Rendimiento de ${s.name}`}
              className="input"
            />
          </li>
        ))}
      </ul>
    </ActionForm>
  );
}

/** Plantilla básica: guantes, cuchillas y papel cuello (design.md §18.6). */
export function BasicTemplateButton() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  return (
    <div className="mt-3 flex flex-col gap-2">
      <button
        type="button"
        className="btn-secondary"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            const r = await addBasicTemplate();
            if (r?.ok) {
              setError(null);
              router.refresh();
            } else setError(r?.error ?? null);
          })
        }
      >
        {pending ? "Agregando…" : "Agregar plantilla básica"}
      </button>
      <p className="text-muted text-sm">
        Guantes (caja de 50 pares), cuchillas (paquete de 10) y papel cuello (rollo de 100). Después
        escoges qué servicios los gastan.
      </p>
      {error && <ErrorText>{error}</ErrorText>}
    </div>
  );
}

// --------------------------------------------------------------- conteos ----

export type CountRow = { itemId: string; name: string; unitLabel: string; systemQty: number };

const COUNT_KIND_LABELS: Record<string, string> = {
  initial: "Conteo inicial",
  weekly: "Conteo semanal",
  monthly: "Conteo mensual",
  closing: "Cierre de estación",
};

/**
 * REQ-073.3 / REQ-073.6 / REQ-073.7 conteo de un sitio: todos sus ítems con lo calculado al lado,
 * motivo cuando hay diferencia en bodega o vitrina y, al guardar, el resultado por ítem.
 */
export function CountForm({
  locationId,
  needsReason,
  rows,
}: {
  locationId: string;
  needsReason: boolean;
  rows: CountRow[];
}) {
  const router = useRouter();
  const [counted, setCounted] = useState<Record<string, string>>({});
  const [state, setState] = useState<CountResult>(undefined);
  const [pending, startTransition] = useTransition();

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    startTransition(async () => {
      // Sin refresh aquí: el resultado es estado local. Se refresca al pedir otro conteo.
      setState(await recordCount(state, new FormData(form)));
    });
  }

  if (state?.ok) {
    return (
      <section className="mt-4" aria-labelledby="count-result">
        <h2 id="count-result" className="text-lg font-semibold">
          {COUNT_KIND_LABELS[state.kind] ?? "Conteo"} guardado
        </h2>
        <ul className="mt-2 flex flex-col gap-2">
          {state.lines.map((l) => (
            <li
              key={l.itemId}
              className={`rounded-md border p-3 text-base ${l.alert ? "border-danger bg-accent-soft" : "border-line bg-card"}`}
            >
              <p className="font-semibold">
                {l.name}: {l.countedQty} {l.unitLabel}
                {l.difference !== 0 &&
                  ` (diferencia ${l.difference > 0 ? "+" : ""}${l.difference})`}
              </p>
              {l.realUse !== null && (
                <p>
                  {l.services ?? 0} servicios · gastó {l.realUse}
                  {l.measuring ? " · Midiendo" : ` · se esperaba ${l.expectedUse ?? 0}`}
                  {l.alert && <span className="text-danger font-semibold"> · Revisar</span>}
                </p>
              )}
            </li>
          ))}
        </ul>
        <button
          type="button"
          className="btn-secondary mt-3 w-full"
          onClick={() => {
            setState(undefined);
            router.refresh();
          }}
        >
          Hacer otro conteo
        </button>
      </section>
    );
  }

  return (
    <form onSubmit={onSubmit} aria-label="Conteo" className="mt-4 flex flex-col gap-3">
      <input type="hidden" name="locationId" value={locationId} />
      {rows.length === 0 && (
        <EmptyState
          icon="list"
          title="Este sitio no tiene ítems para contar"
          text="Dale dotación desde el catálogo o escoge otro sitio arriba."
        />
      )}
      <ul className="flex flex-col gap-2">
        {rows.map((r) => {
          const value = counted[r.itemId] ?? "";
          const differs = value !== "" && /^\d+$/.test(value) && Number(value) !== r.systemQty;
          return (
            <li
              key={r.itemId}
              className="border-line bg-card flex flex-col gap-2 rounded-md border p-3"
            >
              <input type="hidden" name="itemId" value={r.itemId} />
              <div className="grid grid-cols-[1fr_6rem] items-center gap-2">
                <label htmlFor={`counted-${r.itemId}`} className="text-sm">
                  <span className="font-semibold">{r.name}</span>
                  <span className="text-muted block text-sm">
                    Calculado: {r.systemQty} {r.unitLabel}
                  </span>
                </label>
                <input
                  id={`counted-${r.itemId}`}
                  name={`counted:${r.itemId}`}
                  inputMode="numeric"
                  required
                  value={value}
                  onChange={(e) => setCounted((c) => ({ ...c, [r.itemId]: e.target.value }))}
                  className="input text-right"
                />
              </div>
              {needsReason && differs && (
                <select
                  name={`reason:${r.itemId}`}
                  required
                  className="input h-12"
                  defaultValue=""
                  aria-label={`Motivo de ${r.name}`}
                >
                  <option value="" disabled>
                    Motivo de la diferencia
                  </option>
                  {ADJUSTMENT_REASONS.map((m) => (
                    <option key={m} value={m}>
                      {ADJUSTMENT_REASON_LABELS[m]}
                    </option>
                  ))}
                </select>
              )}
            </li>
          );
        })}
      </ul>
      {state && !state.ok && state.error && <ErrorText>{state.error}</ErrorText>}
      {rows.length > 0 && (
        <button type="submit" className="btn-primary" disabled={pending}>
          {pending ? "Guardando…" : "Guardar conteo"}
        </button>
      )}
    </form>
  );
}

/** REQ-073.4 porcentaje de alerta de consumo, en /admin/negocio. */
export function AlertPctForm({ pct }: { pct: number }) {
  return (
    <ActionForm
      action={saveAlertPct}
      label="Alerta de consumo"
      submit="Guardar alerta"
      pendingText="Guardando…"
      done="Alerta guardada."
      resetOnDone={false}
      className="border-line bg-card flex flex-col gap-3 rounded-md border p-4"
    >
      <h2 className="text-lg font-semibold">Inventario</h2>
      <Field
        label="Alerta de consumo (%)"
        hint="Si un barbero gasta más que lo esperado por encima de este porcentaje, sale en rojo. Entre 1 y 100."
      >
        <input name="alertPct" inputMode="numeric" required defaultValue={pct} className="input" />
      </Field>
    </ActionForm>
  );
}
