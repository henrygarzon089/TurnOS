"use server";

import { getStaffSession } from "@/lib/auth/session";
import {
  buildImportRows,
  parseFreshaAppointments,
  parseFreshaClients,
  type AppointmentSkipReason,
  type ClientSkipReason,
  type FreshaAppointment,
  type FreshaClient,
  type NamedOption,
} from "@/lib/domain/fresha-import";
import { businessDayBogota } from "@/lib/domain/time";
import { fileRows } from "@/lib/import/read-file";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * Importar de Fresha (REQ-100, design.md §32.2). Los archivos se leen en memoria y se descartan:
 * nunca se guardan (REQ-100.11). Solo el dueño.
 */

export type { ImportFileError } from "@/lib/import/read-file";
import type { ImportFileError } from "@/lib/import/read-file";

export type ImportReason =
  | "PAST"
  | "DAY_CLOSED"
  | "OUTSIDE_HOURS"
  | "SLOT_TAKEN"
  | "HAS_BOOKING"
  | "INVALID"
  | "NO_PHONE"
  | "UNMAPPED";

export type ImportPreview = {
  clients: {
    total: number;
    new: number;
    existing: number;
    skipped: Record<ClientSkipReason, number>;
  } | null;
  appointments: {
    importable: number;
    /** Listas para crear con las parejas que ya coinciden (REQ-100.2). */
    ready: number;
    noPhone: number;
    unmatched: number;
    skipped: Record<AppointmentSkipReason, number>;
  } | null;
  unmatchedBarbers: string[];
  unmatchedServices: string[];
  barbers: NamedOption[];
  services: NamedOption[];
};

export type NotImportedRow = {
  startsAt: string;
  clientName: string;
  barberName: string;
  serviceName: string;
  reason: ImportReason;
};

export type ImportDone = {
  customersNew: number;
  customersExisting: number;
  appointmentsCreated: number;
  appointmentsAlready: number;
  notImported: NotImportedRow[];
};

export type PreviewResult =
  | { ok: true; preview: ImportPreview }
  | { ok: false; error: "FORBIDDEN" | "NO_FILES"; file?: undefined }
  | { ok: false; error: ImportFileError; file: "clients" | "appointments" };

export type ConfirmResult =
  | { ok: true; done: ImportDone }
  | {
      ok: false;
      error: "FORBIDDEN" | "NO_FILES" | "APPOINTMENTS_DISABLED" | "FAILED";
      file?: undefined;
    }
  | { ok: false; error: ImportFileError; file: "clients" | "appointments" };

type Read =
  | {
      ok: true;
      clients: FreshaClient[] | null;
      clientSkips: { reason: ClientSkipReason }[];
      appts: FreshaAppointment[] | null;
      apptSkips: { reason: AppointmentSkipReason }[];
    }
  | { ok: false; error: ImportFileError | "NO_FILES"; file?: "clients" | "appointments" };

async function readFiles(form: FormData, today: string): Promise<Read> {
  const clientRows = await fileRows(form.get("clients"));
  if (typeof clientRows === "string") return { ok: false, error: clientRows, file: "clients" };
  const apptRows = await fileRows(form.get("appointments"));
  if (typeof apptRows === "string") return { ok: false, error: apptRows, file: "appointments" };
  if (!clientRows && !apptRows) return { ok: false, error: "NO_FILES" };

  let clients: FreshaClient[] | null = null;
  let clientSkips: { reason: ClientSkipReason }[] = [];
  if (clientRows) {
    const r = parseFreshaClients(clientRows);
    if (!r.ok) return { ok: false, error: r.error, file: "clients" };
    clients = r.clients;
    clientSkips = r.skipped;
  }
  let appts: FreshaAppointment[] | null = null;
  let apptSkips: { reason: AppointmentSkipReason }[] = [];
  if (apptRows) {
    const r = parseFreshaAppointments(apptRows, today);
    if (!r.ok) return { ok: false, error: r.error, file: "appointments" };
    appts = r.appointments;
    apptSkips = r.skipped;
  }
  return { ok: true, clients, clientSkips, appts, apptSkips };
}

function count<R extends string>(keys: readonly R[], items: { reason: R }[]): Record<R, number> {
  const out = Object.fromEntries(keys.map((k) => [k, 0])) as Record<R, number>;
  for (const i of items) out[i.reason] += 1;
  return out;
}

/** Un cliente por celular: el archivo puede traer el mismo dos veces (REQ-100.3). */
function uniqueByPhone(clients: FreshaClient[]): FreshaClient[] {
  return [...new Map(clients.map((c) => [c.phone, c] as const)).values()];
}

async function owner() {
  const session = await getStaffSession();
  if (session?.role !== "owner") return null;
  const supabase = await createSupabaseServerClient();
  const [barbers, services] = await Promise.all([
    supabase
      .from("barbers")
      .select("id, display_name")
      .eq("business_id", session.business.id)
      .eq("is_active", true)
      .order("sort_order"),
    supabase
      .from("services")
      .select("id, name")
      .eq("business_id", session.business.id)
      .eq("is_active", true)
      .order("sort_order"),
  ]);
  return {
    session,
    supabase,
    barbers: (barbers.data ?? []).map((b) => ({
      id: b.id as string,
      name: b.display_name as string,
    })),
    services: (services.data ?? []).map((s) => ({ id: s.id as string, name: s.name as string })),
  };
}

