import { afterAll, describe, expect, it } from "vitest";
import {
  BASIC_TEMPLATE,
  basicTemplateItem,
  inventoryErrorMessage,
  parseInventoryItemForm,
  purchaseOrderText,
  type PurchaseOrderLine,
} from "@/lib/domain/inventory";
import { loginAs, pool, withTx, type Q } from "./db";
import { seedTwoBusinesses, USERS } from "./fixtures";

afterAll(() => pool.end());

/**
 * Las acciones de src/lib/actions/inventory.ts, paso a paso con la sesión del dueño o del barbero:
 * las mismas funciones SQL (0063–0067) y los mismos mapeos de src/lib/domain/inventory.ts.
 */

function form(fields: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.append(k, v);
  return fd;
}

/** Llama una función SQL como lo hace la acción: los errores salen en español. */
async function rpc<R>(q: Q, sql: string, params: unknown[]): Promise<{ data?: R; error?: string }> {
  await q("savepoint act");
  try {
    const r = await q<{ r: R }>(sql, params);
    await q("release savepoint act");
    return { data: r.rows[0]?.r };
  } catch (e) {
    await q("rollback to savepoint act");
    return { error: inventoryErrorMessage(e as { message?: string; code?: string }) };
  }
}

const CERA = {
  name: "Cera mate",
  group: "finishing",
  use: "internal",
  presentation: "Frasco 150 g",
  unitLabel: "frasco",
  unitCost: "18.000",
  supplier: "Distri Sabaneta",
  minQty: "3",
  maxQty: "10",
  stationQty: "1",
};

async function saveItem(q: Q, biz: string, fd: FormData) {
  const parsed = parseInventoryItemForm(fd);
  if (!parsed.ok) return { error: parsed.error };
  return rpc<string>(q, "select save_inventory_item($1, $2::jsonb) as r", [biz, JSON.stringify(parsed.value)]);
}

const locations = async (q: Q, biz: string) =>
  (
    await q<{ id: string; kind: string; barber_id: string | null }>(
      "select id, kind, barber_id from inventory_locations where business_id = $1",
      [biz],
    )
  ).rows;

describe("REQ-070 / REQ-071 inventario desde /admin/inventario", () => {
  it("REQ-071.6 el dueño crea un insumo desde el formulario, le entra stock y repone con envase vacío", async () => {
    await withTx(async (q) => {
      const f = await seedTwoBusinesses(q);
      await loginAs(q, USERS.ownerA);
      const item = await saveItem(q, f.businessA, form(CERA));
      expect(item.error).toBeUndefined();
      const id = item.data!;
      const locs = await locations(q, f.businessA);
      const bodega = locs.find((l) => l.kind === "warehouse")!.id;
      const station = locs.find((l) => l.barber_id === f.barberA)!.id;

      expect((await rpc(q, "select register_stock_purchase($1, 5, 18000) as r", [id])).error).toBeUndefined();
      expect((await rpc(q, "select transfer_stock($1, $2, $3, 1) as r", [id, bodega, station])).error).toBeUndefined();
      expect((await rpc(q, "select refill_station($1, $2, 1, false) as r", [f.barberA, id])).error).toBe(
        "Sin envase vacío no hay reposición.",
      );
      expect((await rpc(q, "select refill_station($1, $2, 1, true) as r", [f.barberA, id])).error).toBeUndefined();
      expect((await rpc(q, "select transfer_stock($1, $2, $3, 1) as r", [id, bodega, station])).error).toBe(
        "La estación quedaría por encima de la dotación.",
      );

      const overview = (await rpc<{ items: { id: string; warehouse: number; stock: Record<string, number> }[] }>(
        q, "select inventory_overview($1) as r", [f.businessA])).data!;
      const row = overview.items.find((i) => i.id === id)!;
      expect(row.warehouse).toBe(3);
      expect(row.stock[station]).toBe(1);
    });
  });

  it("REQ-071.6 el barbero no maneja el inventario: el mensaje sale en español", async () => {
    await withTx(async (q) => {
      const f = await seedTwoBusinesses(q);
      await loginAs(q, USERS.barberA);
      expect((await saveItem(q, f.businessA, form(CERA))).error).toBe("Solo el dueño puede manejar el inventario.");
      expect((await rpc(q, "select inventory_overview($1) as r", [f.businessA])).error).toBe(
        "Solo el dueño puede manejar el inventario.",
      );
    });
  });

  it("REQ-070.2 enlazar un producto de otro negocio sale como error claro", async () => {
    await withTx(async (q) => {
      const f = await seedTwoBusinesses(q);
      const p = await q<{ id: string }>(
        "insert into products (business_id, name, price) values ($1, 'Agua B', 2000) returning id",
        [f.businessB],
      );
      await loginAs(q, USERS.ownerA);
      const r = await saveItem(
        q,
        f.businessA,
        form({ ...CERA, use: "sale", group: "for_sale", productId: p.rows[0].id, shelfMin: "2" }),
      );
      expect(r.error).toBe("Ese producto ya está enlazado con otro ítem.");
    });
  });

  it("REQ-070.1 la plantilla básica se agrega con tres insumos de uso interno", async () => {
    await withTx(async (q) => {
      const f = await seedTwoBusinesses(q);
      await loginAs(q, USERS.ownerA);
      for (const t of BASIC_TEMPLATE) {
        const r = await rpc(q, "select save_inventory_item($1, $2::jsonb) as r", [
          f.businessA,
          JSON.stringify(basicTemplateItem(t)),
        ]);
        expect(r.error).toBeUndefined();
      }
      const allowance = await q<{ qty: number }>("select qty from station_allowance($1)", [f.businessA]);
      expect(allowance.rows.map((r) => r.qty)).toEqual([1, 1, 1]);
    });
  });
});

