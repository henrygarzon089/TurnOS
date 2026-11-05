import type { Gateway } from "@/lib/db/gateway";

/**
 * REQ-064.6, design.md §16.3: borra de Storage las fotos de registros y revisiones de más de 90
 * días. Desde SQL no se borran objetos de Storage, así que la base dice qué borrar y esta función lo
 * borra. Corre con `after()` al abrir Limpieza o el panel, como máximo una vez por día y negocio
 * (`cleaning_purge_claim`). Nunca lanza: si algo falla, se reintenta al día siguiente.
 */
export type PurgeDeps = {
  /** Con service_role: las funciones de la purga no están abiertas al personal. */
  gateway: Gateway;
  /** Borra los objetos del bucket `cleaning`; true si salió bien. */
  removeObjects: (paths: string[]) => Promise<boolean>;
};

type Batch = {
  records: { id: string; paths: string[] }[];
  inspections: { id: string; paths: string[] }[];
};

export async function purgeCleaningPhotos(businessId: string, deps: PurgeDeps): Promise<{ purged: number }> {
  try {
    const claimed = await deps.gateway.rpc<boolean>("cleaning_purge_claim", { p_business_id: businessId });
    if (!claimed) return { purged: 0 };
    const batch = await deps.gateway.rpc<Batch>("cleaning_photos_to_purge", {
      p_business_id: businessId,
      p_limit: 200,
    });
    const paths = [...batch.records, ...batch.inspections].flatMap((r) => r.paths);
    if (paths.length === 0) return { purged: 0 };
    if (!(await deps.removeObjects(paths))) return { purged: 0 };
    await deps.gateway.rpc("mark_cleaning_photos_purged", {
      p_business_id: businessId,
      p_record_ids: batch.records.map((r) => r.id),
      p_inspection_ids: batch.inspections.map((r) => r.id),
    });
    return { purged: paths.length };
  } catch {
    return { purged: 0 };
  }
}