/** REQ-100.2 resumen sin guardar nada. */
export async function previewFreshaImport(form: FormData): Promise<PreviewResult> {
  const o = await owner();
  if (!o) return { ok: false, error: "FORBIDDEN" };
  const read = await readFiles(form, businessDayBogota(new Date()));
  if (!read.ok)
    return read.file
      ? { ok: false, error: read.error as ImportFileError, file: read.file }
      : { ok: false, error: "NO_FILES" };

  let clients: ImportPreview["clients"] = null;
  if (read.clients) {
    const unique = uniqueByPhone(read.clients);
    const phones = unique.map((c) => c.phone);
    let existing = 0;
    for (let i = 0; i < phones.length; i += 200) {
      const { count: n } = await o.supabase
        .from("customers")
        .select("id", { count: "exact", head: true })
        .eq("business_id", o.session.business.id)
        .in("phone_e164", phones.slice(i, i + 200));
      existing += n ?? 0;
    }
    clients = {
      total: unique.length,
      new: unique.length - existing,
      existing,
      skipped: count(["NO_PHONE", "FOREIGN_PHONE", "NO_NAME"] as const, read.clientSkips),
    };
  }

  const built = buildImportRows(read.clients ?? [], read.appts ?? [], {
    barbers: o.barbers,
    services: o.services,
    barberChoice: {},
    serviceChoice: {},
  });
  return {
    ok: true,
    preview: {
      clients,
      appointments: read.appts
        ? {
            importable: read.appts.length,
            ready: built.appointments.length,
            noPhone: built.notImported.filter((x) => x.reason === "NO_PHONE").length,
            unmatched: built.notImported.filter((x) => x.reason === "UNMAPPED").length,
            skipped: count(["PAST", "NOT_BOOKED", "BAD_DATE"] as const, read.apptSkips),
          }
        : null,
      unmatchedBarbers: built.unmatchedBarbers,
      unmatchedServices: built.unmatchedServices,
      barbers: o.barbers,
      services: o.services,
    },
  };
}

function parseChoice(
  raw: FormDataEntryValue | null,
  allowed: NamedOption[],
): Record<string, string> {
  if (typeof raw !== "string") return {};
  try {
    const obj = JSON.parse(raw) as Record<string, unknown>;
    const ids = new Set(allowed.map((a) => a.id));
    return Object.fromEntries(
      Object.entries(obj).filter(
        (e): e is [string, string] => typeof e[1] === "string" && ids.has(e[1]),
      ),
    );
  } catch {
    return {};
  }
}

/** REQ-100.3…100.10 importa de verdad y devuelve lo que no se pudo. */
export async function confirmFreshaImport(form: FormData): Promise<ConfirmResult> {
  const o = await owner();
  if (!o) return { ok: false, error: "FORBIDDEN" };
  const read = await readFiles(form, businessDayBogota(new Date()));
  if (!read.ok)
    return read.file
      ? { ok: false, error: read.error as ImportFileError, file: read.file }
      : { ok: false, error: "NO_FILES" };

  const clients = uniqueByPhone(read.clients ?? []);
  const built = buildImportRows(clients, read.appts ?? [], {
    barbers: o.barbers,
    services: o.services,
    barberChoice: parseChoice(form.get("barberChoice"), o.barbers),
    serviceChoice: parseChoice(form.get("serviceChoice"), o.services),
  });

  const { data, error } = await o.supabase.rpc("import_fresha", {
    p_business_id: o.session.business.id,
    p_customers: clients,
    p_appointments: built.appointments.map((a) => a.payload),
    p_rows_skipped: read.clientSkips.length,
  });
  if (error) {
    if (error.message.includes("APPOINTMENTS_DISABLED"))
      return { ok: false, error: "APPOINTMENTS_DISABLED" };
    if (error.message.includes("FORBIDDEN")) return { ok: false, error: "FORBIDDEN" };
    return { ok: false, error: "FAILED" };
  }
  const r = data as {
    customersNew: number;
    customersExisting: number;
    appointmentsCreated: number;
    appointmentsAlready: number;
    rejected: { index: number; reason: ImportReason }[];
  };
  const row = (a: FreshaAppointment, reason: ImportReason): NotImportedRow => ({
    startsAt: a.startsAt,
    clientName: a.clientName,
    barberName: a.barberName,
    serviceName: a.serviceName,
    reason,
  });
  const notImported = [
    ...built.notImported.map((n) => row(n.source, n.reason)),
    ...r.rejected.map((x) => row(built.appointments[x.index].source, x.reason)),
  ].sort((a, b) => a.startsAt.localeCompare(b.startsAt));
  return {
    ok: true,
    done: {
      customersNew: r.customersNew,
      customersExisting: r.customersExisting,
      appointmentsCreated: r.appointmentsCreated,
      appointmentsAlready: r.appointmentsAlready,
      notImported,
    },
  };
}