describe("REQ-073 / REQ-074 conteos, orden de compra y Mi estación", () => {
  it("REQ-074.2 la orden de compra de la base se vuelve el texto para WhatsApp", async () => {
    await withTx(async (q) => {
      const f = await seedTwoBusinesses(q);
      await loginAs(q, USERS.ownerA);
      const id = (await saveItem(q, f.businessA, form(CERA))).data!;
      await rpc(q, "select register_stock_purchase($1, 2, 18000) as r", [id]);
      const rows = (await q<PurchaseOrderLine>(
        "select supplier, name, presentation, qty, amount from purchase_order($1)",
        [f.businessA],
      )).rows;
      expect(purchaseOrderText("Barbería A", "2026-11-09", rows)).toBe(
        [
          "Pedido de Barbería A · 2026-11-09",
          "",
          "Distri Sabaneta",
          "- Cera mate (Frasco 150 g): 8",
          "",
          "Total estimado: $ 144.000",
        ].join("\n"),
      );
    });
  });

  it("REQ-073.6 el conteo de bodega sin motivo se rechaza en español", async () => {
    await withTx(async (q) => {
      const f = await seedTwoBusinesses(q);
      await loginAs(q, USERS.ownerA);
      const id = (await saveItem(q, f.businessA, form(CERA))).data!;
      const bodega = (await locations(q, f.businessA)).find((l) => l.kind === "warehouse")!.id;
      const lines = (n: number, reason: string | null) => JSON.stringify([{ itemId: id, counted: n, reason }]);
      expect((await rpc(q, "select record_stock_count($1, $2::jsonb) as r", [bodega, lines(4, null)])).error).toBeUndefined();
      expect((await rpc(q, "select record_stock_count($1, $2::jsonb) as r", [bodega, lines(3, null)])).error).toBe(
        "Escoge el motivo de cada diferencia.",
      );
      const ok = await rpc<{ kind: string }>(q, "select record_stock_count($1, $2::jsonb) as r", [bodega, lines(3, "damaged")]);
      expect(ok.data?.kind).toBe("monthly");
    });
  });

  it("REQ-074.4 el barbero ve su estación, sin precios", async () => {
    await withTx(async (q) => {
      const f = await seedTwoBusinesses(q);
      await loginAs(q, USERS.ownerA);
      const id = (await saveItem(q, f.businessA, form(CERA))).data!;
      const locs = await locations(q, f.businessA);
      await rpc(q, "select register_stock_purchase($1, 2, 18000) as r", [id]);
      await rpc(q, "select transfer_stock($1, $2, $3, 1) as r", [
        id,
        locs.find((l) => l.kind === "warehouse")!.id,
        locs.find((l) => l.barber_id === f.barberA)!.id,
      ]);
      await loginAs(q, USERS.barberA);
      const mine = (await rpc<{ items: { name: string; stock: number; allowance: number }[] }>(
        q, "select my_station($1) as r", [f.businessA])).data!;
      expect(mine.items).toEqual([expect.objectContaining({ name: "Cera mate", stock: 1, allowance: 1 })]);
      expect(JSON.stringify(mine)).not.toContain("18000");
    });
  });
});
