import { afterAll, describe, expect, it, vi } from "vitest";
import { purgeCleaningPhotos } from "@/lib/cleaning/purge";
import {
  cleaningErrorMessage,
  pendingSuggestions,
  recordPhotoPath,
  taskStatusLabel,
  validateChecklist,
  type ChecklistAnswer,
  type CleaningKind,
} from "@/lib/domain/cleaning";
import { loginAs, pool, withTx, type Q } from "./db";
import { seedTwoBusinesses, USERS } from "./fixtures";
import { createPgGateway } from "./pg-gateway";

afterAll(() => pool.end());

/**
 * Las acciones de src/lib/actions/cleaning.ts paso a paso: la validación de src/lib/domain/cleaning.ts,
 * las funciones SQL (0057–0059) con la sesión del usuario y los mensajes en español.
 */

const at = (q: Q, ts: string) => q("select set_config('turnos.test_now', $1, true)", [ts]);

async function setup(q: Q) {
  const f = await seedTwoBusinesses(q);
  await q(
    `update business_hours set opens_at = '09:00', closes_at = '20:00', is_closed = (weekday = 0)
      where business_id = $1`,
    [f.businessA],
  );
  await loginAs(q, USERS.ownerA);
  await q("select cleaning_set_enabled($1, true)", [f.businessA]);
  await q("update businesses set cleaning_enabled_on = '2026-11-02' where id = $1", [f.businessA]);
  return f;
}

async function answers(q: Q, biz: string, kind: CleaningKind, undone?: string): Promise<ChecklistAnswer[]> {
  const today = await q<{ t: { lists: Record<string, { id: string; label: string }[]> } }>(
    "select cleaning_today($1) as t",
    [biz],
  );
  return today.rows[0].t.lists[kind].map((i) => ({
    id: i.id,
    done: i.label !== undone,
    note: i.label === undone ? "Se acabó el jabón" : "",
  }));
}

/** submitCleaningRecord: valida en el celular y después en la base; errores en español. */
async function submit(q: Q, biz: string, kind: CleaningKind, a: ChecklistAnswer[], photos: string[]) {
  const check = validateChecklist(kind, a, photos.length);
  if (!check.ok) return { error: check.error };
  await q("savepoint act");
  try {
    const r = await q<{ r: { isComplete: boolean; isLate: boolean } }>(
      "select submit_cleaning_record($1, $2, $3::jsonb, $4) as r",
      [biz, kind, JSON.stringify(a.map((x) => ({ id: x.id, done: x.done, note: x.done ? null : x.note }))), photos],
    );
    await q("release savepoint act");
    return { data: r.rows[0].r };
  } catch (e) {
    await q("rollback to savepoint act");
    const err = e as { message?: string; code?: string; detail?: string };
    return { error: cleaningErrorMessage({ message: err.message, code: err.code, details: err.detail }, kind) };
  }
}

describe("REQ-061 registrar desde el celular", () => {
  it("REQ-061.3 la apertura incompleta con nota se guarda y queda marcada", async () => {
    await withTx(async (q) => {
      const f = await setup(q);
      await at(q, "2026-11-10 09:20-05");
      await loginAs(q, USERS.barberA);
      const r = await submit(q, f.businessA, "opening", await answers(q, f.businessA, "opening", "Baño limpio con jabón y toallas"), []);
      expect(r).toMatchObject({ data: { isComplete: false, isLate: false } });
    });
  });

  it("REQ-061.2 la segunda apertura dice quién y a qué hora, en español", async () => {
    await withTx(async (q) => {
      const f = await setup(q);
      await at(q, "2026-11-10 09:05-05");
      await loginAs(q, USERS.barberA);
      await submit(q, f.businessA, "opening", await answers(q, f.businessA, "opening"), []);
      await loginAs(q, USERS.ownerA);
      const r = await submit(q, f.businessA, "opening", await answers(q, f.businessA, "opening"), []);
      expect(r.error).toBe("La apertura de hoy ya la registró Barbero A a las 9:05 a. m.");
    });
  });

  it("REQ-061.7 el cierre temprano del barbero dice desde qué hora", async () => {
    await withTx(async (q) => {
      const f = await setup(q);
      await at(q, "2026-11-10 17:00-05");
      await loginAs(q, USERS.barberA);
      const r = await submit(q, f.businessA, "closing", await answers(q, f.businessA, "closing"), [
        recordPhotoPath(f.businessA, "2026-11-10"),
      ]);
      expect(r.error).toBe("El cierre se registra desde las 7:00 p. m.");
    });
  });

  it("REQ-061.4 sin foto el cierre ni siquiera llega a la base", async () => {
    await withTx(async (q) => {
      const f = await setup(q);
      await at(q, "2026-11-10 19:30-05");
      await loginAs(q, USERS.barberA);
      const r = await submit(q, f.businessA, "closing", await answers(q, f.businessA, "closing"), []);
      expect(r.error).toBe("Falta la foto del local");
      const n = await q<{ n: number }>("select count(*)::int as n from cleaning_records");
      expect(n.rows[0].n).toBe(0);
    });
  });

  it("REQ-060.5 si el dueño cambió la lista, el barbero ve que debe volver a abrirla", async () => {
    await withTx(async (q) => {
      const f = await setup(q);
      await at(q, "2026-11-10 09:20-05");
      await loginAs(q, USERS.barberA);
      const a = await answers(q, f.businessA, "opening");
      await loginAs(q, USERS.ownerA);
      await q(
        `select cleaning_save_list($1, 'opening', (select jsonb_agg(jsonb_build_object('id', id, 'label', label))
           from cleaning_checklist_items where business_id = $1 and kind = 'opening' and label <> 'Ventilar'))`,
        [f.businessA],
      );
      await loginAs(q, USERS.barberA);
      expect((await submit(q, f.businessA, "opening", a, [])).error).toBe("La lista cambió. Vuelve a abrirla");
    });
  });

  it("REQ-061.1 el barbero de otro negocio no registra", async () => {
    await withTx(async (q) => {
      const f = await setup(q);
      await at(q, "2026-11-10 09:20-05");
      const a = await answers(q, f.businessA, "opening");
      await loginAs(q, USERS.barberB);
      expect((await submit(q, f.businessA, "opening", a, [])).error).toBe("No tienes permiso para esta acción.");
    });
  });
});

describe("REQ-064 tareas y fotos", () => {
  it("REQ-064.1 las sugerencias no repiten una tarea que ya existe", async () => {
    await withTx(async (q) => {
      const f = await setup(q);
      await q("select save_cleaning_task($1, null, 'Botiquín', 30, true)", [f.businessA]);
      const names = await q<{ name: string }>("select name from cleaning_tasks where business_id = $1", [f.businessA]);
      expect(pendingSuggestions(names.rows.map((r) => r.name)).map((s) => s.name)).toEqual([
        "Aire acondicionado",
        "Control de plagas",
      ]);
    });
  });

  it("REQ-064.4 la lista de tareas trae el estado que la pantalla traduce", async () => {
    await withTx(async (q) => {
      const f = await setup(q);
      await at(q, "2026-11-13 10:00-05");
      const id = (await q<{ id: string }>("select save_cleaning_task($1, null, 'Botiquín', 30, true) as id", [f.businessA]))
        .rows[0].id;
      await q("select record_cleaning_task_run($1, $2, '2026-10-20', null, null)", [f.businessA, id]);
      const list = await q<{ l: { status: "overdue" | "soon" | "ok" }[] }>("select cleaning_tasks_list($1) as l", [
        f.businessA,
      ]);
      expect(taskStatusLabel(list.rows[0].l[0].status)).toBe("Vence pronto");
    });
  });

  it("REQ-064.6 la purga borra de Storage las fotos de más de 90 días y las marca", async () => {
    await withTx(async (q) => {
      const f = await setup(q);
      await at(q, "2026-11-10 19:30-05");
      await loginAs(q, USERS.barberA);
      const photo = recordPhotoPath(f.businessA, "2026-11-10");
      await submit(q, f.businessA, "closing", await answers(q, f.businessA, "closing"), [photo]);

      await at(q, "2027-02-10 10:00-05");
      await loginAs(q, null, "service_role");
      const removeObjects = vi.fn(async () => true);
      expect(await purgeCleaningPhotos(f.businessA, { gateway: createPgGateway(q), removeObjects })).toEqual({ purged: 1 });
      expect(removeObjects).toHaveBeenCalledWith([photo]);
      const left = await q<{ n: number }>(
        "select count(*)::int as n from cleaning_records where cardinality(photo_paths) > 0",
      );
      expect(left.rows[0].n).toBe(0);
      expect(await purgeCleaningPhotos(f.businessA, { gateway: createPgGateway(q), removeObjects })).toEqual({ purged: 0 });
    });
  });
});
